import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { X, Download, Share, PlusSquare } from 'lucide-react';
import { getTranslation } from '../utils/translations';
import { useLanguage } from '../hooks/useLanguage';
import { toast } from 'sonner';

export default function PWAInstallGuide() {
    const { language } = useLanguage();
    const t = (key) => getTranslation(key, language);
    
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [isIOS, setIsIOS] = useState(false);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // 1. Android / Desktop Support
        const handleBeforeInstallPrompt = (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
            // Only show if not already installed
            if (!window.matchMedia('(display-mode: standalone)').matches) {
                setIsVisible(true);
            }
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        // 2. iOS Detection
        const userAgent = window.navigator.userAgent.toLowerCase();
        const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
        const isStandalone = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;

        if (isIosDevice && !isStandalone) {
            setIsIOS(true);
            setIsVisible(true); // Always show for iOS if not installed
        }

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        };
    }, []);

    useEffect(() => {
        // 3. Dev Mode / Desktop Manual Fallback
        // If it's dev mode AND not mobile AND not standalone, show it anyway so user can see UI
        if (import.meta.env.DEV && !window.matchMedia('(display-mode: standalone)').matches) {
            const timer = setTimeout(() => {
                if (!deferredPrompt) setIsVisible(true);
            }, 2000);
            return () => clearTimeout(timer);
        }
    }, [deferredPrompt]);

    const handleInstallClick = async () => {
        if (!deferredPrompt) {
            toast.info("Browser install prompt not available. (This is expected in Dev mode if the browser didn't trigger the event)");
            return;
        }

        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        
        if (outcome === 'accepted') {
            setIsVisible(false);
        }
        setDeferredPrompt(null);
    };

    if (!isVisible) return null;

    return (
        <Card className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50 shadow-2xl border-blue-200 dark:border-blue-900 bg-white/95 dark:bg-slate-900/95 backdrop-blur slide-in-from-bottom duration-500 animate-in fade-in">
            <CardContent className="p-4 relative">
                <Button 
                    variant="ghost" 
                    size="icon" 
                    className="absolute top-2 right-2 h-6 w-6 text-muted-foreground hover:text-foreground"
                    onClick={() => setIsVisible(false)}
                >
                    <X className="w-4 h-4" />
                </Button>

                <div className="flex gap-4">
                    <div className="bg-blue-100 dark:bg-blue-900/30 p-2.5 rounded-xl h-fit shrink-0">
                        <Download className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="space-y-2 pr-6">
                        <h3 className="font-semibold text-sm">{t('installGuideTitle')}</h3>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                            {t('installExplanation')}
                        </p>

                        {isIOS ? (
                            <div className="mt-3 space-y-3">
                                <div className="flex items-center gap-3 text-sm text-foreground/90">
                                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400 text-xs font-bold shrink-0">
                                        1
                                    </div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span>{t('iosShare')}</span>
                                        <Share className="w-4 h-4 text-blue-500" />
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 text-sm text-foreground/90">
                                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400 text-xs font-bold shrink-0">
                                        2
                                    </div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span>{t('iosAdd')}</span>
                                        <PlusSquare className="w-4 h-4 text-foreground/80" />
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <Button 
                                size="sm" 
                                onClick={handleInstallClick} 
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white mt-1"
                            >
                                {t('installApp')}
                            </Button>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
