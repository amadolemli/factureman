import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { Check, X, ShieldCheck, Store, FileText, Loader2, Activity } from 'lucide-react';

// Verification Component
// This component reads the ID from the URL (path: /verify/:id)
// It fetches ONLY public-safe data from Supabase to confirm authenticity.

export const VerifyDocument = () => {
    const [loading, setLoading] = useState(true);
    const [valid, setValid] = useState(false);
    const [docData, setDocData] = useState<any>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        // 1. Get ID from URL manually since we are not using full Router props always
        const path = window.location.pathname;
        const id = path.split('/verify/')[1];

        if (!id) {
            setError("Lien invalide. Aucun ID de document fourni.");
            setLoading(false);
            return;
        }

        verifyInvoice(id);
    }, []);

    const verifyInvoice = async (id: string) => {
        try {
            // Fetch ONLY necessary columns for privacy
            const { data, error } = await supabase
                .from('invoices')
                .select(`
          id, type, number, date, total_amount, amount_paid, is_finalized, customer_name,
          profiles ( business_name, phone, address )
        `)
                .eq('id', id)
                .single();

            if (error || !data) {
                throw new Error("Document introuvable sur nos serveurs sécurisés.");
            }

            setDocData(data);
            setValid(true);
        } catch (err: any) {
            console.error(err);
            setError(err.message || "Impossible de vérifier ce document.");
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
                <Loader2 size={48} className="text-blue-600 animate-spin mb-4" />
                <p className="text-slate-500 font-medium">Vérification de l'authenticité...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 text-center">
                <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full border border-red-100">
                    <div className="mx-auto bg-red-100 w-20 h-20 rounded-full flex items-center justify-center mb-6 text-red-600">
                        <X size={40} />
                    </div>
                    <h1 className="text-2xl font-black text-slate-800 mb-2 uppercase">Non Authentifié</h1>
                    <p className="text-slate-500 mb-6">{error}</p>
                    <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 text-xs text-orange-800 text-left">
                        <strong>Pourquoi ?</strong>
                        <ul className="list-disc pl-4 mt-1 space-y-1">
                            <li>Le document a été supprimé.</li>
                            <li>Le document n'a pas encore été synchronisé (Mode Hors-Ligne).</li>
                            <li>Le lien a été modifié ou corrompu.</li>
                        </ul>
                    </div>
                    <button onClick={() => window.location.href = '/'} className="mt-8 text-blue-600 font-bold hover:underline">
                        Aller à l'accueil
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-emerald-50/50 flex flex-col items-center justify-center p-4">
            <div className="bg-white p-6 md:p-8 rounded-3xl shadow-2xl max-w-md w-full border border-emerald-100 relative overflow-hidden animate-in zoom-in-95 duration-500">

                {/* Security Banner */}
                <div className="absolute top-0 left-0 right-0 bg-emerald-600 h-2"></div>
                <div className="flex justify-center -mt-12 mb-6">
                    <div className="bg-white p-3 rounded-full shadow-lg border-4 border-emerald-50">
                        <div className="bg-emerald-600 text-white rounded-full p-4">
                            <ShieldCheck size={40} />
                        </div>
                    </div>
                </div>

                <div className="text-center mb-8">
                    <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Document Certifié</h1>
                    <p className="text-emerald-600 font-bold text-sm uppercase tracking-widest mt-1">Authenticité Garantie</p>
                    <p className="text-xs text-slate-400 mt-2">Vérifié par FactureMan Secure</p>
                </div>

                {/* DETAILS */}
                <div className="space-y-4">

                    <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        <div className="bg-white p-3 rounded-xl text-blue-600 shadow-sm">
                            <Store size={24} />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Émetteur</p>
                            <p className="text-sm font-black text-slate-900 uppercase">{docData?.profiles?.business_name || 'Inconnu'}</p>
                            <p className="text-[10px] text-slate-500">{docData?.profiles?.phone}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        <div className="bg-white p-3 rounded-xl text-purple-600 shadow-sm">
                            <FileText size={24} />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Document</p>
                            <p className="text-sm font-black text-slate-900">{docData?.type} N°{docData?.number}</p>
                            <p className="text-[10px] text-slate-500">{new Date(docData?.date).toLocaleDateString('fr-FR')}</p>
                        </div>
                    </div>

                    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 text-center">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Montant Total</p>
                        <p className="text-3xl font-black text-slate-900 tracking-tighter">
                            {new Intl.NumberFormat('fr-FR').format(docData?.total_amount || 0)} <span className="text-lg text-slate-400 font-normal">F</span>
                        </p>
                        <div className={`mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase ${docData?.amount_paid >= docData?.total_amount ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                            {docData?.amount_paid >= docData?.total_amount ? <Check size={12} /> : <Activity size={12} />}
                            {docData?.amount_paid >= docData?.total_amount ? 'Payé intégralement' : 'Paiement partiel / En attente'}
                        </div>
                    </div>

                    {/* PRIVACY NOTE */}
                    <div className="text-[10px] text-slate-400 text-center italic mt-6 px-4">
                        Pour des raisons de sécurité et de confidentialité, les détails des articles et les données personnelles du client sont masqués.
                    </div>

                </div>

            </div>
        </div>
    );
};
