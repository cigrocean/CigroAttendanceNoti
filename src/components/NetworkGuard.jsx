import React, { useState, useEffect } from 'react';
import { Lock, ShieldAlert, MapPin, Loader2 } from 'lucide-react';
import { fetchAuthorizedNetworks, authorizeNetwork } from '../services/googleSheets';
import { getTranslation } from '../utils/translations';
import { useLanguage } from '../hooks/useLanguage';
import { toast } from 'sonner';

// Config
const ALLOWED_LOCATION = import.meta.env.VITE_ALLOWED_LOCATION
  ? import.meta.env.VITE_ALLOWED_LOCATION.split(',').map(coord => parseFloat(coord.trim()))
  : null;

const LOCATION_RADIUS = import.meta.env.VITE_LOCATION_RADIUS 
  ? parseInt(import.meta.env.VITE_LOCATION_RADIUS, 10) 
  : 300; 

const OFFICE_WIFI_PASSWORD = import.meta.env.VITE_OFFICE_WIFI_PASSWORD || "cigro123";

// Utils
const getDistanceFromLatLonInMeters = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; 
  const dLat = (lat2 - lat1) * (Math.PI/180);
  const dLon = (lon2 - lon1) * (Math.PI/180);
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * (Math.PI/180)) * Math.cos(lat2 * (Math.PI/180)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  return R * c; 
};

const Layout = ({ children }) => {
  const { language, setLanguage } = useLanguage();
  return (
    <div className="fixed inset-0 z-[9999] bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 font-sans">
      <div 
        className="bg-card text-card-foreground shadow-2xl animate-in fade-in zoom-in-95 duration-200 relative"
        style={{ 
          boxSizing: 'border-box',
          width: '100%',
          maxWidth: '320px',
          borderRadius: '24px',
          border: '1px solid hsl(var(--border))',
          overflow: 'hidden',
          padding: '32px 24px' 
        }} 
      >

        {children}
      </div>
    </div>
  );
};

