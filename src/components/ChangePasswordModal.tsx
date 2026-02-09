
import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { Lock, Loader2, CheckCircle2, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { validatePassword, getPasswordStrengthColor, getPasswordStrengthLabel } from '../utils/passwordValidator';

interface Props {
    onClose: () => void;
}

const ChangePasswordModal: React.FC<Props> = ({ onClose }) => {
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(true); // Default visible
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Real-time validation
    const validation = validatePassword(password);
    const canSubmit = password.length > 0 && validation.valid;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        // Validate password
        if (!validation.valid) {
            setError(validation.errors[0] || "Mot de passe invalide");
            setLoading(false);
            return;
        }

        try {
            const { error } = await supabase.auth.updateUser({
                password: password
            });

            if (error) throw error;

            // Success - Bonus is now handled by DB trigger on signup, 
            // so we don't need to call rpc('claim_welcome_bonus') here anymore.

            localStorage.removeItem('reset_mode');
            onClose();

        } catch (err: any) {
            console.error(err);
            if (err.name === 'AbortError') {
                // Ignore abort errors which can happen if component unmounts or multiple requests
                return;
            }
            if (err.message?.includes('signal is aborted')) {
                return; // Ignore signal aborted
            }
            setError(err.message || "Erreur lors de la mise à jour.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] bg-slate-900/90 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-8 animate-in zoom-in-95 duration-300">
                <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-blue-50 rounded-full mx-auto flex items-center justify-center mb-4">
                        <Lock className="text-blue-600" size={32} />
                    </div>
                    <h2 className="text-xl font-black text-gray-900 uppercase">Nouveau Mot de Passe</h2>
                    <p className="text-xs text-gray-500 font-medium mt-2">
                        Créez un mot de passe simple (6 caractères minimum).
                    </p>
                </div>

                {error && (
                    <div className="mb-4 p-3 bg-red-50 text-red-600 text-xs font-bold rounded-xl text-center flex items-center gap-2">
                        <AlertCircle size={16} />
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <div className="relative">
                            <input
                                type={showPassword ? "text" : "password"}
                                required
                                className="w-full pl-4 pr-12 py-4 bg-gray-50 border-2 border-gray-100 rounded-xl font-bold text-gray-900 outline-none focus:border-blue-500 transition-colors"
                                placeholder="Entrez le nouveau mot de passe"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                autoFocus
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                            </button>
                        </div>

                        {/* Password Strength Indicator */}
                        {password.length > 0 && (
                            <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                                {/* Strength Label */}
                                <div className={`text-xs font-bold px-3 py-1 rounded-lg inline-block ${getPasswordStrengthColor(validation.strength)}`}>
                                    Force: {getPasswordStrengthLabel(validation.strength)} ({validation.score}%)
                                </div>

                                {/* Requirements Checklist */}
                                <div className="bg-gray-50 rounded-xl p-3 space-y-1.5">
                                    <div className="text-[10px] font-black text-gray-400 uppercase mb-2">Exigences:</div>
                                    {[
                                        { test: password.length >= 8, label: 'Au moins 8 caractères' },
                                        { test: /[A-Z]/.test(password), label: 'Une lettre majuscule' },
                                        { test: /[a-z]/.test(password), label: 'Une lettre minuscule' },
                                        { test: /[0-9]/.test(password), label: 'Un chiffre' },
                                        { test: /[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/`~]/.test(password), label: 'Un caractère spécial' }
                                    ].map((req, idx) => (
                                        <div key={idx} className="flex items-center gap-2 text-xs">
                                            {req.test ? (
                                                <CheckCircle2 size={14} className="text-green-600" />
                                            ) : (
                                                <div className="w-3.5 h-3.5 rounded-full border-2 border-gray-300" />
                                            )}
                                            <span className={req.test ? 'text-green-700 font-semibold' : 'text-gray-500'}>
                                                {req.label}
                                            </span>
                                        </div>
                                    ))}
                                </div>

                                {/* Validation Errors */}
                                {validation.errors.length > 0 && (
                                    <div className="bg-red-50 rounded-xl p-3 space-y-1">
                                        {validation.errors.map((err, idx) => (
                                            <div key={idx} className="flex items-start gap-2 text-xs text-red-700">
                                                <AlertCircle size={12} className="mt-0.5 flex-shrink-0" />
                                                <span>{err}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <button
                        type="submit"
                        disabled={loading || !canSubmit}
                        className="w-full py-4 bg-blue-900 hover:bg-blue-800 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-xl font-black uppercase tracking-widest text-xs shadow-xl flex items-center justify-center gap-2 transition-all active:scale-95"
                    >
                        {loading ? <Loader2 className="animate-spin" size={18} /> : canSubmit ? 'Enregistrer' : 'Mot de passe faible'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default ChangePasswordModal;
