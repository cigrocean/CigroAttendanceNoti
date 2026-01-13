import React from 'react';
import Dashboard from '@/components/Dashboard';
import AdminDashboard from '@/components/AdminDashboard';
import NetworkGuard from '@/components/NetworkGuard';
import { LanguageProvider } from '@/hooks/useLanguage';
import { Toaster } from '@/components/ui/sonner';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

function App() {
  return (
    <LanguageProvider>
      <NetworkGuard>
        <BrowserRouter>
          <Routes>
             <Route path="/" element={<Dashboard />} />
             <Route path="/records" element={<AdminDashboard />} />
          </Routes>
        </BrowserRouter>
        <Toaster duration={5000} closeButton richColors />
      </NetworkGuard>
    </LanguageProvider>
  );
}

export default App;
