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
    const [isDismissed, setIsDismissed] = useState(false);

    useEffect(() => {
        // 1. Android / Desktop Support
        const handleBeforeInstallPrompt = (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
            // Only show if not installed and not dismissed
            if (!window.matchMedia('(display-mode: standalone)').matches && !isDismissed) {
                setIsVisible(true);
            }
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        // 2. iOS Detection
        const userAgent = window.navigator.userAgent.toLowerCase();
        const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
        const isStandalone = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;

        if (isIosDevice && !isStandalone && !isDismissed) {
            setIsIOS(true);
            setIsVisible(true);
        }

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        };
    }, [isDismissed]);

    useEffect(() => {
        // 3. Universal Fallback
        // Always show guide if not installed (even if prompt event is delayed/blocked)
        if (!isDismissed && !window.matchMedia('(display-mode: standalone)').matches) {
            const timer = setTimeout(() => {
                if (!isVisible) setIsVisible(true);
            }, 1000); 
            return () => clearTimeout(timer);
        }
    }, [isDismissed]); // Removed isVisible from dependency to avoid loop

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;

        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        
        if (outcome === 'accepted') {
            setIsVisible(false);
            setIsDismissed(true);
        }
        setDeferredPrompt(null);
    };

    const handleDismiss = () => {
        setIsVisible(false);
        setIsDismissed(true);
    };

    if (!isVisible || isDismissed) return null;

    if (!isVisible) return null;

    return (
        <Card className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50 shadow-2xl border-blue-200 dark:border-blue-900 bg-white/95 dark:bg-slate-900/95 backdrop-blur slide-in-from-bottom duration-500 animate-in fade-in">
            <CardContent className="p-4 relative">
                <Button 
                    variant="ghost" 
                    size="icon" 
                    className="absolute top-2 right-2 h-6 w-6 text-muted-foreground hover:text-foreground"
                    onClick={handleDismiss}
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
                        ) : deferredPrompt ? (
                            <Button 
                                size="sm" 
                                onClick={handleInstallClick} 
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white mt-1"
                            >
                                {t('installApp')}
                            </Button>
                        ) : (
                            <div className="text-xs bg-muted/50 p-3 rounded border border-border mt-2 text-foreground/80">
                                {t('androidGuide')}
                            </div>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
