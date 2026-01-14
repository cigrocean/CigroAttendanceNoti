import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { logAttendance, getTodayAttendance, deleteTodayAttendance, getAttendanceSheetUrl, clearAppCache } from '@/services/googleSheets';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Clock, CheckCircle, AlertTriangle, Settings, LogOut, Loader2, FileText } from 'lucide-react';
import { format, addHours, set, isAfter, isBefore, parseISO, startOfToday } from 'date-fns';
import { getTranslation } from '@/utils/translations';
import { useNavigate } from 'react-router-dom';

const OFFICE_START_LIMIT = 10; // 10 AM
const OFFICE_END_LIMIT = 19; // 7 PM
const WORK_HOURS = 8;
const LUNCH_BREAK_HOURS = 1;

export default function Dashboard() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [checkInTime, setCheckInTime] = useState(null);
  const [email, setEmail] = useState('');
  const [emailPrefix, setEmailPrefix] = useState('');
  const [emailDomain, setEmailDomain] = useState('@litmers.com');
  // const [welcomeEmail, setWelcomeEmail] = useState(''); // Deprecated
  const [manualTime, setManualTime] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [manualConfirmOpen, setManualConfirmOpen] = useState(false);
  const [instantConfirmOpen, setInstantConfirmOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [sheetUrl, setSheetUrl] = useState(`https://docs.google.com/spreadsheets/d/${import.meta.env.VITE_GOOGLE_SHEET_ID}`);
  const navigate = useNavigate();
  
  const t = (key) => getTranslation(key);

  useEffect(() => {
    getAttendanceSheetUrl().then(url => {
        setSheetUrl(url);
    });
  }, []);

  // Load state on mount
  useEffect(() => {
    const savedEmail = localStorage.getItem('cigr_email');
    if (!savedEmail) return;
    
    setEmail(savedEmail);
    
    const loadData = async () => {
      try {
        // Show cached data immediately (non-blocking)
        const cached = await getTodayAttendance(savedEmail);
        if (cached) {
          setCheckInTime(cached);
        }
        
        // Then fetch fresh data in background
        const fresh = await getTodayAttendance(savedEmail, true); // skipCache = true
        if (fresh) {
          setCheckInTime(fresh);
        }
      } catch (e) {
        console.warn("Failed to load attendance:", e);
      }
    };
    
    loadData();
    
    // Poll every 30 seconds for fresh data
    const pollInterval = setInterval(loadData, 30000);
    
    // Also keep the clock ticking
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    
    return () => {
      clearInterval(pollInterval);
      clearInterval(timer);
    };
  }, []);

  const handleLogin = async () => {
    if (!emailPrefix.trim()) return;
    const fullEmail = `${emailPrefix.trim()}${emailDomain}`;
    
    setIsLoading(true);
    
    // Trigger sync
    try {
        const date = await getTodayAttendance(fullEmail);
        setEmail(fullEmail);
        localStorage.setItem('cigr_email', fullEmail);
        
        if (date) {
            setCheckInTime(date);
            toast.success("Restored check-in from cloud");
        }
    } catch (e) {
        toast.error("Failed to login/sync");
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
      toast.info("Logged out successfully");
  };

  const getEstimatedEndTime = (startTime) => {
    if (!startTime) return null;
    let end = addHours(startTime, WORK_HOURS);
    
    // If started before 12:00, add 1 hour lunch break
    // Logic: If the work period overlaps with 12:00-13:00, add 1 hour.
    // Simplification: If start < 12:00, add 1 hour.
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
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                email: email, 
                checkInTime: date.toISOString(),
                type: 'check-in' 
            })
        });
        // We don't show toast for this to avoid clutter, just log it
        console.log("Check-in notification sent");
    } catch (e) {
        console.error("Failed to send check-in notification", e);
    }
  };

  const attemptCheckIn = async (date) => {
    const hour = date.getHours();
    
    // Check constraints
    if (hour >= OFFICE_END_LIMIT) {
      toast.error(`Cannot check in after ${OFFICE_END_LIMIT}:00`);
      return;
    }

    // Save to Google Sheets
    setIsLoading(true);
    try {
        await logAttendance(email, date);
        setCheckInTime(date);
        toast.success(`Checked in at ${format(date, 'HH:mm')}`);
        
        // Fire and forget notification
        notifyCheckIn(email, date);
    } catch (e) {
        toast.error("Failed to save check-in. Please try again.");
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
        toast.error(`Auto check-in only available before ${OFFICE_START_LIMIT}:00. Use Manual Entry.`);
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
          toast.success("Check-in cleared and deleted from cloud");
      } catch (e) {
          toast.error("Failed to delete from cloud. Please try again.");
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
         const notifiedKey = `cigr_notified_${format(checkInTime, 'yyyy-MM-dd')}`;
         const hasNotified = localStorage.getItem(notifiedKey);
         
         if (!hasNotified && currentTime >= endTime) {
             console.log("Triggering Notification...");
             try {
                // Call API
                const webhookUrl = import.meta.env.VITE_MS_FLOW_WEBHOOK;
                if (!webhookUrl) {
                    console.warn("No Webhook URL configured");
                    return;
                }
                
                /*
                // Handled by Google Apps Script server-side to prevent duplicates
                await fetch(webhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: email, checkInTime: checkInTime.toISOString() })
                });
                */
                
                localStorage.setItem(notifiedKey, 'true');
                toast.success("Checkout notification sent to Flow Bot!");
             } catch (e) {
                 console.error("Failed to send notification", e);
             }
         }
     };
     
     const timer = setInterval(checkNoti, 60000); // Check every minute
     checkNoti(); // Check immediately
     
     return () => clearInterval(timer);
  }, [checkInTime, endTime, email]);


  if (!email) {
      return (
          <div className="flex min-h-screen items-center justify-center p-4 bg-background">
              <Card className="w-full max-w-md">
                  <CardHeader>
                      <CardTitle>Welcome</CardTitle>
                      <CardDescription>Please enter your Email to continue</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-8 pt-4">
                      <div className="flex flex-col gap-10">
                          <Label className="text-base font-medium">Email (for notification)</Label>
                          <div className="flex gap-2">
                             <Input 
                                value={emailPrefix} 
                                onChange={e => setEmailPrefix(e.target.value)} 
                                placeholder="ocean"
                                className="h-12 text-base md:text-base w-[140px] text-right pr-2"
                                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                              />
                              <Select value={emailDomain} onValueChange={setEmailDomain}>
                                <SelectTrigger className="h-12 text-base flex-1 cursor-pointer">
                                    <SelectValue placeholder="Select domain" />
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
                        {isLoading ? "Signing In..." : "Sign In"}
                      </Button>
                  </CardContent>
              </Card>
          </div>
      );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 flex flex-col items-center relative">
      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-background/95 backdrop-blur-xl z-50 flex flex-col items-center justify-center animate-in fade-in duration-200">
           <Loader2 className="h-16 w-16 animate-spin text-blue-600 dark:text-blue-500 mb-4" />
           <p className="text-muted-foreground font-medium animate-pulse">Syncing with cloud...</p>
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
              Check Meeting Rooms
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

      <div className="flex-1 flex items-center justify-center w-full">
        <Card className="w-full max-w-lg shadow-xl border-t-4 border-t-blue-600">
            {/* Card Content... */}
            <CardHeader className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between space-y-0 pb-2 gap-4">
            <div>
                <CardTitle className="text-2xl font-bold">Office Check-in</CardTitle>
                <CardDescription>{format(currentTime, 'EEEE, MMMM do yyyy')}</CardDescription>
                <div className="text-xs text-muted-foreground mt-1 font-mono bg-muted/50 px-2 py-0.5 rounded-md inline-block w-fit truncate max-w-[200px]" title={email}>
                {email}
                </div>
            </div>
            <div className="flex flex-col gap-2 w-full sm:w-auto sm:items-end">
                <div className="flex gap-2 w-full">
                    <Button variant="outline" size="sm" onClick={() => navigate('/records')} className="flex-1 text-muted-foreground hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/30 hover:border-purple-200 dark:hover:border-purple-800 transition-colors">
                        <FileText className="w-4 h-4 mr-2" />
                        Records
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => window.open(sheetUrl, '_blank')} className="flex-1 text-muted-foreground hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 hover:border-blue-200 dark:hover:border-blue-800 transition-colors">
                        <FileText className="w-4 h-4 mr-2" />
                        Sheet
                    </Button>
                </div>
                <Button variant="outline" size="sm" onClick={() => setLogoutConfirmOpen(true)} disabled={isLoading} className="text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 hover:border-red-200 dark:hover:border-red-800 transition-colors w-full">
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign Out
                </Button>
            </div>
            </CardHeader>
            
            <CardContent className="space-y-8 pt-6">
            {/* Main Status Area */}
            <div className="text-center space-y-2">
                <div className="text-6xl font-black tracking-widest text-foreground tabular-nums">
                    {format(currentTime, 'HH:mm')}
                </div>
                <div className="text-sm font-medium text-muted-foreground uppercase tracking-widest">Current Time</div>
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
                            <span className="font-bold text-lg">{isLoading ? 'Wait' : 'Check In'}</span>
                        </Button>
                    </div>
                    {currentTime.getHours() >= OFFICE_START_LIMIT && currentTime.getHours() < OFFICE_END_LIMIT && (
                        <div className="text-center space-y-2">
                            <p className="text-sm text-amber-600 dark:text-amber-400 font-medium bg-amber-50 dark:bg-amber-950/30 px-4 py-2 rounded-lg flex items-center justify-center gap-2">
                                <AlertTriangle className="w-4 h-4" />
                                Instant check-in closed after {OFFICE_START_LIMIT}:00 AM
                            </p>
                            <p className="text-xs text-muted-foreground">
                                Please use <strong>Manual Entry</strong> below to check in
                            </p>
                        </div>
                    )}
                    {currentTime.getHours() >= OFFICE_END_LIMIT && (
                        <p className="text-sm text-red-500 font-medium bg-red-50 dark:bg-red-950/30 px-3 py-1 rounded-full">
                            Check-in closed for the day
                        </p>
                    )}
                    
                    <div className="w-full pt-4 border-t border-border">
                        <details className="group cursor-pointer">
                            <summary className="text-xs font-medium text-muted-foreground uppercase tracking-widest text-center hover:text-foreground transition-colors list-none">
                                Use Manual Entry
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
                                        >Set</Button>
                                </div>
                                <p className="text-[10px] text-center text-muted-foreground">
                                    {currentTime.getHours() >= OFFICE_END_LIMIT 
                                        ? `Check-in closed for the day (after ${OFFICE_END_LIMIT}:00)`
                                        : `Useful for late check-ins (after ${OFFICE_START_LIMIT}:00)`}
                                </p>
                            </div>
                        </details>

                {/* Instant Check-in Confirm Dialog */}
                <Dialog open={instantConfirmOpen} onOpenChange={setInstantConfirmOpen}>
                    <DialogContent className="!bg-white dark:!bg-slate-950 text-slate-900 dark:text-slate-50 border-slate-200 dark:border-slate-800 sm:max-w-md z-[100] shadow-2xl">
                        <DialogHeader>
                            <DialogTitle>Confirm Instant Check-in</DialogTitle>
                            <DialogDescription>
                                Are you sure you want to check in now at <span className="font-bold text-foreground">{format(currentTime, 'HH:mm')}</span>?
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setInstantConfirmOpen(false)} disabled={isLoading}>
                                Cancel
                            </Button>
                            <Button onClick={confirmInstantCheckIn} disabled={isLoading} className="bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-600 dark:hover:bg-blue-700 disabled:opacity-50">
                                {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                                Confirm Check-in
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Manual Confirm Dialog */}
                <Dialog open={manualConfirmOpen} onOpenChange={setManualConfirmOpen}>
                    <DialogContent className="!bg-white dark:!bg-slate-950 text-slate-900 dark:text-slate-50 border-slate-200 dark:border-slate-800 sm:max-w-md z-[100] shadow-2xl">
                        <DialogHeader>
                            <DialogTitle>Confirm Manual Entry</DialogTitle>
                            <DialogDescription>
                                Confirm checking in at <span className="font-bold text-foreground">{manualTime}</span>?
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <Button onClick={confirmManualCheckIn} disabled={isLoading} className="bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-600 dark:hover:bg-blue-700 disabled:opacity-50">
                                {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                                Confirm
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
                            <span className="font-semibold">Checked In</span>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <div className="text-xs text-green-600/70 dark:text-green-400/70 font-medium uppercase">Start</div>
                                <div className="text-xl font-bold text-green-700 dark:text-green-300">{format(checkInTime, 'HH:mm')}</div>
                            </div>
                            <div>
                                <div className="text-xs text-green-600/70 dark:text-green-400/70 font-medium uppercase">Finish</div>
                                <div className="text-xl font-bold text-green-700 dark:text-green-300">
                                    {endTime ? format(endTime, 'HH:mm') : '--:--'}
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    {/* Progress Bar */}
                    <div className="space-y-2">
                        <div className="flex justify-between text-xs font-medium text-muted-foreground">
                            <span>Progress</span>
                            <span>{Math.round(progress)}%</span>
                        </div>
                        <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-blue-600 dark:bg-blue-500 transition-all duration-1000 ease-out" 
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>

                    <Button variant="outline" disabled={isLoading} className="w-full text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/30 border-red-200 dark:border-red-800 disabled:opacity-50" onClick={handleClearCheckIn}>
                        {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <LogOut className="w-4 h-4 mr-2" />}
                        {isLoading ? 'Processing...' : 'Cancel / Reset Check-in'}
                    </Button>
                </div>
            )}

                {/* Logout Confirmation Dialog */}
                <Dialog open={logoutConfirmOpen} onOpenChange={setLogoutConfirmOpen}>
                    <DialogContent className="!bg-white dark:!bg-slate-950 text-slate-900 dark:text-slate-50 border-slate-200 dark:border-slate-800 sm:max-w-md z-[100] shadow-2xl">
                        <DialogHeader>
                            <DialogTitle>Sign Out</DialogTitle>
                            <DialogDescription>
                                Are you sure you want to sign out? You will need to re-verify via email next time.
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setLogoutConfirmOpen(false)} disabled={isLoading}>
                                Cancel
                            </Button>
                            <Button onClick={handleLogout} disabled={isLoading} className="bg-red-600 hover:bg-red-700 text-white">
                                {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <LogOut className="w-4 h-4 mr-2" />}
                                Sign Out
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Reset Confirmation Dialog */}
                <Dialog open={resetConfirmOpen} onOpenChange={setResetConfirmOpen}>
                    <DialogContent className="!bg-white dark:!bg-slate-950 text-slate-900 dark:text-slate-50 border-slate-200 dark:border-slate-800 sm:max-w-md z-[100] shadow-2xl">
                        <DialogHeader>
                            <DialogTitle>Cancel / Reset Check-in</DialogTitle>
                            <DialogDescription>
                                Are you sure? This will delete the record from Google Sheets.
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setResetConfirmOpen(false)} disabled={isLoading}>
                                Cancel
                            </Button>
                            <Button onClick={confirmClearCheckIn} disabled={isLoading} className="bg-red-600 hover:bg-red-700 text-white">
                                {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <AlertTriangle className="w-4 h-4 mr-2" />}
                                Delete Record
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </CardContent>
        </Card>
      </div>

    </div>
  );

}
