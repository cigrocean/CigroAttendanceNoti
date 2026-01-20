import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Loader2, RefreshCw, Search } from 'lucide-react';
import { getAllAttendance } from '@/services/googleSheets';
import { format, parseISO, addHours } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { getTranslation } from '../utils/translations';
import { useLanguage } from '../hooks/useLanguage';

export default function AdminDashboard() {
  const { language, setLanguage } = useLanguage();
  const t = (key) => getTranslation(key, language);

  // Language Toggle Helper
  const LanguageToggleBtn = () => (
    <Button 
        variant="ghost" 
        size="icon" 
        className="fixed top-4 right-4 z-[50] bg-white/50 dark:bg-black/50 backdrop-blur-md shadow-sm hover:bg-white/80 dark:hover:bg-black/80 rounded-full w-10 h-10"
        onClick={() => setLanguage(language === 'en' ? 'vi' : 'en')}
    >
        <div className="flex flex-col items-center justify-center">
            <span className="text-[10px] font-bold leading-none mb-0.5">{language === 'en' ? 'EN' : 'VN'}</span>
            <div className="w-3 h-3 rounded-full border border-current opacity-70 flex items-center justify-center text-[6px]">🌐</div>
        </div>
    </Button>
  );

  const [data, setData] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  const loadData = async () => {
    // Show cached data immediately (non-blocking)
    const cached = await getAllAttendance();
    if (cached && cached.length > 0) {
      setData(cached);
      setIsLoading(false);
    }
    
    // Then fetch fresh data in background
    const fresh = await getAllAttendance(true); // skipCache = true
    setData(fresh);
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
    
    // Poll every 30 seconds for fresh data
    const pollInterval = setInterval(loadData, 30000);
    
    return () => clearInterval(pollInterval);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center py-12 px-4 animate-in fade-in duration-500 relative">
      <LanguageToggleBtn />
      <Card className="w-full max-w-md md:max-w-4xl lg:max-w-6xl shadow-xl">
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-2xl font-bold">{t('attendanceRecords')}</CardTitle>
            <CardDescription>{t('allRecords')}</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate('/')}>
               <ArrowLeft className="w-4 h-4 mr-2" />
               {t('close')}
            </Button>
            <Button variant="outline" size="sm" onClick={loadData} disabled={isLoading}>
               {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : (
            <div className="space-y-4">
               {/* Search Bar */}
               <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input 
                    placeholder={t('searchByEmail')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
               </div>

            <div className="rounded-md border">
              <div className="relative w-full overflow-auto">
                <table className="w-full caption-bottom text-sm text-left">
                  <thead className="[&_tr]:border-b">
                    <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                      <th className="h-12 px-4 align-middle font-medium text-muted-foreground">{t('email')}</th>
                      <th className="h-12 px-4 align-middle font-medium text-muted-foreground">{t('checkInTime')}</th>
                      <th className="h-12 px-4 align-middle font-medium text-muted-foreground">{t('endTime')}</th>
                      <th className="h-12 px-4 align-middle font-medium text-muted-foreground">{t('date')}</th>
                    </tr>
                  </thead>
                  <tbody className="[&_tr:last-child]:border-0">
                    {data.filter(row => 
                        (row.email && row.email.toLowerCase().includes(searchQuery.toLowerCase()))
                    ).length === 0 ? (
                        <tr>
                            <td colSpan={4} className="p-4 text-center text-muted-foreground">
                                {searchQuery ? 'No matching records found' : t('loading')}
                            </td>
                        </tr>
                    ) : (
                        data
                        .filter(row => 
                            (row.email && row.email.toLowerCase().includes(searchQuery.toLowerCase()))
                        )
                        .map((row, i) => {
                            const currentUser = localStorage.getItem('cigr_email');
                            const isCurrentUser = currentUser && row.email && row.email.toLowerCase() === currentUser.toLowerCase();
                            
                            return (
                                <tr key={i} className={`border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted ${isCurrentUser ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
                                    <td className="p-4 align-middle font-medium">
                                        {row.email}
                                        {isCurrentUser && <span className="ml-2 text-[10px] bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-blue-300 px-1.5 py-0.5 rounded-full">YOU</span>}
                                    </td>
                                    <td className="p-4 align-middle">{row.checkInTime ? format(parseISO(row.checkInTime), 'HH:mm:ss') : '-'}</td>
                                    <td className="p-4 align-middle text-muted-foreground">
                                        {row.checkInTime ? format(addHours(parseISO(row.checkInTime), 9), 'HH:mm:ss') : '-'}
                                    </td>
                                    <td className="p-4 align-middle">{row.dateStr}</td>
                                </tr>
                            );
                        })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            </div>
          )}
        </CardContent>
      </Card>
      

    </div>
  );
}
