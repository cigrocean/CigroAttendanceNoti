import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Loader2, RefreshCw, Search } from 'lucide-react';
import { getAllAttendance } from '@/services/googleSheets';
import { format, parseISO, addHours } from 'date-fns';
import { useNavigate } from 'react-router-dom';

export default function AdminDashboard() {
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center py-12 px-4 animate-in fade-in duration-500">
      <Card className="w-full max-w-md md:max-w-4xl lg:max-w-6xl shadow-xl">
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-2xl font-bold">Attendance Records</CardTitle>
            <CardDescription>All check-in records from Google Sheets</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate('/')}>
               <ArrowLeft className="w-4 h-4 mr-2" />
               Back
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
                    placeholder="Search by email..." 
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
                      <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Email</th>
                      <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Check In Time</th>
                      <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Est. End Time</th>
                      <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Date</th>
                    </tr>
                  </thead>
                  <tbody className="[&_tr:last-child]:border-0">
                    {data.filter(row => 
                        (row.email && row.email.toLowerCase().includes(searchQuery.toLowerCase()))
                    ).length === 0 ? (
                        <tr>
                            <td colSpan={4} className="p-4 text-center text-muted-foreground">
                                {searchQuery ? 'No matching records found' : 'No records found'}
                            </td>
                        </tr>
                    ) : (
                        data
                        .filter(row => 
                            (row.email && row.email.toLowerCase().includes(searchQuery.toLowerCase()))
                        )
                        .map((row, i) => (
                        <tr key={i} className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                            <td className="p-4 align-middle font-medium">{row.email}</td>
                            <td className="p-4 align-middle">{row.checkInTime ? format(parseISO(row.checkInTime), 'HH:mm:ss') : '-'}</td>
                            <td className="p-4 align-middle text-muted-foreground">
                                {row.checkInTime ? format(addHours(parseISO(row.checkInTime), 9), 'HH:mm:ss') : '-'}
                            </td>
                            <td className="p-4 align-middle">{row.dateStr}</td>
                        </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            </div>
          )}
        </CardContent>
      </Card>
      
      <div className="mt-8 text-center text-sm text-muted-foreground">
         Secure · Powered by Google Sheets
      </div>
    </div>
  );
}
