import React, { useState } from 'react';
import { X, Check } from 'lucide-react';
import { AppStep } from '../types';

interface Props {
    onClose: () => void;
    onNavigate: (step: AppStep) => void;
}

const OnboardingTour: React.FC<Props> = ({ onClose, onNavigate }) => {
    const [step, setStep] = useState(0);

    const steps = [
        {
            title: "Bienvenue sur FactureMan !",
            desc: "L'application ultime pour gérer vos factures et votre stock hors ligne. Faisons le tour rapide.",
            image: "🏠"
        },
        {
            title: "Créer une Facture",
            desc: "C'est ici que tout commence. Ajoutez des articles, sélectionnez un client et générez une facture pro en 2 clics.",
            action: () => onNavigate(AppStep.FORM),
            image: "📝"
        },
        {
            title: "Gestion de Stock",
            desc: "Suivez vos quantités en temps réel. Ajoutez vos produits et ne soyez jamais en rupture.",
            action: () => onNavigate(AppStep.STOCK),
            image: "📦"
        },
        {
            title: "Vos Crédits",
            desc: "Le système fonctionne avec des crédits. Chaque facture consomme des crédits. Rechargez via un Admin.",
            action: () => onNavigate(AppStep.PROFILE),
            image: "💎"
        }
    ];

    const handleNext = () => {
        if (step < steps.length - 1) {
            if (steps[step + 1].action) steps[step + 1].action!();
            setStep(step + 1);
        } else {
            localStorage.setItem('has_seen_onboarding', 'true');
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl relative">
                <button
                    onClick={() => {
                        localStorage.setItem('has_seen_onboarding', 'true');
                        onClose();
                    }}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
                >
                    <X size={24} />
                </button>

                <div className="text-center mb-6 mt-2">
                    <div className="text-6xl mb-4">{steps[step].image}</div>
                    <h3 className="text-2xl font-black text-blue-900 mb-2">{steps[step].title}</h3>
                    <p className="text-gray-500 font-medium leading-relaxed">{steps[step].desc}</p>
                </div>

                <div className="flex gap-2 justify-center mb-6">
                    {steps.map((_, i) => (
                        <div key={i} className={`h-2 rounded-full transition-all duration-300 ${i === step ? 'w-8 bg-blue-600' : 'w-2 bg-gray-200'}`} />
                    ))}
                </div>

                <button
                    onClick={handleNext}
                    className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold uppercase tracking-widest hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-2"
                >
                    {step === steps.length - 1 ? "C'est parti !" : "Suivant"}
                    {step === steps.length - 1 && <Check size={20} />}
                </button>
            </div>
        </div>
    );
};

export default OnboardingTour;
