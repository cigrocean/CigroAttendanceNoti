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

const Layout = ({ children }) => (
  <div className="fixed inset-0 z-[9999] bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 font-sans">
    <div 
      className="bg-card text-card-foreground shadow-2xl animate-in fade-in zoom-in-95 duration-200"
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

const NetworkGuard = ({ children }) => {
  const { language } = useLanguage();
  // Status: loading, authorized, unauthorized_ip (needs password), unauthorized_location, error
  const [status, setStatus] = useState('loading');
  const [currentIp, setCurrentIp] = useState('');
  const [locationStatus, setLocationStatus] = useState(null); // { distance, accuracy, error }
  const [isCheckingLocation, setIsCheckingLocation] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState(false);
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [errorDetails, setErrorDetails] = useState('');

  const checkAccess = async () => {
    try {
       // 1. Get Public IP
       const ipRes = await fetch('https://api.ipify.org?format=json');
       if (!ipRes.ok) throw new Error('Failed to fetch IP');
       const { ip } = await ipRes.json();
       setCurrentIp(ip);
       console.log('Network Check - Current IP:', ip);

       // 2. Check Authorized Networks (Shared Sheet)
       try {
         const authorizedOps = await fetchAuthorizedNetworks();
         if (authorizedOps.includes(ip)) {
             setStatus('authorized');
             return;
         }
       } catch (netErr) {
         console.warn("Failed to check authorized networks, falling back to location:", netErr);
       }

       // 3. New IP detected -> Check Location first
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
     setLocationStatus(null); // Clear previous status/error

     navigator.geolocation.getCurrentPosition(
        (position) => {
            setIsCheckingLocation(false);
            const { latitude, longitude, accuracy } = position.coords;
            const distance = getDistanceFromLatLonInMeters(
                latitude, longitude,
                ALLOWED_LOCATION[0], ALLOWED_LOCATION[1]
            );

            setLocationStatus({ distance, accuracy });
            console.log(`Location Check: ${distance.toFixed(0)}m (Limit: ${LOCATION_RADIUS}m)`);
            
            // Show feedback
            toast.dismiss(); // Clear previous
            toast.success(`Location updated: ${distance.toFixed(0)}m away`);

            if (distance <= LOCATION_RADIUS) {
                // Location Passed -> Prompt for Password
                setStatus('unauthorized_ip');
            } else {
                setStatus('unauthorized_location');
            }
        },
        (err) => {
            setIsCheckingLocation(false);
            console.error("Location error:", err);
            let msg = err.message;
            let isDenied = false;

            if (err.code === 1) {
                msg = "Location permission denied.";
                isDenied = true;
            }
            if (err.code === 2) msg = "Location unavailable.";
            if (err.code === 3) msg = "Location request timed out.";
            
            setErrorDetails(msg);
            setLocationStatus({ error: msg });
            setStatus('unauthorized_location');
            
            toast.dismiss();
            toast.error(msg);


        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
     );
  };

  const handlePasswordSubmit = async (e) => {
      e.preventDefault();
      setPasswordError(false);
      setErrorDetails('');
      
      if (password === OFFICE_WIFI_PASSWORD) {
          setIsAuthorizing(true);
          try {
              // Write to Sheet
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

  const t = (key) => getTranslation(key, language);

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

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-3 mb-2">
                <p className="text-xs text-blue-700 dark:text-blue-300 font-medium leading-relaxed text-center flex items-center justify-center gap-1">
                    Please enable <strong>Location Access</strong> in your browser settings (<Lock className="w-3 h-3 inline" /> icon) and reload.
                </p>
            </div>
            
            <button 
                onClick={() => window.location.reload()}
                className="w-full text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors py-2 rounded"
            >
                Reload Page
            </button>
        </div>
      </Layout>
  );
};

export default NetworkGuard;
