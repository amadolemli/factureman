
import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { Lock, Loader2, CheckCircle2 } from 'lucide-react';

interface Props {
    onClose: () => void;
}

const ChangePasswordModal: React.FC<Props> = ({ onClose }) => {
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        if (password.length < 6) {
            setError("Le mot de passe doit faire au moins 6 caractères.");
            setLoading(false);
            return;
        }

        try {
            const { error } = await supabase.auth.updateUser({
                password: password
            });

            if (error) throw error;

            // Success
            localStorage.removeItem('reset_mode');
            onClose();

        } catch (err: any) {
            console.error(err);
            setError(err.message || "Erreur lors de la mise à jour.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] bg-slate-900/90 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl p-8 animate-in zoom-in-95 duration-300">
                <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-blue-50 rounded-full mx-auto flex items-center justify-center mb-4">
                        <Lock className="text-blue-600" size={32} />
                    </div>
                    <h2 className="text-xl font-black text-gray-900 uppercase">Nouveau Mot de Passe</h2>
                    <p className="text-xs text-gray-500 font-medium mt-2">
                        Veuillez définir un nouveau mot de passe pour sécuriser votre compte.
                    </p>
                </div>

                {error && (
                    <div className="mb-4 p-3 bg-red-50 text-red-600 text-xs font-bold rounded-xl text-center">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="relative">
                        <input
                            type="password"
                            required
                            className="w-full pl-4 pr-4 py-4 bg-gray-50 border-2 border-gray-100 rounded-xl font-bold text-gray-900 outline-none focus:border-blue-500 transition-colors text-center text-lg"
                            placeholder="Entrez le nouveau mot de passe"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            autoFocus
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-4 bg-blue-900 hover:bg-blue-800 text-white rounded-xl font-black uppercase tracking-widest text-xs shadow-xl flex items-center justify-center gap-2 transition-all active:scale-95"
                    >
                        {loading ? <Loader2 className="animate-spin" size={18} /> : 'Enregistrer'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default ChangePasswordModal;
