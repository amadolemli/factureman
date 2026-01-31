import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { Loader2, Phone, ArrowRight, ShieldCheck, KeyRound, MessageSquare, Lock, RefreshCw, LogIn, UserPlus, User } from 'lucide-react';

type AuthStep = 'HOME' | 'LOGIN_PHONE' | 'LOGIN_PASSWORD' | 'REGISTER_PHONE' | 'REGISTER_OTP' | 'REGISTER_PASSWORD' | 'RESET_PHONE' | 'RESET_OTP';

const AuthScreen: React.FC<{ onLogin: () => void }> = ({ onLogin }) => {
    const [step, setStep] = useState<AuthStep>('HOME');

    // Form State
    const [phone, setPhone] = useState('');
    const [countryCode, setCountryCode] = useState('+223'); // Default Mali
    const [password, setPassword] = useState('');
    const [otp, setOtp] = useState('');
    const [newPassword, setNewPassword] = useState('');

    // UI State
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Helpers
    const getFormattedPhone = () => {
        let cleanPhone = phone.replace(/[^0-9]/g, '');
        return `${countryCode}${cleanPhone}`;
    };

    // --- SHARED ACTIONS ---

    const checkUserExists = async (targetPhone: string) => {
        // Warning: This is a hack because Supabase doesn't easily let you check existence without login.
        // We will try to initiate a dummy login or use an RPC if cleaner, 
        // BUT for now we will just proceed with the flow user selected.
        // If they try to register and account exists, Supabase will auto-link or error.
        // We will rely on Supabase errors to guide us.
        return true;
    };

    // --- FLOW: LOGIN ---

    const handleLoginPhoneSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (phone.length < 4) {
            setError("Numéro invalide.");
            return;
        }
        setStep('LOGIN_PASSWORD');
    };

    const handleLoginPasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const finalPhone = getFormattedPhone();
            const { data, error } = await supabase.auth.signInWithPassword({
                phone: finalPhone,
                password: password
            });

            if (error) {
                if (error.message.includes('Invalid login')) throw new Error("Mot de passe incorrect.");
                throw error;
            }

            const { data: profile } = await supabase.from('profiles').select('is_banned').eq('id', data.user.id).single();
            if (profile?.is_banned) {
                await supabase.auth.signOut();
                throw new Error("Compte bloqué.");
            }

            onLogin();
        } catch (err: any) {
            console.error(err);
            setError(err.message || "Erreur de connexion.");
        } finally {
            setLoading(false);
        }
    };

    // --- FLOW: REGISTER ---

    // 1. Send OTP to Validate Number
    const handleRegisterPhoneSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        if (phone.length < 4) {
            setError("Numéro invalide.");
            setLoading(false);
            return;
        }

        try {
            const finalPhone = getFormattedPhone();
            const { error } = await supabase.auth.signInWithOtp({
                phone: finalPhone,
            });

            if (error) throw error;
            setStep('REGISTER_OTP'); // Move to verify
        } catch (err: any) {
            console.error(err);
            setError(err.message || "Erreur d'envoi du code.");
        } finally {
            setLoading(false);
        }
    };

    // 2. Verify OTP
    const handleRegisterverifyOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const finalPhone = getFormattedPhone();
            const { error } = await supabase.auth.verifyOtp({
                phone: finalPhone,
                token: otp,
                type: 'sms',
            });

            if (error) throw error;
            setStep('REGISTER_PASSWORD'); // Now set password
        } catch (err: any) {
            setError(err.message || "Code invalide.");
        } finally {
            setLoading(false);
        }
    };

    // 3. Set Password & Finish
    const handleRegisterSetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        if (newPassword.length < 6) {
            setError("Min. 6 caractères.");
            setLoading(false);
            return;
        }

        try {
            const { error } = await supabase.auth.updateUser({ password: newPassword });
            if (error) throw error;
            onLogin(); // Done
        } catch (err: any) {
            setError(err.message || "Erreur lors de la création.");
        } finally {
            setLoading(false);
        }
    };

    // --- FLOW: RESET PASSWORD ---

    // Optimized: Triggered directly from Login Password screen
    const handleInitiateReset = async () => {
        setLoading(true);
        setError(null);

        // FLAG reset mode so App.tsx knows to show change password modal after login
        localStorage.setItem('reset_mode', 'true');

        try {
            const finalPhone = getFormattedPhone();
            const { error } = await supabase.auth.signInWithOtp({ phone: finalPhone });
            if (error) throw error;
            setStep('RESET_OTP');
        } catch (err: any) {
            setError(err.message || "Erreur d'envoi.");
            localStorage.removeItem('reset_mode');
        } finally {
            setLoading(false);
        }
    };

    const handleResetVerifyOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const finalPhone = getFormattedPhone();
            const { error } = await supabase.auth.verifyOtp({
                phone: finalPhone,
                token: otp,
                type: 'sms',
            });
            if (error) throw error;

            // On Success: Session is created. App.tsx will detect 'reset_mode' and show modal.

        } catch (err: any) {
            setError("Code invalide.");
            setLoading(false);
        }
    };


    // --- RENDER HELPERS ---

    const PhoneInput = ({ onSubmit, btnText, backStep }: any) => (
        <form onSubmit={onSubmit} className="space-y-4 animate-in slide-in-from-right">
            <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-gray-400 pl-2">Pays & Numéro de Téléphone</label>
                <div className="flex gap-2">
                    <div className="relative w-1/3">
                        <select
                            className="w-full h-full pl-2 pr-1 bg-gray-50 border-2 border-gray-100 rounded-xl font-bold text-gray-900 outline-none focus:border-blue-500 transition-colors text-xs appearance-none"
                            value={countryCode}
                            onChange={(e) => setCountryCode(e.target.value)}
                        >
                            <option value="+223">🇲🇱 +223</option>
                            <option value="+229">🇧🇯 +229</option>
                            <option value="+226">🇧🇫 +226</option>
                            <option value="+225">🇨🇮 +225</option>
                            <option value="+221">🇸🇳 +221</option>
                            <option value="+227">🇳🇪 +227</option>
                            <option value="+228">🇹🇬 +228</option>
                            <option value="+224">🇬🇳 +224</option>
                            <option value="+222">🇲🇷 +222</option>
                            <option value="+233">🇬🇭 +233</option>
                            <option value="+234">🇳🇬 +234</option>
                            <option value="+220">🇬🇲 +220</option>
                            <option value="+238">🇨🇻 +238</option>
                            <option value="+245">🇬🇼 +245</option>
                            <option value="+231">🇱🇷 +231</option>
                            <option value="+232">🇸🇱 +232</option>
                            <option value="+237">🇨🇲 +237</option>
                            <option value="+236">🇨🇫 +236</option>
                            <option value="+235">🇹🇩 +235</option>
                            <option value="+242">🇨🇬 +242</option>
                            <option value="+243">🇨🇩 +243</option>
                            <option value="+240">🇬🇶 +240</option>
                            <option value="+241">🇬🇦 +241</option>
                            <option value="+239">🇸🇹 +239</option>
                        </select>
                    </div>
                    <div className="relative w-2/3">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                        <input
                            type="tel"
                            required
                            className="w-full pl-10 pr-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-xl font-bold text-gray-900 outline-none focus:border-blue-500 transition-colors"
                            placeholder="70 00 00 00"
                            value={phone}
                            onChange={e => setPhone(e.target.value)}
                            autoFocus
                        />
                    </div>
                </div>
            </div>
            <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-blue-900 text-white rounded-xl font-black uppercase tracking-widest text-xs hover:bg-blue-800 shadow-xl shadow-blue-200 flex items-center justify-center gap-2 mt-4"
            >
                {loading ? <Loader2 className="animate-spin" size={18} /> : btnText}
                {!loading && <ArrowRight size={18} />}
            </button>
            {backStep && (
                <button
                    type="button"
                    onClick={() => { setStep(backStep); setError(null); }}
                    className="w-full py-2 text-[10px] font-bold text-gray-400 hover:text-gray-600 uppercase"
                >
                    Retour
                </button>
            )}
        </form>
    );

    const OtpInput = ({ onSubmit, btnText, backStep }: any) => (
        <form onSubmit={onSubmit} className="space-y-4 animate-in slide-in-from-right">
            <div className="text-center mb-4">
                <div className="inline-block p-3 bg-blue-50 rounded-full mb-3">
                    <MessageSquare className="text-blue-600" size={24} />
                </div>
                <h3 className="text-sm font-bold text-gray-800">Vérification SMS</h3>
                <p className="text-xs text-gray-500 mt-1">Code envoyé au <span className="font-bold text-blue-900">{getFormattedPhone()}</span></p>
            </div>
            <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                <input
                    type="text"
                    required
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-xl font-bold text-gray-900 outline-none focus:border-blue-500 transition-colors tracking-[0.5em] text-center"
                    placeholder="000000"
                    maxLength={6}
                    value={otp}
                    onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                    autoFocus
                />
            </div>
            <button
                type="submit"
                disabled={loading || otp.length < 6}
                className="w-full py-4 bg-emerald-600 text-white rounded-xl font-black uppercase tracking-widest text-xs hover:bg-emerald-500 shadow-xl shadow-emerald-200 flex items-center justify-center gap-2"
            >
                {loading ? <Loader2 className="animate-spin" size={18} /> : btnText}
            </button>
            <button
                type="button"
                onClick={() => { setStep(backStep); setError(null); }}
                className="w-full py-2 text-[10px] font-bold text-gray-400 hover:text-gray-600 uppercase"
            >
                Annuler
            </button>
        </form>
    );

    const PwdInput = ({ onSubmit, btnText, backStep, title, subTitle }: any) => (
        <form onSubmit={onSubmit} className="space-y-4 animate-in slide-in-from-right">
            {title && (
                <div className="text-center mb-4">
                    <h3 className="text-sm font-bold text-gray-800">{title}</h3>
                    {subTitle && <p className="text-xs text-gray-500 mt-1">{subTitle}</p>}
                </div>
            )}
            <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                <input
                    type="password"
                    required
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-xl font-bold text-gray-900 outline-none focus:border-blue-500 transition-colors"
                    placeholder="Mot de passe confidentiel"
                    value={step.includes('NEW') ? newPassword : password}
                    onChange={e => step.includes('NEW') ? setNewPassword(e.target.value) : setPassword(e.target.value)}
                    autoFocus
                />
            </div>
            <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-blue-900 text-white rounded-xl font-black uppercase tracking-widest text-xs hover:bg-blue-800 shadow-xl shadow-blue-200 flex items-center justify-center gap-2"
            >
                {loading ? <Loader2 className="animate-spin" size={18} /> : btnText}
            </button>
            {/* Forget Password Link ONLY for Login Pwd Screen */}
            {step === 'LOGIN_PASSWORD' && (
                <button
                    type="button"
                    onClick={() => handleInitiateReset()}
                    className="w-full py-1 text-[10px] font-bold text-blue-600 hover:text-blue-800 uppercase"
                >
                    Mot de passe oublié ?
                </button>
            )}

            <button
                type="button"
                onClick={() => { setStep(backStep); setError(null); }}
                className="w-full py-2 text-[10px] font-bold text-gray-400 hover:text-gray-600 uppercase"
            >
                Retour
            </button>
        </form>
    );


    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300">

                {/* Header */}
                <div className="bg-blue-600 p-8 text-center relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-full bg-blue-500 opacity-20 transform -skew-y-6 scale-150 origin-top-left"></div>
                    <div className="relative z-10">
                        <div className="w-16 h-16 bg-white rounded-2xl mx-auto flex items-center justify-center mb-4 shadow-lg">
                            <ShieldCheck size={32} className="text-blue-600" />
                        </div>
                        <h1 className="text-2xl font-black text-white uppercase tracking-tight">FactureMan</h1>
                        <p className="text-blue-100 text-xs font-bold uppercase tracking-widest mt-1">Gérez tout. Simplement</p>
                    </div>
                </div>

                {/* Form Container */}
                <div className="p-8">
                    {/* Common Error Display */}
                    {error && (
                        <div className="mb-4 p-3 bg-red-50 text-red-600 text-xs font-bold rounded-xl border border-red-100 text-center animate-in shake">
                            {error}
                        </div>
                    )}

                    {/* --- STEP 0: HOME SELECTION --- */}
                    {step === 'HOME' && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
                            <h2 className="text-center text-lg font-bold text-gray-800 mb-6">Bienvenue !</h2>

                            <button
                                onClick={() => { setStep('LOGIN_PHONE'); setError(null); }}
                                className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 flex items-center justify-between px-6 transition-all group"
                            >
                                <div className="flex items-center gap-3">
                                    <LogIn size={20} className="text-blue-200" />
                                    <div className="text-left">
                                        <div className="text-xs opacity-80 uppercase tracking-wide">J'ai un compte</div>
                                        <div className="text-lg">S'identifier</div>
                                    </div>
                                </div>
                                <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                            </button>

                            <button
                                onClick={() => { setStep('REGISTER_PHONE'); setError(null); }}
                                className="w-full py-4 bg-white border-2 border-gray-100 text-gray-700 rounded-xl font-bold hover:border-blue-200 hover:bg-blue-50 shadow-sm flex items-center justify-between px-6 transition-all group"
                            >
                                <div className="flex items-center gap-3">
                                    <UserPlus size={20} className="text-gray-400 group-hover:text-blue-500" />
                                    <div className="text-left">
                                        <div className="text-xs opacity-50 uppercase tracking-wide">Nouveau ici ?</div>
                                        <div className="text-lg">S'inscrire</div>
                                    </div>
                                </div>
                                <ArrowRight size={20} className="text-gray-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-transform" />
                            </button>
                        </div>
                    )}

                    {/* --- LOGIN FLOW --- */}
                    {step === 'LOGIN_PHONE' && (
                        <PhoneInput
                            onSubmit={handleLoginPhoneSubmit}
                            btnText="Continuer vers le mot de passe"
                            backStep="HOME"
                        />
                    )}

                    {step === 'LOGIN_PASSWORD' && (
                        <PwdInput
                            onSubmit={handleLoginPasswordSubmit}
                            btnText="Se Connecter"
                            backStep="LOGIN_PHONE"
                            title="Connexion"
                            subTitle={`Compte : ${getFormattedPhone()}`}
                        />
                    )}

                    {/* --- REGISTER FLOW --- */}
                    {step === 'REGISTER_PHONE' && (
                        <PhoneInput
                            onSubmit={handleRegisterPhoneSubmit}
                            btnText="Envoyer Code de Vérification"
                            backStep="HOME"
                        />
                    )}

                    {step === 'REGISTER_OTP' && (
                        <OtpInput
                            onSubmit={handleRegisterverifyOtp}
                            btnText="Vérifier le code"
                            backStep="REGISTER_PHONE"
                        />
                    )}

                    {step === 'REGISTER_PASSWORD' && (
                        <PwdInput
                            onSubmit={handleRegisterSetPassword}
                            btnText="Créer mon compte"
                            backStep="REGISTER_OTP"
                            title="Créer un mot de passe"
                            subTitle="Sécurisez votre nouveau compte"
                        />
                    )}

                    {/* --- RESET PASSWORD FLOW --- */}
                    {step === 'RESET_PHONE' && (
                        <PhoneInput
                            onSubmit={(e: React.FormEvent) => { e.preventDefault(); handleInitiateReset(); }}
                            btnText="Envoyer Code de Récupération"
                            backStep="LOGIN_PASSWORD"
                        />
                    )}

                    {step === 'RESET_OTP' && (
                        <OtpInput
                            onSubmit={handleResetVerifyOtp}
                            btnText="Vérifier le code"
                            backStep="RESET_PHONE"
                        />
                    )}


                </div>
            </div>
        </div>
    );
};

export default AuthScreen;
