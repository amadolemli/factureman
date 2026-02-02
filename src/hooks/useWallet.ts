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



    return { walletCredits, setWalletCredits };
};
