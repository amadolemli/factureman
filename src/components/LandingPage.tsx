import React, { useState, useEffect } from 'react';
import {
    FileText, Package, Wallet, ShieldCheck, ArrowRight, CheckCircle2,
    BarChart3, Zap, Layout, Download
} from 'lucide-react';
import AuthScreen from './AuthScreen';

interface LandingPageProps {
    onLogin: () => void;
    deferredPrompt?: any;
    onInstallApp?: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onLogin, deferredPrompt, onInstallApp }) => {
    const [currentSlide, setCurrentSlide] = useState(0);
    const [showAuth, setShowAuth] = useState(false);

    // Features to showcase
    const features = [
        {
            id: 1,
            title: "Créez tous type de documents",
            description: "Factures, Reçus, Devis, Bons de commande... Générez des documents professionnels en un clic.",
            icon: <FileText size={48} className="text-white" />,
            color: "bg-blue-600",
            image: "linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)"
        },
        {
            id: 2,
            title: "Gestion de Stock Intelligente",
            description: "Suivez vos produits, recevez des alertes de stock faible et gérez votre inventaire facilement.",
            icon: <Package size={48} className="text-white" />,
            color: "bg-emerald-600",
            image: "linear-gradient(135deg, #064e3b 0%, #10b981 100%)"
        },
        {
            id: 3,
            title: "Suivi Crédits & Trésorerie",
            description: "Gardez un œil sur les dettes clients, les paiements et votre solde en temps réel.",
            icon: <Wallet size={48} className="text-white" />,
            color: "bg-purple-600",
            image: "linear-gradient(135deg, #581c87 0%, #a855f7 100%)"
        }
    ];

    // Auto-slide effect
    useEffect(() => {
        if (showAuth) return;
        const timer = setInterval(() => {
            setCurrentSlide((prev) => (prev + 1) % features.length);
        }, 4000);
        return () => clearInterval(timer);
    }, [showAuth]);

    const handleInstallClick = () => {
        if (deferredPrompt && onInstallApp) {
            onInstallApp();
        }
    };

    if (showAuth) {
        return (
            <div className="animate-in fade-in slide-in-from-bottom duration-500">
                <button
                    onClick={() => setShowAuth(false)}
                    className="fixed top-4 left-4 z-50 bg-white/10 p-2 rounded-full text-white hover:bg-white/20 backdrop-blur-md"
                >
                    <ArrowRight className="rotate-180" size={24} />
                </button>
                <AuthScreen onLogin={onLogin} />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-900 text-white flex flex-col font-sans overflow-hidden relative">

            {/* BACKGROUND SLIDER */}
            <div className="absolute inset-0 z-0 transition-all duration-1000 ease-in-out">
                {features.map((feature, index) => (
                    <div
                        key={feature.id}
                        className={`absolute inset-0 transition-opacity duration-1000 ${index === currentSlide ? 'opacity-100' : 'opacity-0'}`}
                        style={{ background: feature.image }}
                    >
                        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"></div>
                    </div>
                ))}
            </div>

            {/* HEADER Nav */}
            <header className="relative z-10 p-6 flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <div className="bg-white/20 p-2 rounded-xl backdrop-blur-md border border-white/10">
                        <ShieldCheck size={24} className="text-white" />
                    </div>
                    <span className="font-black text-xl tracking-tight">FactureMan</span>
                </div>
                <button
                    onClick={() => setShowAuth(true)}
                    className="text-xs font-bold uppercase tracking-widest hover:text-blue-300 transition-colors"
                >
                    Connexion
                </button>
            </header>

            {/* MAIN CONTENT */}
            <main className="relative z-10 flex-grow flex flex-col justify-center px-6 pb-20">

                {/* SLIDE CONTENT */}
                <div className="max-w-md mx-auto w-full text-center space-y-8">

                    <div className="h-20 flex items-center justify-center">
                        {features.map((feature, index) => (
                            <div key={feature.id} className={`${index === currentSlide ? 'scale-100 opacity-100' : 'scale-0 opacity-0 absolute'} transition-all duration-500 transform`}>
                                <div className={`p-4 rounded-2xl ${feature.color} shadow-2xl ring-4 ring-white/10`}>
                                    {feature.icon}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="space-y-4 min-h-[160px]">
                        {features.map((feature, index) => (
                            <div key={feature.id} className={`${index === currentSlide ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8 absolute inset-x-0'} transition-all duration-700 ease-out flex flex-col items-center`}>
                                <h2 className="text-3xl font-black leading-tight mb-3">
                                    {feature.title}
                                </h2>
                                <p className="text-sm font-medium text-slate-200 leading-relaxed max-w-xs mx-auto">
                                    {feature.description}
                                </p>
                            </div>
                        ))}
                    </div>

                    {/* DOTS INDICATORS */}
                    <div className="flex justify-center gap-2 mb-8">
                        {features.map((_, index) => (
                            <button
                                key={index}
                                onClick={() => setCurrentSlide(index)}
                                className={`h-1.5 rounded-full transition-all duration-300 ${index === currentSlide ? 'w-8 bg-white' : 'w-2 bg-white/30'}`}
                            />
                        ))}
                    </div>

                    {/* ACTION BUTTON */}
                    <button
                        onClick={() => setShowAuth(true)}
                        className="w-full bg-white text-slate-900 py-4 rounded-2xl font-black uppercase tracking-widest text-sm hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-white/10 flex items-center justify-center gap-3 group"
                    >
                        Commencer maintenant
                        <ArrowRight className="group-hover:translate-x-1 transition-transform" size={18} />
                    </button>

                    {/* INSTALL BUTTON (Visible ONLY if installable) */}
                    {deferredPrompt && (
                        <button
                            onClick={handleInstallClick}
                            className="w-full mt-4 bg-emerald-500 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-sm hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-emerald-900/50 flex items-center justify-center gap-3 animate-pulse"
                        >
                            <Download size={20} />
                            Télécharger l'application
                        </button>
                    )}

                    <p className="text-[10px] text-slate-400 font-medium">
                        Gérez tout. Simplement.
                    </p>
                </div>

            </main>

            {/* FEATURE GRID AT BOTTOM (Optional, maybe too crowded for mobile view, let's keep it simple as user asked for sliding images) */}

        </div>
    );
};

export default LandingPage;
