import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { logAttendance, getTodayAttendance, deleteTodayAttendance, getAttendanceSheetUrl, clearAppCache } from '@/services/googleSheets';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Clock, CheckCircle, AlertTriangle, Settings, LogOut, Loader2, FileText, Globe } from 'lucide-react';
import { format, addHours, set, isAfter, isBefore, parseISO, startOfToday } from 'date-fns';
import { vi } from 'date-fns/locale';
import { getTranslation } from '@/utils/translations';
import { useNavigate } from 'react-router-dom';
import SettingsDialog from '@/components/SettingsDialog';
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from '@/hooks/useLanguage';

const OFFICE_START_LIMIT = 10; // 10 AM
const OFFICE_END_LIMIT = 19; // 7 PM
const WORK_HOURS = 8;
const LUNCH_BREAK_HOURS = 1;

// Helper to animate numbers
const AnimatedNumber = ({ value, className }) => (
  <div className={className}>
    {value.toString().split('').map((char, i) => (
      <span 
        key={`${i}-${char}`} 
        className="inline-block animate-blur-in will-change-transform"
      >
        {char}
      </span>
    ))}
  </div>
);

export default function Dashboard() {
  const { language, setLanguage } = useLanguage();
  const t = (key, params) => getTranslation(key, language, params);

  const [currentTime, setCurrentTime] = useState(new Date());
  const [checkInTime, setCheckInTime] = useState(null);
  const [email, setEmail] = useState('');
  const [emailPrefix, setEmailPrefix] = useState('');
  const [emailDomain, setEmailDomain] = useState('@litmers.com');
  const [displayName, setDisplayName] = useState('');
  const [manualTime, setManualTime] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [manualConfirmOpen, setManualConfirmOpen] = useState(false);
  const [instantConfirmOpen, setInstantConfirmOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [sheetUrl, setSheetUrl] = useState(`https://docs.google.com/spreadsheets/d/${import.meta.env.VITE_GOOGLE_SHEET_ID}`);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // Recent Emails Logic
  const [recentEmails, setRecentEmails] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(false);

  useEffect(() => {
    try {
        const stored = localStorage.getItem('cigr_recent_emails');
        if (stored) setRecentEmails(JSON.parse(stored));
    } catch (e) {
        console.error("Failed to load recent emails", e);
    }
  }, []);

  const saveToRecent = (prefix) => {
      if (!prefix) return;
      const updated = [prefix, ...recentEmails.filter(e => e !== prefix)].slice(0, 5);
      setRecentEmails(updated);
      localStorage.setItem('cigr_recent_emails', JSON.stringify(updated));
  };
  
  const navigate = useNavigate();
  
  const fullEmail = `${emailPrefix}${emailDomain}`;
  
  useEffect(() => {
    getAttendanceSheetUrl().then(url => {
        setSheetUrl(url);
    });
  }, []);

  // 1. Hydrate State (Run Once)
  useEffect(() => {
    const savedEmail = localStorage.getItem('cigr_email');
    if (savedEmail) setEmail(savedEmail);
    
    const savedName = localStorage.getItem('cigr_name');
    if (savedName) setDisplayName(savedName);
  }, []);

  // 2. Data Fetching (Run on Email Change)
  useEffect(() => {
    if (!email) return;

    const loadData = async (isBackground = false) => {
      if (!isBackground) setIsInitialLoading(true);
      try {
        console.log(`fetching data for ${email}...`);
        
        // Cache Check
        const cached = await getTodayAttendance(email);
        if (cached) {
          setCheckInTime(cached);
          if (!isBackground) setIsInitialLoading(false); // Show early if cache hits
        } else {
           if (!isBackground) setCheckInTime(null); 
        }
        
        // Fresh Fetch
        const fresh = await getTodayAttendance(email, true); 
        if (fresh) {
          setCheckInTime(fresh);
        } else {
          if (!cached) setCheckInTime(null);
        }
      } catch (e) {
        console.warn("Failed to load attendance:", e);
      } finally {
        if (!isBackground) setIsInitialLoading(false);
      }
    };
    
    loadData(false);
    
    const pollInterval = setInterval(() => loadData(true), 30000);
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    
    return () => {
      clearInterval(pollInterval);
      clearInterval(timer);
    };
  }, [email]); 

  const handleLogin = async () => {
    if (!emailPrefix.trim()) return;
    const fullEmail = `${emailPrefix.trim()}${emailDomain}`;
    const webhookUrl = import.meta.env.VITE_MS_FLOW_WEBHOOK;
    
    setIsLoading(true);

    try {
        // 1. Validate Email with Power Automate
        if (webhookUrl) {
            try {
                const response = await fetch(webhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/plain' }, // Proxied
                    body: JSON.stringify({ 
                        email: fullEmail,
                        type: 'validate-user' 
                    })
                });

                if (response.ok) {
                    const result = await response.json();
                    
                    if (result.valid === false) {
                        toast.error(t('emailNotFound'));
                        setIsLoading(false);
                        return; // Generic stop
                    }

                    if (result.name) {
                        localStorage.setItem('cigr_name', result.name);
                        setDisplayName(result.name);
                        const firstName = result.name.split(' ')[0].replace(/[,.]/g, '');
                        toast.success(t('welcomeBack', { name: firstName }));
                    }
                }
            } catch (validationError) {
                console.warn("Validation skipped or failed (Flow might be down)", validationError);
                // toast.error(t('validationFailed'));
            }
        }
    
        // 2. Trigger sync
        setEmail(fullEmail);
        localStorage.setItem('cigr_email', fullEmail);
        saveToRecent(emailPrefix.trim());
        
    } catch (e) {
        toast.error(t('error'));
    } finally {
        setIsLoading(false);
    }
  };

  const handleLogout = () => {
      localStorage.removeItem('cigr_email');
      
      // Nuclear cleanup to ensure fresh state
      clearAppCache();
      
      setEmail('');
      setEmailPrefix('');
      
      setCheckInTime(null);
      setLogoutConfirmOpen(false); // Reset dialog state
      toast.info(t('loggedOut'));
  };

  const getEstimatedEndTime = (startTime) => {
    if (!startTime) return null;
    let end = addHours(startTime, WORK_HOURS);
    
    if (startTime.getHours() < 12) {
      end = addHours(end, LUNCH_BREAK_HOURS);
    }
    return end;
  };

  const notifyCheckIn = async (email, date) => {
    const webhookUrl = import.meta.env.VITE_MS_FLOW_WEBHOOK;
    if (!webhookUrl) return;

    try {
        await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({ 
                email: email, 
                checkInTime: date.toISOString(),
                type: 'check-in' 
            })
        });
        console.log("Check-in notification sent");
    } catch (e) {
        console.error("Failed to send check-in notification", e);
    }
  };

  const attemptCheckIn = async (date) => {
    const hour = date.getHours();
    
    // Check constraints
    if (hour >= OFFICE_END_LIMIT) {
      toast.error(t('checkInClosed'));
      return;
    }

    // Save to Google Sheets
    setIsLoading(true);
    try {
        await logAttendance(email, date);
        setCheckInTime(date);
        toast.success(t('checkInAt', { time: format(date, 'HH:mm') }));
        
        // Fire and forget notification
        notifyCheckIn(email, date);
    } catch (e) {
        toast.error(t('error'));
    } finally {
        setIsLoading(false);
    }
  };

  const handleManualCheckInTrigger = () => {
    if (!manualTime) return;
    setManualConfirmOpen(true);
  };
  
  const confirmManualCheckIn = () => {
      const [h, m] = manualTime.split(':').map(Number);
      const date = set(new Date(), { hours: h, minutes: m, seconds: 0 });
      attemptCheckIn(date);
      setManualConfirmOpen(false);
  };

  const handleNowCheckIn = () => {
    const hour = new Date().getHours();
    if (hour >= OFFICE_START_LIMIT) {
        toast.error(t('autoCheckInLimit', { time: `${OFFICE_START_LIMIT}:00` }));
        return;
    }
    setInstantConfirmOpen(true);
  };
  
  const confirmInstantCheckIn = () => {
      attemptCheckIn(new Date());
      setInstantConfirmOpen(false);
  };
  
  const handleClearCheckIn = () => {
    setResetConfirmOpen(true);
  };

  const confirmClearCheckIn = async () => {
      setIsLoading(true);
      try {
          await deleteTodayAttendance(email);
          setCheckInTime(null);
          setResetConfirmOpen(false);
          toast.success(t('checkInCleared'));
      } catch (e) {
          toast.error(t('error'));
      } finally {
          setIsLoading(false);
      }
  };

  const endTime = getEstimatedEndTime(checkInTime);
  const progress100 = endTime ? endTime.getTime() : null;
  const now = currentTime.getTime();
  const start = checkInTime ? checkInTime.getTime() : null;
  
  // Calculate progress %
  let progress = 0;
  if (start && progress100) {
      const total = progress100 - start;
      const current = now - start;
      progress = Math.min(100, Math.max(0, (current / total) * 100));
  }

  // Auto-Notification Effect
  useEffect(() => {
     if (!checkInTime || !endTime || !email) return;
     
     const checkNoti = async () => {
         const notifiedKey = `cigr_notified_${email}_${format(checkInTime, 'yyyy-MM-dd')}`;
         const hasNotified = localStorage.getItem(notifiedKey);
         
         if (!hasNotified && currentTime >= endTime) {
             console.log("Triggering Notification...");
             try {
                // Not actually sending here anymore (handled differently or logic preserved)
                // But leaving localstorage lock
                
                localStorage.setItem(notifiedKey, 'true');
                toast.success(t('checkOutSuccess'));
             } catch (e) {
                 console.error("Failed to send notification", e);
             }
         }
     };
     
     const timer = setInterval(checkNoti, 60000); // Check every minute
     checkNoti(); // Check immediately
     
     return () => clearInterval(timer);
  }, [checkInTime, endTime, email]);


  // Language Toggle
  const LanguageToggleBtn = () => (
    <Button 
        variant="ghost" 
        size="icon" 
        className="fixed top-4 right-4 z-[9999] bg-white/50 dark:bg-black/50 backdrop-blur-md shadow-sm hover:bg-white/80 dark:hover:bg-black/80 rounded-full w-10 h-10"
        onClick={() => setLanguage(language === 'en' ? 'vi' : 'en')}
    >
        <div className="flex flex-col items-center justify-center">
            <span className="text-[10px] font-bold leading-none mb-0.5">{language === 'en' ? 'EN' : 'VN'}</span>
            <Globe className="w-3 h-3 opacity-70" />
        </div>
    </Button>
  );


  if (!email) {
      return (
          <div className="flex min-h-screen items-center justify-center p-4 bg-background relative">
              <LanguageToggleBtn />
              <Card className="w-full max-w-md">
                  <CardHeader>
                      <CardTitle>{t('welcomeTitle')}</CardTitle>
                      <CardDescription>{t('enterEmailDesc')}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-8 pt-4">
                      <div className="flex flex-col gap-10">
                          <Label className="text-base font-medium">{t('emailLabel')}</Label>
                          <div className="flex gap-2 relative z-20">
                             <div className="relative">
                                <Input 
                                    value={emailPrefix} 
                                    onChange={e => setEmailPrefix(e.target.value)} 
                                    onFocus={() => setShowSuggestions(true)}
                                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                                    placeholder="ocean"
                                    className="h-12 text-base md:text-base w-[140px] text-right pr-2"
                                    onKeyDown={e => e.key === 'Enter' && handleLogin()}
                                    autoComplete="off"
                                />
                                {(() => {
                                    const filtered = recentEmails.filter(e => e.toLowerCase().includes(emailPrefix.toLowerCase()));
                                    if (!showSuggestions || filtered.length === 0) return null;
                                    
                                    return (
                                        <div className="absolute top-full left-0 w-full mt-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md shadow-xl overflow-hidden z-50">
                                            {filtered.map((e, i) => (
                                                <div 
                                                    key={i}
                                                    className="px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-900 cursor-pointer text-sm text-right transition-colors"
                                                    onClick={() => {
                                                        setEmailPrefix(e);
                                                    }}
                                                >
                                                    {e}
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })()}
                             </div>
                              <Select value={emailDomain} onValueChange={setEmailDomain}>
                                <SelectTrigger className="h-12 text-base flex-1 cursor-pointer">
                                    <SelectValue placeholder={t('emailDomain')} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="@litmers.com">@litmers.com</SelectItem>
                                    <SelectItem value="@cigro.io">@cigro.io</SelectItem>
                                </SelectContent>
                              </Select>
                          </div>
                      </div>
                      <Button 
                        onClick={handleLogin} 
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold h-12 text-base rounded-xl shadow-lg shadow-blue-900/10 transition-all hover:scale-[1.02] disabled:opacity-50 disabled:grayscale"
                        disabled={!emailPrefix.trim() || isLoading}
                      >
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                        {isLoading ? t('loading') : t('signIn')}
                      </Button>
                  </CardContent>
              </Card>
          </div>
      );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 flex flex-col items-center relative">
      <LanguageToggleBtn />
      
      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-background/95 backdrop-blur-xl z-50 flex flex-col items-center justify-center animate-in fade-in duration-200">
           <Loader2 className="h-16 w-16 animate-spin text-blue-600 dark:text-blue-500 mb-4" />
           <p className="text-muted-foreground font-medium animate-pulse">{t('processing')}</p>
        </div>
      )}
      
      {/* Vibe-coded credit */}
      <div className="w-full text-center px-4 mb-4 z-10">
        <div className="inline-block border border-border/50 rounded-md px-3 py-2 bg-muted/30 backdrop-blur-sm shadow-sm pointer-events-auto">
          <p className="text-xs m-0 text-muted-foreground leading-relaxed">
            {t('vibeCodedBy')}{' '}
            <span className="text-foreground font-medium whitespace-nowrap">Ocean LITMERS</span>
            {' · '}
            <a 
              href="https://github.com/oceanondawave/SwaggerNav" 
              target="_blank" 
              rel="noopener noreferrer"
              className="underline hover:text-blue-500 transition-colors whitespace-nowrap"
            >
              {t('checkAnotherWork')}
            </a>
            {' · '}
            <a 
              href="https://cigromeetingroomsbooking.vercel.app/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="underline hover:text-blue-500 transition-colors whitespace-nowrap"
            >
              {t('checkMeetingRooms')}
            </a>
            {' · '}
            <a 
              href="https://github.com/cigrocean/CigroAttendanceNoti" 
              target="_blank" 
              rel="noopener noreferrer"
              className="underline hover:text-blue-500 transition-colors whitespace-nowrap"
            >
              {t('github')}
            </a>
          </p>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center w-full">
        <div className="w-full max-w-md md:max-w-4xl lg:max-w-6xl flex flex-col gap-3">

            {displayName && (
                <div className="animate-in fade-in slide-in-from-left-2 duration-500 px-1">
                    <h1 className="text-lg md:text-xl font-medium text-muted-foreground flex items-center gap-2">
                        {(() => {
                            const h = currentTime.getHours();
                            if (h < 12) return t('goodMorning');
                            if (h < 18) return t('goodAfternoon');
                            return t('goodEvening');
                        })()} <span className="text-foreground font-bold">{displayName.split(' ')[0].replace(/[,.]/g, '')}</span>
                    </h1>
                </div>
            )}
            
            {isInitialLoading ? (
                 <Card className="w-full shadow-xl border-t-4 border-t-muted">
                    <CardHeader className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between space-y-0 pb-2 gap-4">
                        <div className="space-y-2">
                             <Skeleton className="h-8 w-48" />
                             <Skeleton className="h-4 w-32" />
                             <Skeleton className="h-5 w-40" />
                        </div>
                        <div className="flex gap-2 w-full sm:w-auto">
                            <Skeleton className="h-9 w-20" />
                            <Skeleton className="h-9 w-20" />
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-8 pt-6">
                        <div className="flex flex-col items-center gap-6">
                            <div className="space-y-2 flex flex-col items-center">
                                <Skeleton className="h-16 w-32" />
                                <Skeleton className="h-4 w-24" />
                            </div>
                            <Skeleton className="h-32 w-32 rounded-full" />
                            <Skeleton className="h-4 w-40" />
                        </div>
                    </CardContent>
                 </Card>
            ) : (
            <Card className="w-full shadow-xl border-t-4 border-t-blue-600">
            <CardHeader className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between space-y-0 pb-2 gap-4">
            <div>
                <CardTitle className="text-2xl font-bold">{t('officeCheckIn')}</CardTitle>
                <CardDescription>
                    {format(currentTime, language === 'vi' ? 'EEEE, d MMMM, yyyy' : 'EEEE, MMMM do yyyy', { locale: language === 'vi' ? vi : undefined })}
                </CardDescription>
                <div className="text-xs text-muted-foreground mt-1 font-mono bg-muted/50 px-2 py-0.5 rounded-md inline-block w-fit truncate max-w-[200px]" title={email}>
                {email}
                </div>
            </div>
            <div className="flex flex-col gap-2 w-full sm:w-auto sm:items-end">
                <div className="flex gap-2 w-full">
                    <Button variant="outline" size="sm" onClick={() => navigate('/records')} className="flex-1 text-muted-foreground hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/30 hover:border-purple-200 dark:hover:border-purple-800 transition-colors">
                        <FileText className="w-4 h-4 mr-2" />
                        {t('records')}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => window.open(sheetUrl, '_blank')} className="flex-1 text-muted-foreground hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 hover:border-blue-200 dark:hover:border-blue-800 transition-colors">
                        <FileText className="w-4 h-4 mr-2" />
                        {t('sheet')}
                    </Button>
                </div>
                <div className="flex gap-2 w-full">
                    <Button variant="outline" size="sm" onClick={() => setIsSettingsOpen(true)} className="flex-1 text-muted-foreground hover:text-slate-900 dark:hover:text-slate-50 hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors">
                        <Settings className="w-4 h-4 mr-2" />
                        {t('settings')}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setLogoutConfirmOpen(true)} disabled={isLoading} className="flex-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 border-red-200 dark:border-red-900 transition-colors">
                        <LogOut className="w-4 h-4 mr-2" />
                        {t('signOut')}
                    </Button>
                </div>
            </div>
          </CardHeader>
            
            <CardContent className="space-y-8 pt-6">
            {/* Main Status Area */}
            <div className="text-center space-y-2">
                <AnimatedNumber 
                   value={format(currentTime, 'HH:mm')} 
                   className="text-6xl font-black tracking-widest text-foreground tabular-nums flex justify-center"
                />
                <div className="text-sm font-medium text-muted-foreground uppercase tracking-widest">{t('currentTime')}</div>
            </div>

            {!checkInTime ? (
                <div className="flex flex-col gap-6 items-center">
                    <div className="relative">
                        <div className="absolute inset-0 bg-blue-500 rounded-full blur-xl opacity-20 animate-pulse pointer-events-none"></div>
                        <Button 
                            size="lg" 
                            className="relative z-10 bg-blue-600 hover:bg-blue-700 text-white h-32 w-32 rounded-full shadow-2xl transition-all duration-300 transform hover:scale-105 active:scale-95 flex flex-col items-center justify-center gap-2 border-4 border-blue-100 dark:border-blue-900 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                            onClick={handleNowCheckIn}
                            disabled={isLoading}
                        >
                            {isLoading ? <Loader2 className="w-8 h-8 animate-spin" /> : <Clock className="w-8 h-8" />}
                            <span className="font-bold text-lg">{isLoading ? 'Wait' : t('checkIn')}</span>
                        </Button>
                    </div>
                    {currentTime.getHours() >= OFFICE_START_LIMIT && currentTime.getHours() < OFFICE_END_LIMIT && (
                        <div className="text-center space-y-2">
                            <p className="text-sm text-amber-600 dark:text-amber-400 font-medium bg-amber-50 dark:bg-amber-950/30 px-4 py-2 rounded-lg flex items-center justify-center gap-2">
                                <AlertTriangle className="w-4 h-4" />
                                {t('instantClosed', { time: `${OFFICE_START_LIMIT}:00` })}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                {t('useManualEntry')}
                            </p>
                        </div>
                    )}
                    {currentTime.getHours() >= OFFICE_END_LIMIT && (
                        <p className="text-sm text-red-500 font-medium bg-red-50 dark:bg-red-950/30 px-3 py-1 rounded-full">
                            {t('checkInClosed')}
                        </p>
                    )}
                    
                    <div className="w-full pt-4 border-t border-border">
                        <details className="group cursor-pointer">
                            <summary className="text-xs font-medium text-muted-foreground uppercase tracking-widest text-center hover:text-foreground transition-colors list-none">
                                {t('manualEntryTrigger')}
                            </summary>
                            <div className="mt-4 flex flex-col gap-3 animate-in fade-in slide-in-from-top-2">
                                <div className="flex gap-2">
                                    <Input 
                                        type="time" 
                                        value={manualTime} 
                                        onChange={e => setManualTime(e.target.value)} 
                                        className="flex-1 text-center font-mono text-lg tracking-widest"
                                        disabled={currentTime.getHours() >= OFFICE_END_LIMIT}
                                    />
                                    <Button 
                                        variant="secondary" 
                                        onClick={handleManualCheckInTrigger}
                                        disabled={currentTime.getHours() >= OFFICE_END_LIMIT || isLoading}
                                        >
                                            {t('setCheckIn')}
                                        </Button>
                                </div>
                                <p className="text-[10px] text-center text-muted-foreground">
                                    {currentTime.getHours() >= OFFICE_END_LIMIT 
                                        ? t('checkInClosed')
                                        : t('manualEntryDesc')}
                                </p>
                            </div>
                        </details>

                {/* Instant Check-in Confirm Dialog */}
                <Dialog open={instantConfirmOpen} onOpenChange={setInstantConfirmOpen}>
                    <DialogContent className="!bg-white dark:!bg-slate-950 text-slate-900 dark:text-slate-50 border-slate-200 dark:border-slate-800 sm:max-w-md z-[100] shadow-2xl">
                        <DialogHeader>
                            <DialogTitle>{t('confirmInstant')}</DialogTitle>
                            <DialogDescription>
                                {t('confirmInstantDesc', { time: format(currentTime, 'HH:mm') })}
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setInstantConfirmOpen(false)} disabled={isLoading}>
                                {t('cancel')}
                            </Button>
                            <Button onClick={confirmInstantCheckIn} disabled={isLoading} className="bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-600 dark:hover:bg-blue-700 disabled:opacity-50">
                                {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                                {t('confirm')}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Manual Confirm Dialog */}
                <Dialog open={manualConfirmOpen} onOpenChange={setManualConfirmOpen}>
                    <DialogContent className="!bg-white dark:!bg-slate-950 text-slate-900 dark:text-slate-50 border-slate-200 dark:border-slate-800 sm:max-w-md z-[100] shadow-2xl">
                        <DialogHeader>
                            <DialogTitle>{t('confirmManual')}</DialogTitle>
                            <DialogDescription>
                                {t('confirmManualDesc', { time: manualTime })}
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <Button onClick={confirmManualCheckIn} disabled={isLoading} className="bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-600 dark:hover:bg-blue-700 disabled:opacity-50">
                                {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                                {t('confirm')}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
            </div>
            ) : (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                    <div className="bg-green-500/10 dark:bg-green-500/20 border border-green-500/20 dark:border-green-500/30 rounded-2xl p-6 text-center space-y-4">
                        <div className="flex items-center justify-center text-green-600 dark:text-green-400 space-x-2">
                            <CheckCircle className="w-5 h-5" />
                            <span className="font-semibold">{t('checkInSuccess')}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <div className="text-xs text-green-600/70 dark:text-green-400/70 font-medium uppercase">{t('started')}</div>
                                <div className="text-xl font-bold text-green-700 dark:text-green-300">{format(checkInTime, 'HH:mm')}</div>
                            </div>
                            <div>
                                <div className="text-xs text-green-600/70 dark:text-green-400/70 font-medium uppercase">{t('finished')}</div>
                                <div className="text-xl font-bold text-green-700 dark:text-green-300">
                                    {endTime ? format(endTime, 'HH:mm') : '--:--'}
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    {/* Progress Bar */}
                    <div className="space-y-2">
                        <div className="flex justify-between text-xs font-medium text-muted-foreground">
                            <span>{t('progress')}</span>
                            <AnimatedNumber value={`${Math.round(progress)}%`} className="flex" />
                        </div>
                        <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden relative">
                             {/* Glossy Shimmer Logic */}
                            <div 
                                className="h-full bg-blue-600 dark:bg-blue-500 transition-all duration-1000 ease-out relative overflow-hidden" 
                                style={{ width: `${progress}%` }}
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent w-full -translate-x-full animate-[shimmer_2s_infinite]"></div>
                            </div>
                        </div>
                    </div>

                    <Button variant="outline" disabled={isLoading} className="w-full text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/30 border-red-200 dark:border-red-800 disabled:opacity-50" onClick={handleClearCheckIn}>
                        {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <LogOut className="w-4 h-4 mr-2" />}
                        {isLoading ? t('processing') : t('cancelReset')}
                    </Button>
                </div>
            )}

                {/* Logout Confirmation Dialog */}
                <Dialog open={logoutConfirmOpen} onOpenChange={setLogoutConfirmOpen}>
                    <DialogContent className="!bg-white dark:!bg-slate-950 text-slate-900 dark:text-slate-50 border-slate-200 dark:border-slate-800 sm:max-w-md z-[100] shadow-2xl">
                        <DialogHeader>
                            <DialogTitle>{t('signOut')}</DialogTitle>
                            <DialogDescription>
                                {t('confirmSignOutDesc')}
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setLogoutConfirmOpen(false)} disabled={isLoading}>
                                {t('cancel')}
                            </Button>
                            <Button onClick={handleLogout} disabled={isLoading} className="bg-red-600 hover:bg-red-700 text-white">
                                {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <LogOut className="w-4 h-4 mr-2" />}
                                {t('signOut')}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Reset Confirmation Dialog */}
                <Dialog open={resetConfirmOpen} onOpenChange={setResetConfirmOpen}>
                    <DialogContent className="!bg-white dark:!bg-slate-950 text-slate-900 dark:text-slate-50 border-slate-200 dark:border-slate-800 sm:max-w-md z-[100] shadow-2xl">
                        <DialogHeader>
                            <DialogTitle>{t('cancelReset')}</DialogTitle>
                            <DialogDescription>
                                {t('deleteRecordDesc')}
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setResetConfirmOpen(false)} disabled={isLoading}>
                                {t('cancel')}
                            </Button>
                            <Button onClick={confirmClearCheckIn} disabled={isLoading} className="bg-red-600 hover:bg-red-700 text-white">
                                {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <AlertTriangle className="w-4 h-4 mr-2" />}
                                {t('deleteRecord')}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Disclaimer Section (Bottom) */}
                <div className="mt-8 p-4 rounded-xl border border-amber-200/50 bg-amber-50/80 dark:bg-amber-950/20 dark:border-amber-800/30 flex gap-3 items-start animate-in fade-in slide-in-from-bottom-2 duration-700 delay-200">
                    <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
                    <div className="text-sm text-amber-900 dark:text-amber-200/90">
                        <p className="font-semibold mb-1 text-amber-950 dark:text-amber-100">{t('disclaimerTitle')}</p>
                        <p className="leading-relaxed opacity-90">
                           <span dangerouslySetInnerHTML={{ __html: t('disclaimerText') }} />
                        </p>
                    </div>
                </div>

            </CardContent>
        </Card>
        )}
        </div>
      {/* Settings Dialog (Must be inside root) */}
      <SettingsDialog 
        key={email} // Force destroy/remount when user changes
        open={isSettingsOpen} 
        onOpenChange={setIsSettingsOpen} 
        email={email} 
      />
    </div>
    </div>
  );

}
