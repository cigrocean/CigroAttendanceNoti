import React from 'react';
import Dashboard from '@/components/Dashboard';
import NetworkGuard from '@/components/NetworkGuard';
import { LanguageProvider } from '@/hooks/useLanguage';
import { Toaster } from '@/components/ui/sonner';

function App() {
  return (
    <LanguageProvider>
      <NetworkGuard>
         <Dashboard />
         <Toaster />
      </NetworkGuard>
    </LanguageProvider>
  );
}

export default App;
