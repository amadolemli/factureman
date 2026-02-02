import { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';

/**
 * Hook to manage offline activity limits and deferred billing.
 * - Tracks documents created offline.
 * - When online, attempts to pay for them (10 credits each).
 * - If payment fails, BLOCKS further actions until paid.
 */
export const useOfflineActivity = () => {
    const MAX_OFFLINE_DOCS = 30;
    const COST_PER_DOC = 10;

    const [offlineCount, setOfflineCount] = useState<number>(0);
    const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
    const [isSyncing, setIsSyncing] = useState<boolean>(false);
    const [hasUnpaidDebt, setHasUnpaidDebt] = useState<boolean>(false);

    // 1. Initialize & Listen for Network Status
    useEffect(() => {
        const storedCount = localStorage.getItem('factureman_offline_count');
        if (storedCount) setOfflineCount(parseInt(storedCount, 10));

        const handleOnline = () => {
            setIsOnline(true);
            attemptToPayDebt();
        };
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Initial check if we launched online with debt
        if (navigator.onLine && storedCount && parseInt(storedCount, 10) > 0) {
            attemptToPayDebt();
        }

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // 2. The "Pay Debt" Logic
    const attemptToPayDebt = async () => {
        const count = parseInt(localStorage.getItem('factureman_offline_count') || '0', 10);

        if (count === 0) {
            setHasUnpaidDebt(false);
            return;
        }

        setIsSyncing(true);
        const totalCost = count * COST_PER_DOC;

        console.log(`📡 Online detected. Attempting to pay for ${count} offline items (${totalCost} credits)...`);

        try {
            const { data: success, error } = await supabase.rpc('deduct_credits', { amount: totalCost });

            if (success && !error) {
                console.log("✅ Debt Paid! Resetting offline counter.");
                // Reset Logic
                setOfflineCount(0);
                localStorage.setItem('factureman_offline_count', '0');
                setHasUnpaidDebt(false);
                alert(`Synchronisation réussie !\n\n${totalCost} crédits ont été déduits pour vos ${count} documents créés hors ligne.`);
            } else {
                console.warn("❌ Payment Failed (Insufficient Funds or Error)");
                setHasUnpaidDebt(true); // BLOCK USER
                alert(`⚠️ Synchronisation Échouée\n\nVous avez créé ${count} documents hors ligne (${totalCost} crédits).\nVotre solde serveur est insuffisant.\n\nVeuillez recharger votre compte pour continuer.`);
            }
        } catch (e) {
            console.error("Sync Error:", e);
        } finally {
            setIsSyncing(false);
        }
    };

    const incrementOfflineCount = () => {
        // We track usage regardless of online status if we are here (meaning the main App logic decided to run this offline flow)
        // But typically this is called when App.tsx detects !navigator.onLine
        // Wait, if we are ONLINE, App.tsx charges directly. 
        // So this is ONLY called when OFFLINE.
        setOfflineCount(prev => {
            const newValue = prev + 1;
            localStorage.setItem('factureman_offline_count', newValue.toString());
            return newValue;
        });
    };

    // 3. Check Permission
    const canPerformAction = (): boolean => {
        // CASE A: User HAS DEBT (Sync Failed)
        if (hasUnpaidDebt) return false;

        // CASE B: User is Offline -> Check Limit
        if (!navigator.onLine) {
            return offlineCount < MAX_OFFLINE_DOCS;
        }

        // CASE C: User is Online -> Allowed (App.tsx will handle the direct payment)
        return true;
    };

    return {
        isOnline,
        isSyncing,
        hasUnpaidDebt,
        offlineCount,
        maxOfflineDocs: MAX_OFFLINE_DOCS,
        canPerformAction,
        incrementOfflineCount,
        attemptToPayDebt // Expose manual retry
    };
};
