import { useEffect } from 'react';
import { supabase } from '../services/supabaseClient';

const DebugLogger: React.FC = () => {
    useEffect(() => {
        // Enable Realtime logging for debug_logs table
        const channel = supabase
            .channel('debug-logs')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'debug_logs',
                },
                (payload) => {
                    const log = payload.new as any;
                    console.group(`🚨 SERVER LOG: ${log.process_name || 'System'}`);
                    console.log(`%c${log.message}`, 'color: #ef4444; font-weight: bold; font-size: 12px;');
                    if (log.details) {
                        console.log('Details:', log.details);
                    }
                    console.log('Time:', new Date(log.created_at).toLocaleTimeString());
                    console.groupEnd();
                }
            )
            .subscribe();

        console.log('🔌 Connected to Server Debug Stream');

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    return null; // Invisible component
};

export default DebugLogger;