const NetworkGuard = ({ children }) => {
  const { language } = useLanguage();
  // ... (state remains same)
  const [status, setStatus] = useState('loading');
  const [currentIp, setCurrentIp] = useState('');
  const [locationStatus, setLocationStatus] = useState(null); 
  const [isCheckingLocation, setIsCheckingLocation] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState(false);
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [errorDetails, setErrorDetails] = useState('');
  const [permissionState, setPermissionState] = useState(null);

  useEffect(() => {
    if (navigator.permissions && navigator.permissions.query) {
       navigator.permissions.query({ name: 'geolocation' })
         .then(perm => {
             setPermissionState(perm.state);
             console.log("Permission state:", perm.state);
             perm.onchange = () => setPermissionState(perm.state);
         })
         .catch(err => console.log("Permissions API not supported for geo", err));
    }
  }, []);

  const t = (key, params) => getTranslation(key, language, params);

  const checkAccess = async () => {
    // ... (checkAccess logic mostly same, error messages could be translated but low priority as checking logs mostly)
    try {
       const ipRes = await fetch('https://api.ipify.org?format=json');
       if (!ipRes.ok) throw new Error('Failed to fetch IP');
       const { ip } = await ipRes.json();
       setCurrentIp(ip);
       console.log('Network Check - Current IP:', ip);

       try {
         const authorizedOps = await fetchAuthorizedNetworks();
         if (authorizedOps.includes(ip)) {
             setStatus('authorized');
             return;
         } else {
             console.warn("IP mismatch. Your IP is not in the authorized list. Clearing cache.");
             localStorage.removeItem('cigro_networks');
         }
       } catch (netErr) {
         console.warn("Failed to check authorized networks, falling back to location:", netErr);
       }

       console.log('IP not authorized. Checking location...');
       checkLocation(ip);

    } catch (e) {
       console.error("Network check failed:", e);
       setErrorDetails(e.message);
       setStatus('error');
    }
  };

  const checkLocation = (ip) => {
     if (!ALLOWED_LOCATION || ALLOWED_LOCATION.length !== 2) {
         console.warn("Location config missing.");
         setErrorDetails("Location configuration missing.");
         setStatus('error');
         return;
     }

     if (!navigator.geolocation) {
         setErrorDetails("Geolocation not supported by browser.");
         setStatus('unauthorized_location');
         return;
     }

     setIsCheckingLocation(true);
     setLocationStatus(null);
     const startTime = Date.now();
     const MIN_DELAY = 800;

     const handleCompletion = (callback) => {
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, MIN_DELAY - elapsed);
        setTimeout(callback, remaining);
     };

     navigator.geolocation.getCurrentPosition(
        (position) => {
            handleCompletion(() => {
                setIsCheckingLocation(false);
                const { latitude, longitude, accuracy } = position.coords;
                const distance = getDistanceFromLatLonInMeters(
                    latitude, longitude,
                    ALLOWED_LOCATION[0], ALLOWED_LOCATION[1]
                );

                setLocationStatus({ distance, accuracy });
                console.log(`Location Check: ${distance.toFixed(0)}m`);
                
                toast.dismiss(); 
                toast.success(t('locationUpdated', { dist: distance.toFixed(0) }));

                if (distance <= LOCATION_RADIUS) {
                    setStatus('unauthorized_ip');
                } else {
                    setStatus('unauthorized_location');
                }
            });
        },
        (err) => {
            handleCompletion(() => {
                setIsCheckingLocation(false);
                console.error("Location error:", err);
                let msg = err.message;

                if (err.code === 1) msg = "Permission denied. Please reset browser permissions.";
                if (err.code === 2) msg = "Location unavailable.";
                if (err.code === 3) msg = "Location timed out.";
                
                setErrorDetails(msg);
                setLocationStatus({ error: msg });
                setStatus('unauthorized_location');
                
                toast.dismiss();
                toast.error(msg);
            });
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
     );
  };

  // ... handlePasswordSubmit same ...
  const handlePasswordSubmit = async (e) => {
      e.preventDefault();
      setPasswordError(false);
      setErrorDetails('');
      
      if (password === OFFICE_WIFI_PASSWORD) {
          setIsAuthorizing(true);
          try {
              await authorizeNetwork(currentIp);
              setStatus('authorized');
          } catch (e) {
              console.error("Authorization failed:", e);
              setErrorDetails(e.message || "Authorization failed");
          } finally {
              setIsAuthorizing(false);
          }
      } else {
          setPasswordError(true);
      }
  };

  useEffect(() => {
     checkAccess();
     const onFocus = () => checkAccess();
     window.addEventListener('focus', onFocus);
     return () => window.removeEventListener('focus', onFocus);
  }, []);

  if (status === 'authorized') return children;

  if (status === 'loading') {
      return (
          <Layout>
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-slate-200 dark:border-slate-700 border-t-blue-600 dark:border-t-blue-500 rounded-full animate-spin mx-auto" style={{ marginBottom: '16px' }} />
              <p className="text-muted-foreground text-sm font-medium">{t('verifyingNetwork')}</p>
            </div>
          </Layout>
      );
  }

  if (status === 'unauthorized_ip') {
      return (
        <Layout>
          <div className="text-center">
            <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto" style={{ marginBottom: '16px' }}>
               <Lock className="w-5 h-5" />
            </div>
            
            <h2 className="text-lg font-bold text-foreground" style={{ marginBottom: '8px' }}>{t('newDeviceDetected')}</h2>
             <p className="text-xs text-muted-foreground leading-relaxed" style={{ marginBottom: '24px' }}>
                {t('oneTimeAuthMessage')}
             </p>

              <div 
                className="inline-block bg-muted px-3 py-1.5 rounded-full text-[11px] font-mono text-muted-foreground border border-input"
                style={{ marginBottom: '24px' }}
              >
                {currentIp}
              </div>

             <form onSubmit={handlePasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                 <div style={{ textAlign: 'left', marginBottom: '4px' }}>
                    <p style={{ fontSize: '12px', lineHeight: '1.4', marginBottom: '8px' }} className="text-muted-foreground">
                      {t('enterPassword')}
                    </p>
                    <input 
                      type="password" 
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); setPasswordError(false); }}
                      className="w-full bg-background border border-input focus:border-primary focus:ring-1 focus:ring-primary px-3 py-3 text-foreground placeholder:text-muted-foreground outline-none transition-all text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      placeholder={t('passwordPlaceholder')}
                     autoFocus
                     disabled={isAuthorizing}
                     style={{ 
                       boxSizing: 'border-box',
                       borderRadius: '12px',
                       width: '100%'
                     }} 
                   />
                </div>
                
                {passwordError && (
                  <p className="text-red-500 text-xs font-medium">
                    {t('incorrectPassword')}
                  </p>
                )}
                {errorDetails && !passwordError && (
                   <p className="text-red-500 text-xs font-medium">
                     {errorDetails}
                   </p>
                )}

                <button 
                  type="submit" 
                  disabled={isAuthorizing}
                  className="w-full bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-semibold py-3 text-sm transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                  style={{ 
                    boxSizing: 'border-box',
                    borderRadius: '12px',
                    width: '100%',
                    cursor: isAuthorizing ? 'not-allowed' : 'pointer'
                  }}
                >
                   {isAuthorizing ? t('verifying') : t('authorizeDevice')}
                </button>
            </form>
          </div>
        </Layout>
      );
  }

  return (
      <Layout>
        <div className="text-center">
            <div className="w-10 h-10 bg-destructive/10 text-destructive rounded-full flex items-center justify-center mx-auto" style={{ marginBottom: '16px' }}>
                <ShieldAlert className="w-5 h-5" />
            </div>
            <h1 className="text-lg font-bold text-foreground" style={{ marginBottom: '8px' }}>{t('accessDenied')}</h1>
            <p className="text-xs text-muted-foreground leading-relaxed" style={{ marginBottom: '24px' }}>
                {status === 'unauthorized_location' 
                    ? t('unauthorizedLocationMessage')
                    : t('unauthorizedDefaultMessage')}
            </p>

            <div 
              className="bg-muted p-3 text-left border border-border"
              style={{ borderRadius: '12px', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}
            >
                <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground font-medium">{t('status')}</span>
                    <span className="text-destructive font-bold bg-background px-1.5 py-0.5 rounded border border-border">{t(status)}</span>
                </div>
                {locationStatus && (
                    <div className="flex justify-between items-center text-xs border-t border-border pt-2">
                        {locationStatus.error ? (
                            <span className="text-destructive w-full text-center font-medium">{locationStatus.error}</span>
                        ) : (
                            <>
                            <span className="text-muted-foreground font-medium">{t('distance')}</span>
                            <span className={`font-mono font-bold ${locationStatus.distance > LOCATION_RADIUS ? 'text-destructive' : 'text-green-600 dark:text-green-400'}`}>
                                {locationStatus.distance?.toFixed(0)}m / {LOCATION_RADIUS}m
                            </span>
                            </>
                        )}
                    </div>
                )}
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 mb-4 mx-auto max-w-[320px]">
                <div className="flex flex-col items-center gap-2 text-center">
                    <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                        {t('locationRequired')}
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                        {t('checkSettings')}
                    </p>
                </div>
            </div>
            
            <button 
                onClick={() => checkLocation(currentIp)}
                disabled={isCheckingLocation || permissionState === 'denied'}
                className="w-full bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-semibold py-3 text-sm transition-colors mb-3 rounded-xl shadow-lg shadow-blue-500/20 disabled:opacity-70 disabled:cursor-not-allowed disabled:bg-slate-400 disabled:shadow-none"
            >
                <div className="flex items-center justify-center gap-2">
                    {permissionState === 'denied' ? (
                        <>
                        <ShieldAlert className="w-4 h-4" />
                        <span>{t('accessDenied')} - {t('checkSettings')}</span>
                        </>
                    ) : (
                        <>
                        {isCheckingLocation ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
                        <span>{isCheckingLocation ? t('checking') : t('requestLocation')}</span>
                        </>
                    )}
                </div>
            </button>
            
            <button 
                onClick={() => window.location.reload()}
                className="w-full text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors py-2 rounded"
            >
                {t('reloadPage')}
            </button>
        </div>
      </Layout>
  );
};

export default NetworkGuard;
