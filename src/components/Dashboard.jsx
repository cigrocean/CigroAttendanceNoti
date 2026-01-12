import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { logAttendance, getTodayAttendance, deleteTodayAttendance } from '@/services/googleSheets';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Clock, CheckCircle, AlertTriangle, Settings, LogOut, Loader2 } from 'lucide-react';
import { format, addHours, set, isAfter, isBefore, parseISO, startOfToday } from 'date-fns';

const OFFICE_START_LIMIT = 10; // 10 AM
const OFFICE_END_LIMIT = 19; // 7 PM
const WORK_HOURS = 8;
const LUNCH_BREAK_HOURS = 1;

export default function Dashboard() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [checkInTime, setCheckInTime] = useState(null);
  const [email, setEmail] = useState('');
  const [welcomeEmail, setWelcomeEmail] = useState('');
  const [manualTime, setManualTime] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [manualConfirmOpen, setManualConfirmOpen] = useState(false);

  // Load state on mount
  useEffect(() => {
    const savedEmail = localStorage.getItem('cigr_email');
    if (savedEmail) {
        setEmail(savedEmail);
        setIsLoading(true);
        // data migration or just fresh fetch
        // We'll trust the sheet as the single source of truth for check-in status
        getTodayAttendance(savedEmail).then(date => {
            if (date) {
                setCheckInTime(date);
                toast.success("Restored check-in from cloud");
            }
        }).finally(() => setIsLoading(false));
    }

    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleLogin = async () => {
    if (!welcomeEmail.trim()) return;
    setIsLoading(true);
    
    // Trigger sync
    try {
        const date = await getTodayAttendance(welcomeEmail);
        setEmail(welcomeEmail);
        localStorage.setItem('cigr_email', welcomeEmail);
        
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
      setEmail('');
      setWelcomeEmail('');
      setCheckInTime(null);
      setCheckInTime(null);
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
    } catch (e) {
        toast.error("Failed to save check-in. Please try again.");
    } finally {
        setIsLoading(false);
    }
  };

  const handleManualCheckInTrigger = () => {
    if (!manualTime) return;
    const [h, m] = manualTime.split(':').map(Number);
    
    // Manual Check-in allows late check-ins (after 10 AM), 
    // but still blocked by the hard limit check in attemptCheckIn (7 PM)
    
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
    attemptCheckIn(new Date());
  };
  
  const handleClearCheckIn = async () => {
      if (!confirm("Are you sure? This will delete the record from Google Sheets.")) return;
      
      setIsLoading(true);
      try {
          await deleteTodayAttendance(email);
          setCheckInTime(null);
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
                          <Input 
                            value={welcomeEmail} 
                            onChange={e => setWelcomeEmail(e.target.value)} 
                            placeholder="ocean@litmers.com"
                            className="h-12 text-lg"
                            onKeyDown={e => e.key === 'Enter' && handleLogin()}
                          />
                      </div>
                      <Button 
                        onClick={handleLogin} 
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-14 text-lg rounded-xl shadow-lg shadow-blue-900/10 transition-all hover:scale-[1.02]"
                        disabled={!welcomeEmail.trim()}
                      >
                        Get Started
                      </Button>
                  </CardContent>
              </Card>
          </div>
      );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 flex items-center justify-center relative">
      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-background/95 backdrop-blur-xl z-50 flex flex-col items-center justify-center animate-in fade-in duration-200">
           <Loader2 className="h-16 w-16 animate-spin text-blue-600 dark:text-blue-500 mb-4" />
           <p className="text-muted-foreground font-medium animate-pulse">Syncing with cloud...</p>
        </div>
      )}

      <Card className="w-full max-w-lg shadow-xl border-t-4 border-t-blue-600">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle className="text-2xl font-bold">Office Check-in</CardTitle>
            <CardDescription>{format(currentTime, 'EEEE, MMMM do yyyy')}</CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={handleLogout} title="Log Out">
            <LogOut className="w-5 h-5 text-slate-400 hover:text-red-500 transition-colors" />
          </Button>
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
                  <Dialog>
                    <DialogTrigger asChild>
                        <Button 
                            disabled={currentTime.getHours() >= OFFICE_START_LIMIT}
                            className={`w-full h-24 text-2xl font-bold rounded-3xl shadow-xl shadow-blue-500/20 transition-all border-t border-white/20 relative overflow-hidden group text-white ${
                                currentTime.getHours() >= OFFICE_START_LIMIT 
                                ? 'bg-slate-300 cursor-not-allowed text-slate-500' 
                                : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:shadow-blue-500/30 hover:scale-[1.02]'
                            }`}
                        >
                            <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                            <div className="flex flex-col items-center gap-2">
                                <div className="flex items-center gap-3">
                                  {currentTime.getHours() >= OFFICE_START_LIMIT ? (
                                      <AlertTriangle className="w-8 h-8 text-slate-500" />
                                  ) : (
                                      <CheckCircle className="w-8 h-8" />
                                  )}
                                  <span className={currentTime.getHours() >= OFFICE_START_LIMIT ? 'text-slate-500' : 'text-white'}>
                                      {currentTime.getHours() >= OFFICE_START_LIMIT ? 'Check In Closed' : 'Check In Now'}
                                  </span>
                                </div>
                                <span className={`text-xs font-medium opacity-90 uppercase tracking-widest ${currentTime.getHours() >= OFFICE_START_LIMIT ? 'text-slate-400' : 'text-white'}`}>
                                    {currentTime.getHours() >= OFFICE_START_LIMIT ? 'Use Manual Entry below' : 'One-click Attendance'}
                                </span>
                            </div>
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Confirm Check-in</DialogTitle>
                            <DialogDescription>
                                Are you sure you want to check in at {format(currentTime, 'HH:mm')}?
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <Button onClick={handleNowCheckIn} className="bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-600 dark:hover:bg-blue-700">Confirm</Button>
                        </DialogFooter>
                    </DialogContent>
                  </Dialog>

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
                                    disabled={currentTime.getHours() >= OFFICE_END_LIMIT}
                                    >Set</Button>
                              </div>
                              <p className="text-[10px] text-center text-muted-foreground">
                                {currentTime.getHours() >= OFFICE_END_LIMIT 
                                    ? `Check-in closed for the day (after ${OFFICE_END_LIMIT}:00)`
                                    : `Useful for late check-ins (after ${OFFICE_START_LIMIT}:00)`}
                              </p>
                          </div>
                      </details>
              {/* Manual Confirm Dialog */}
              <Dialog open={manualConfirmOpen} onOpenChange={setManualConfirmOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirm Manual Entry</DialogTitle>
                        <DialogDescription>
                            Confirm checking in at <span className="font-bold text-foreground">{manualTime}</span>?
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button onClick={confirmManualCheckIn} className="bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-600 dark:hover:bg-blue-700">Confirm</Button>
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

                  <Button variant="outline" className="w-full text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/30 border-red-200 dark:border-red-800" onClick={handleClearCheckIn}>
                      <LogOut className="w-4 h-4 mr-2" />
                      Cancel / Reset Check-in
                  </Button>
              </div>
          )}
        </CardContent>
      </Card>



    </div>
  );
}
