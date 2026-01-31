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
            const value = typeof newAmount === 'function' ? newAmount(prev) : newAmount;
            if (session?.user?.id) {
                localStorage.setItem(`factureman_${session.user.id}_wallet`, value.toString());
            }
            return value;
        });
    };

    // Load Wallet on Session Change
    useEffect(() => {
        if (session?.user?.id) {
            const walletKey = `factureman_${session.user.id}_wallet`;
            const localWallet = localStorage.getItem(walletKey);
            if (localWallet) setWalletCreditsState(parseInt(localWallet, 10));
        }
    }, [session]);

    // SMART WALLET REFILL
    useEffect(() => {
        const checkAndRefillWallet = async () => {
            if (!session?.user || !userProfile) return;

            const BANK_BALANCE = userProfile.app_credits || 0;
            const WALLET_BALANCE = walletCredits;
            const MIN_WALLET_THRESHOLD = 290; // Aggressively refill to keep near 300
            const REFILL_TARGET = 300;        // Max wallet capacity on device

            if (WALLET_BALANCE < MIN_WALLET_THRESHOLD && BANK_BALANCE > 0) {
                console.log("⚡ Auto-Refilling Wallet...");
                const needed = REFILL_TARGET - WALLET_BALANCE;
                const withdrawAmount = Math.min(needed, BANK_BALANCE);

                if (withdrawAmount > 0) {
                    const { data: success, error } = await supabase.rpc('deduct_credits', { amount: withdrawAmount });

                    if (success && !error) {
                        // Update Wallet
                        setWalletCredits(prev => prev + withdrawAmount);

                        // Update Profile (Optimistic)
                        setUserProfile(prev => prev ? ({ ...prev, app_credits: prev.app_credits - withdrawAmount }) : null);

                        console.log(`✅ Refill Success: +${withdrawAmount} credits moved to wallet.`);
                    } else {
                        console.error("❌ Refill Failed", error);
                    }
                }
            }
        };

        checkAndRefillWallet();
        const interval = setInterval(checkAndRefillWallet, 10000);
        return () => clearInterval(interval);
    }, [session, userProfile?.app_credits, walletCredits]); // setUserProfile is stable

    return { walletCredits, setWalletCredits };
};
