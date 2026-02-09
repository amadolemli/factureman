import { useState, useEffect } from 'react';
import { Session } from '@supabase/supabase-js';
import { UserProfile } from '../types';
import { supabase } from '../services/supabaseClient';

export const useWallet = (
    session: Session | null,
    userProfile: UserProfile | null,
    setUserProfile: (profile: UserProfile | null | ((prev: UserProfile | null) => UserProfile | null)) => void
) => {
    const [walletCredits, setWalletCreditsState] = useState<number>(0);

    // Wrapper to persist wallet
    const setWalletCredits = (newAmount: number | ((prev: number) => number)) => {
        setWalletCreditsState(prev => {
            let value;
            if (typeof newAmount === 'function') {
                value = (newAmount as (prev: number) => number)(prev);
            } else {
                value = newAmount;
            }

            // Defensive check before saving
            if (session?.user?.id && value != null && !isNaN(value)) {
                localStorage.setItem(`factureman_${session.user.id}_wallet`, value.toString());
            }
            return value || 0;
        });
    };

    // Security: Verify wallet integrity against server balance
    const verifyWalletIntegrity = async () => {
        if (!session?.user?.id || !userProfile) return;

        try {
            const { data, error } = await supabase.rpc('verify_wallet_integrity', {
                claimed_wallet_credits: walletCredits
            });

            if (error) {
                console.warn('Wallet verification failed:', error);
                return;
            }

            if (data && data.length > 0) {
                const result = data[0];

                // If wallet is invalid (manipulated), correct it
                if (!result.is_valid) {
                    console.warn('⚠️ Wallet manipulation detected! Syncing with server...');
                    const correctedAmount = result.corrected_wallet;
                    setWalletCredits(correctedAmount);

                    // Optionally notify user
                    alert(`Synchronisation du portefeuille : ${correctedAmount} crédits disponibles.`);
                }
            }
        } catch (err) {
            console.error('Wallet verification error:', err);
        }
    };

    // Load Wallet on Session Change
    useEffect(() => {
        if (session?.user?.id) {
            const walletKey = `factureman_${session.user.id}_wallet`;
            const localWallet = localStorage.getItem(walletKey);
            if (localWallet) setWalletCreditsState(parseInt(localWallet, 10));
        }
    }, [session]);

    // Verify wallet periodically (every 2 minutes)
    useEffect(() => {
        if (!session?.user?.id) return;

        // Initial verification
        const timer = setTimeout(() => verifyWalletIntegrity(), 5000);

        // Periodic verification
        const interval = setInterval(() => {
            verifyWalletIntegrity();
        }, 2 * 60 * 1000); // Every 2 minutes

        return () => {
            clearTimeout(timer);
            clearInterval(interval);
        };
    }, [session, walletCredits, userProfile]);



    return { walletCredits, setWalletCredits, verifyWalletIntegrity };
};
