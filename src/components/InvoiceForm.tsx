
import React, { useState, useRef, useEffect } from 'react';
import { InvoiceData, InvoiceItem, Product, DocumentType } from '../types';
import {
    Plus, Trash2, Camera, User, ShoppingBag,
    FileText, Package, ShoppingCart, ClipboardList,
    AlertTriangle, Banknote, ShieldCheck, ShieldAlert,
    Loader2, Check, MessageCircle, Save, PiggyBank,
    RotateCcw, AlertCircle, ChevronDown
} from 'lucide-react';
import ProductCatalog from './ProductCatalog';
import { formatCurrency, generateUUID } from '../utils/format';

interface Props {
    data: InvoiceData;
    products: Product[];
    customerBalance?: number;
    existingClients?: { name: string; phone: string }[];
    onChange: (data: InvoiceData) => void;
    onScanClick: () => void;
    onQuickSaveProduct: (name: string, price: number) => void;
    onValidateCredit: (amount: number) => void;
    onPayCash: () => void;
    onSaveDoc: () => void;
    onClearAll: () => void;
}

const InvoiceForm: React.FC<Props> = ({ data, products, customerBalance = 0, existingClients = [], onChange, onScanClick, onQuickSaveProduct, onValidateCredit, onPayCash, onSaveDoc, onClearAll }) => {
    const [showCatalog, setShowCatalog] = useState(false);
    const [isValidating, setIsValidating] = useState(false);
    const [activeSuggestionIndex, setActiveSuggestionIndex] = useState<{ itemId: string, index: number } | null>(null);
    const [showClientSuggestions, setShowClientSuggestions] = useState(false);
    const [showPhoneSuggestions, setShowPhoneSuggestions] = useState(false);
    const [confirmReset, setConfirmReset] = useState(false);
    const [showDocTypeMenu, setShowDocTypeMenu] = useState(false);

    // State for split payment
    const [useCredit, setUseCredit] = useState(false);
    const [cashAmount, setCashAmount] = useState<number>(0);

    const suggestionRef = useRef<HTMLDivElement>(null);
    const clientSuggestionRef = useRef<HTMLDivElement>(null);
    const phoneSuggestionRef = useRef<HTMLDivElement>(null);
    const docTypeMenuRef = useRef<HTMLDivElement>(null);
    const resetTimerRef = useRef<number | null>(null);

    const documentTypes = [
        { type: DocumentType.INVOICE, icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50', prefix: 'F' },
        { type: DocumentType.QUOTE, icon: FileText, color: 'text-teal-600', bg: 'bg-teal-50', prefix: 'D' },
        { type: DocumentType.DELIVERY_NOTE, icon: Package, color: 'text-green-600', bg: 'bg-green-50', prefix: 'BL' },
        { type: DocumentType.RECEIPT, icon: Banknote, color: 'text-emerald-600', bg: 'bg-emerald-50', prefix: 'R' },
        { type: DocumentType.PURCHASE_ORDER, icon: ShoppingCart, color: 'text-orange-600', bg: 'bg-orange-50', prefix: 'BC' },
        { type: DocumentType.PROFORMA, icon: ClipboardList, color: 'text-purple-600', bg: 'bg-purple-50', prefix: 'PF' },
    ];

    const currentDocType = documentTypes.find(t => t.type === data.type) || documentTypes[0];
    const total = data.items.reduce((acc, item) => acc + (item.quantity * item.unitPrice), 0);
    const availablePrepaid = customerBalance < 0 ? Math.abs(customerBalance) : 0;

    // Calculate effective amounts
    const creditToUse = useCredit ? Math.min(total, availablePrepaid) : 0;

    // Sync global amountPaid when local split changes
    useEffect(() => {
        const newTotalPaid = cashAmount + creditToUse;
        if (newTotalPaid !== data.amountPaid) {
            onChange({ ...data, amountPaid: newTotalPaid });
        }
    }, [creditToUse, cashAmount, total]);

    const handlePayFull = () => {
        const remainingToPay = Math.max(0, total - creditToUse);
        setCashAmount(remainingToPay);
    };

    const balance = total - (data.amountPaid || 0);
    const isReceiptType = data.type === DocumentType.RECEIPT;

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (suggestionRef.current && !suggestionRef.current.contains(event.target as Node)) setActiveSuggestionIndex(null);
            if (clientSuggestionRef.current && !clientSuggestionRef.current.contains(event.target as Node)) setShowClientSuggestions(false);
            if (phoneSuggestionRef.current && !phoneSuggestionRef.current.contains(event.target as Node)) setShowPhoneSuggestions(false);
            if (docTypeMenuRef.current && !docTypeMenuRef.current.contains(event.target as Node)) setShowDocTypeMenu(false);
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);


    const changeDocType = (type: DocumentType, prefix: string) => {
        const parts = data.number.split('-');
        const newNum = `${prefix}-${parts[1] || Math.floor(Math.random() * 9000) + 1000}`;
        let newItems = [...data.items];
        if (type === DocumentType.RECEIPT) {
            newItems = [{ id: 'receipt-line', quantity: 1, description: 'VERSEMENT SUR COMPTE CLIENT', unitPrice: data.amountPaid || 0 }];
        }
        onChange({ ...data, type, number: newNum, items: newItems });
        setShowDocTypeMenu(false);
    };

    const updateItemField = (id: string, field: keyof InvoiceItem, value: any) => {
        const newItems = data.items.map(item => {
            if (item.id === id) {
                let finalValue = value;
                if (field === 'unitPrice' || field === 'quantity') finalValue = parseFloat(value) || 0;
                return { ...item, [field]: finalValue };
            }
            return item;
        });
        const newTotal = newItems.reduce((acc, item) => acc + (item.quantity * item.unitPrice), 0);
        onChange({ ...data, items: newItems, amountPaid: isReceiptType ? newTotal : data.amountPaid });
        if (field === 'description' && value.length > 0) setActiveSuggestionIndex({ itemId: id, index: data.items.findIndex(i => i.id === id) });
    };

    const getProductMatch = (description: string) => {
        if (!description || description.length < 2) return null;
        return products.find(p => p.name.toUpperCase() === description.toUpperCase());
    };

    const isPriceHidden = [DocumentType.QUOTE, DocumentType.DELIVERY_NOTE, DocumentType.PURCHASE_ORDER].includes(data.type);
    const isProforma = data.type === DocumentType.PROFORMA;
    const isInvoice = data.type === DocumentType.INVOICE;
    const isReceipt = data.type === DocumentType.RECEIPT;

    return (
        <div className="space-y-6 pb-24">
            {/* Menu Déroulant Type Document */}
            <section className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200">
                <div className="flex justify-between items-center mb-4">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Type de Document</label>
                    <button type="button" onClick={() => { onClearAll(); setUseCredit(false); setCashAmount(0); }} className="text-[9px] font-black text-gray-400 uppercase hover:text-red-600 transition-colors flex items-center gap-1"><RotateCcw size={12} /> Tout effacer</button>
                </div>
                <div className="relative" ref={docTypeMenuRef}>
                    <button type="button" onClick={() => setShowDocTypeMenu(!showDocTypeMenu)} className="w-full flex items-center justify-between p-4 rounded-xl border-2 border-gray-100 bg-gray-50">
                        <div className="flex items-center gap-3">
                            <currentDocType.icon size={20} className={currentDocType.color} />
                            <span className="text-sm font-black text-blue-900 uppercase">{currentDocType.type}</span>
                        </div>
                        <ChevronDown size={20} className={`text-gray-400 transition-transform ${showDocTypeMenu ? 'rotate-180' : ''}`} />
                    </button>
                    {showDocTypeMenu && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in zoom-in-95 duration-200">
                            {documentTypes.map((item) => (
                                <button key={item.type} type="button" onClick={() => changeDocType(item.type, item.prefix)} className="w-full flex items-center gap-4 p-4 hover:bg-blue-50 border-b border-gray-50 last:border-none">
                                    <item.icon size={18} className={data.type === item.type ? item.color : 'text-gray-400'} />
                                    <span className={`text-xs font-black uppercase ${data.type === item.type ? 'text-blue-900' : 'text-gray-600'}`}>{item.type}</span>
                                    {data.type === item.type && <Check size={16} className="ml-auto text-blue-600" />}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </section>

            {/* Informations Client */}
            <section className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1 relative">
                        <label className="text-[8px] font-bold text-gray-400 uppercase ml-1">Nom du client</label>
                        <input
                            type="text"
                            className="w-full p-3 border rounded-xl font-bold uppercase text-blue-900"
                            value={data.customerName}
                            onChange={(e) => {
                                onChange({ ...data, customerName: e.target.value });
                                setShowClientSuggestions(true);
                            }}
                            onFocus={() => setShowClientSuggestions(true)}
                            placeholder="Ex: Moussa Keïta"
                        />
                        {showClientSuggestions && data.customerName.length > 0 && (
                            <div ref={clientSuggestionRef} className="absolute top-full left-0 right-0 z-50 bg-white border border-gray-200 rounded-xl shadow-xl mt-1 overflow-hidden animate-in fade-in zoom-in-95 duration-100 max-h-48 overflow-y-auto">
                                {existingClients
                                    .filter(c => c.name.toUpperCase().includes(data.customerName.toUpperCase()))
                                    .slice(0, 5)
                                    .map((client, idx) => (
                                        <button
                                            key={idx}
                                            type="button"
                                            onClick={() => {
                                                onChange({ ...data, customerName: client.name, customerPhone: client.phone || data.customerPhone });
                                                setShowClientSuggestions(false);
                                            }}
                                            className="w-full text-left p-3 hover:bg-blue-50 flex justify-between items-center border-b border-gray-50 last:border-none group"
                                        >
                                            <div>
                                                <p className="text-xs font-black text-blue-900 uppercase group-hover:text-blue-700">{client.name}</p>
                                                {client.phone && <p className="text-[9px] font-bold text-gray-400">{client.phone}</p>}
                                            </div>
                                            <div className="bg-blue-100 text-blue-600 p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                                                <User size={12} />
                                            </div>
                                        </button>
                                    ))}
                            </div>
                        )}
                    </div>
                    <div className="space-y-1 relative">
                        <label className="text-[8px] font-bold text-gray-400 uppercase ml-1">WhatsApp / Tél</label>
                        <input
                            type="text"
                            className="w-full p-3 border rounded-xl font-bold uppercase text-blue-900 focus:ring-2 focus:ring-green-500 outline-none transition-all"
                            value={data.customerPhone || ''}
                            onChange={(e) => {
                                onChange({ ...data, customerPhone: e.target.value });
                                setShowPhoneSuggestions(true);
                            }}
                            onFocus={() => setShowPhoneSuggestions(true)}
                            placeholder="ex: 70 00 00 00"
                            autoComplete="off"
                        />
                        {showPhoneSuggestions && data.customerPhone && data.customerPhone.replace(/\s/g, '').length > 1 && (
                            <div ref={phoneSuggestionRef} className="absolute top-full left-0 right-0 z-[100] bg-white border border-gray-200 rounded-xl shadow-xl mt-1 overflow-hidden animate-in fade-in zoom-in-95 duration-100 max-h-48 overflow-y-auto">
                                {existingClients
                                    .filter(c => c.phone && c.phone.replace(/\s/g, '').includes(data.customerPhone?.replace(/\s/g, '') || ''))
                                    .slice(0, 5)
                                    .map((client, idx) => (
                                        <button
                                            key={idx}
                                            type="button"
                                            onClick={() => {
                                                onChange({ ...data, customerName: client.name, customerPhone: client.phone });
                                                setShowPhoneSuggestions(false);
                                            }}
                                            className="w-full text-left p-3 hover:bg-green-50 flex justify-between items-center border-b border-gray-50 last:border-none group transition-colors"
                                        >
                                            <div>
                                                <p className="text-xs font-black text-gray-900 uppercase group-hover:text-green-700">{client.phone}</p>
                                                <p className="text-[9px] font-bold text-gray-400">{client.name}</p>
                                            </div>
                                            <div className="bg-green-100 text-green-600 p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Check size={12} />
                                            </div>
                                        </button>
                                    ))}
                            </div>
                        )}
                    </div>
                </div>

                {availablePrepaid > 0 && (
                    <div className="p-3 rounded-xl border border-green-300 bg-green-100 flex items-center gap-2">
                        <PiggyBank className="text-green-700" size={18} />
                        <div>
                            <p className="text-xs font-bold text-green-900">Avoir disponible: {formatCurrency(availablePrepaid)} F</p>
                            <p className="text-[9px] font-black text-green-700 uppercase leading-none">Sera déduit automatiquement</p>
                        </div>
                    </div>
                )}
            </section>

            {/* Liste des Articles (Masqué pour les Reçus) */}
            {!isReceiptType && (
                <section className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm space-y-4">
                    <div className="flex justify-between items-center">
                        <h2 className="font-black uppercase text-[10px] tracking-widest text-blue-900">Articles</h2>
                        <div className="flex gap-2">
                            <button type="button" onClick={() => setShowCatalog(true)} className="text-[10px] font-bold bg-blue-50 text-blue-700 px-3 py-2 rounded-lg flex items-center gap-1"><Package size={14} /> Catalogue</button>
                            <button type="button" onClick={onScanClick} className="text-[10px] font-bold bg-orange-50 text-orange-700 px-3 py-2 rounded-lg flex items-center gap-1"><Camera size={14} /> Scanner / Importer (Photo/PDF)</button>
                        </div>
                    </div>
                    <div className="space-y-4">
                        {data.items.map((item, index) => {
                            const matchedProduct = getProductMatch(item.description);
                            const isPriceChanged = matchedProduct && matchedProduct.defaultPrice !== item.unitPrice;
                            const isNewProduct = !isReceiptType && item.description.length > 2 && !matchedProduct;
                            const showSuggestions = activeSuggestionIndex?.itemId === item.id;
                            const suggestions = showSuggestions
                                ? products.filter(p => p.name.toUpperCase().includes(item.description.toUpperCase())).slice(0, 5)
                                : [];

                            return (
                                <div key={item.id} className="p-3 rounded-2xl border border-gray-100 bg-gray-50 space-y-2 relative">
                                    <div className="grid grid-cols-12 gap-2">
                                        <div className="col-span-2">
                                            <input type="number" className="w-full p-2 bg-white border border-gray-200 rounded-lg text-center font-black text-sm" value={item.quantity || ''} onChange={(e) => updateItemField(item.id, 'quantity', e.target.value)} />
                                        </div>
                                        <div className={isPriceHidden ? "col-span-10 relative" : "col-span-7 relative"}>
                                            <input
                                                type="text"
                                                className="w-full p-2 bg-white border border-gray-200 rounded-lg font-bold text-xs uppercase"
                                                value={item.description}
                                                onChange={(e) => updateItemField(item.id, 'description', e.target.value)}
                                                placeholder="Article..."
                                                autoComplete="off"
                                            />
                                            {showSuggestions && suggestions.length > 0 && (
                                                <div ref={suggestionRef} className="absolute top-full left-0 right-0 z-50 bg-white border border-gray-200 rounded-xl shadow-xl mt-1 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                                                    {suggestions.map(p => (
                                                        <button
                                                            key={p.id}
                                                            type="button"
                                                            onClick={() => {
                                                                const newItems = data.items.map(i => i.id === item.id ? { ...i, description: p.name, unitPrice: p.defaultPrice } : i);
                                                                const newTotal = newItems.reduce((acc, it) => acc + (it.quantity * it.unitPrice), 0);
                                                                onChange({ ...data, items: newItems, amountPaid: isReceiptType ? newTotal : data.amountPaid });
                                                                setActiveSuggestionIndex(null);
                                                            }}
                                                            className="w-full text-left p-2 hover:bg-blue-50 flex justify-between items-center border-b border-gray-50 last:border-none"
                                                        >
                                                            <span className="text-xs font-bold text-blue-900 uppercase">{p.name}</span>
                                                            <span className="text-[10px] font-black text-gray-500">{formatCurrency(p.defaultPrice)} F</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        {!isPriceHidden && (
                                            <div className="col-span-3 flex flex-col justify-end">
                                                {isPriceChanged && (
                                                    <div className="flex items-center justify-end gap-1 mb-0.5 animate-in slide-in-from-right-2 fade-in duration-300">
                                                        <span className="text-[6px] font-bold text-orange-400 uppercase leading-none tracking-tight">Prix Modifié</span>
                                                        <span className="text-[7px] font-black text-orange-600 uppercase leading-none">Cat: {matchedProduct.defaultPrice} F</span>
                                                    </div>
                                                )}
                                                <input type="number" className={`w-full p-2 bg-white border rounded-lg font-black text-xs text-right transition-all ${isPriceChanged ? 'border-orange-400 text-orange-600 shadow-sm shadow-orange-100' : 'border-gray-200'}`} value={item.unitPrice || ''} onChange={(e) => updateItemField(item.id, 'unitPrice', e.target.value)} />
                                            </div>
                                        )}
                                        <div className="col-span-12 flex justify-between items-end mt-1 px-1">
                                            {matchedProduct && (
                                                <div className={`flex items-center gap-1 ${item.quantity > matchedProduct.stock ? 'text-red-500' : 'text-emerald-600'}`}>
                                                    <span className="text-[7px] font-bold uppercase leading-none tracking-tight">Stock:</span>
                                                    <span className="text-[8px] font-black uppercase leading-none">{matchedProduct.stock}</span>
                                                </div>
                                            )}
                                            {isNewProduct && item.unitPrice > 0 && !isPriceHidden && (
                                                <button type="button" onClick={() => onQuickSaveProduct(item.description, item.unitPrice)} className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[7px] font-black uppercase border border-blue-100 active:scale-95 transition-all flex items-center gap-1">
                                                    <Save size={8} /> Enregistrer
                                                </button>
                                            )}
                                            {!isPriceHidden && (
                                                <div className="flex items-baseline gap-2 ml-auto opacity-75 hover:opacity-100 transition-opacity">
                                                    <span className="text-[7px] font-bold text-gray-400 uppercase tracking-widest">Sous-total</span>
                                                    <span className="text-[10px] font-black text-blue-900">
                                                        {formatCurrency(item.quantity * item.unitPrice)} <span className="text-[8px] text-blue-300">F</span>
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="absolute -right-2 -top-2">
                                        {data.items.length > 1 && (
                                            <button type="button" onClick={() => onChange({ ...data, items: data.items.filter(i => i.id !== item.id) })} className="bg-red-100 text-red-500 p-1 rounded-full active:scale-90"><Trash2 size={12} /></button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <button type="button" onClick={() => onChange({ ...data, items: [...data.items, { id: generateUUID(), quantity: 1, description: '', unitPrice: 0 }] })} className="w-full py-2 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 font-black uppercase text-[9px]">+ Ajouter une ligne</button>
                </section>
            )}

            {/* Formulaire Simplifié pour VERSEMENT (Reçu) */}
            {isReceiptType && (
                <section className="bg-emerald-50 p-6 rounded-3xl border border-emerald-100 shadow-sm text-center space-y-4">
                    <div className="flex flex-col items-center">
                        <div className="bg-emerald-100 p-3 rounded-full mb-2">
                            <Banknote size={32} className="text-emerald-600" />
                        </div>
                        <h2 className="text-sm font-black text-emerald-900 uppercase tracking-widest">Montant du Versement</h2>
                        <p className="text-[10px] text-emerald-600 font-bold max-w-xs mx-auto mt-1">Saisissez le montant exact reçu du client pour générer le reçu.</p>
                    </div>

                    <div className="max-w-xs mx-auto relative">
                        <input
                            type="number"
                            className="w-full text-center text-4xl font-black text-emerald-800 bg-white p-4 rounded-2xl border-2 border-emerald-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 outline-none transition-all shadow-inner"
                            placeholder="0"
                            autoFocus
                            value={data.items[0]?.unitPrice || ''}
                            onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                // Update single item and amountPaid sync
                                onChange({
                                    ...data,
                                    items: [{ ...data.items[0], unitPrice: val, description: "VERSEMENT ESPECE", quantity: 1 }],
                                    amountPaid: val
                                });
                            }}
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-300 font-black text-xl">F</span>
                    </div>

                    <div className="text-xs font-bold text-emerald-700">
                        {formatCurrency(data.items[0]?.unitPrice || 0)} F CFA
                    </div>
                </section>
            )}

            {/* Catalogue Modal */}
            {showCatalog && (
                <ProductCatalog
                    products={products}
                    onClose={() => setShowCatalog(false)}
                    onSelect={(product) => {
                        const emptyItemIdx = data.items.findIndex(i => i.description === '' && i.unitPrice === 0);
                        if (emptyItemIdx !== -1) {
                            const newItems = [...data.items];
                            newItems[emptyItemIdx] = { ...newItems[emptyItemIdx], description: product.name, unitPrice: product.defaultPrice };
                            onChange({ ...data, items: newItems });
                        } else {
                            onChange({ ...data, items: [...data.items, { id: generateUUID(), quantity: 1, description: product.name, unitPrice: product.defaultPrice }] });
                        }
                    }}
                />
            )}

            {/* Résumé et Paiement */}
            <section className="bg-gradient-to-br from-blue-900 to-blue-950 p-6 rounded-3xl text-white shadow-xl shadow-blue-900/20 overflow-hidden relative">
                {/* Background Pattern */}
                <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-white/5 rounded-full blur-2xl"></div>
                <div className="absolute bottom-0 left-0 -ml-8 -mb-8 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl"></div>

                <div className="relative z-10 space-y-6">
                    {!isPriceHidden && !isReceiptType && (
                        <div className="flex flex-col sm:flex-row justify-between items-end gap-4">
                            <div className="space-y-1">
                                <p className="text-[10px] font-black uppercase tracking-widest text-blue-300">Total à Payer</p>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-4xl font-black tracking-tight">{formatCurrency(total)}</span>
                                    <span className="text-lg font-bold text-blue-300">F CFA</span>
                                </div>
                                {useCredit && creditToUse > 0 && (
                                    <p className="text-[9px] font-bold text-green-300 uppercase">+ {formatCurrency(creditToUse)} F payé par Avoir</p>
                                )}
                            </div>

                            {(isInvoice) && (
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        disabled={isValidating}
                                        onClick={() => {
                                            if (isValidating) return;
                                            setIsValidating(true);
                                            setTimeout(() => setIsValidating(false), 2000);

                                            if (data.amountPaid >= total - 0.5 && total > 0) {
                                                onPayCash();
                                            } else {
                                                handlePayFull();
                                            }
                                        }}
                                        className={`${data.amountPaid >= total - 0.5 && total > 0
                                            ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/20 shadow-lg border-blue-400'
                                            : 'bg-emerald-500 hover:bg-emerald-400 text-blue-900 shadow-emerald-900/20 shadow-lg border-emerald-400/50'
                                            } px-3 py-2 rounded-xl font-black uppercase text-[9px] active:scale-95 transition-all border flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed`}
                                    >
                                        {data.amountPaid >= total - 0.5 && total > 0 ? (
                                            <>
                                                <Check size={14} strokeWidth={3} />
                                                Créer Facture
                                            </>
                                        ) : (
                                            'Tout payer'
                                        )}
                                    </button>
                                    <div className="w-full sm:w-auto bg-white/10 p-1 rounded-xl border border-white/20 backdrop-blur-sm flex items-center">
                                        <div className="bg-blue-950/50 px-3 py-2 rounded-lg text-[9px] font-black uppercase text-blue-200 tracking-wider">
                                            Montant Reçu
                                        </div>
                                        <input
                                            type="number"
                                            className="w-full sm:w-40 bg-transparent px-3 py-1 text-right text-2xl font-black text-white outline-none placeholder-white/20"
                                            value={cashAmount || ''}
                                            onChange={(e) => setCashAmount(parseFloat(e.target.value) || 0)}
                                            placeholder="0"
                                        />
                                        <span className="pr-3 font-bold text-blue-300">F</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {!isPriceHidden && (isInvoice) && (
                        <div className="h-px bg-gradient-to-r from-transparent via-blue-700 to-transparent"></div>
                    )}

                    <div className="flex justify-between items-center">
                        {!isPriceHidden && (isInvoice) && (
                            <div className="space-y-1">
                                <p className="text-[9px] font-bold text-blue-300 uppercase">Reste à payer (Crédit)</p>
                                <p className={`text-xl font-black ${balance > 0 ? 'text-orange-400' : 'text-green-400'}`}>
                                    {formatCurrency(Math.max(0, balance))} <span className="text-xs">F</span>
                                </p>
                            </div>
                        )}

                        {/* VALIDATION RECU (BOUTON UNIQUE) */}
                        {isReceiptType && (
                            <button
                                type="button"
                                disabled={isValidating || (data.items[0]?.unitPrice || 0) <= 0}
                                onClick={() => {
                                    if (isValidating) return;
                                    setIsValidating(true);

                                    if (!data.customerName) {
                                        const nameInput = document.querySelector('input[placeholder="Ex: Moussa Keïta"]') as HTMLInputElement;
                                        if (nameInput) {
                                            nameInput.focus();
                                            nameInput.classList.add('ring-4', 'ring-red-500', 'bg-red-50');
                                            setTimeout(() => nameInput.classList.remove('ring-4', 'ring-red-500', 'bg-red-50'), 2000);
                                        }
                                        setIsValidating(false);
                                        return;
                                    }

                                    onPayCash(); // Validates the receipt
                                    setTimeout(() => setIsValidating(false), 2000);
                                }}
                                className="w-full bg-emerald-500 hover:bg-emerald-400 text-blue-900 py-4 rounded-2xl font-black uppercase text-sm shadow-xl shadow-emerald-900/30 active:scale-95 transition-all flex justify-center items-center gap-2 border border-emerald-400/50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Check size={24} strokeWidth={4} />
                                <span>Valider le Reçu ({formatCurrency(data.items[0]?.unitPrice || 0)} F)</span>
                            </button>
                        )}

                        {/* Actions spécifiques autres types */}
                        {(isPriceHidden || isProforma) ? (
                            <button
                                type="button"
                                onClick={() => onSaveDoc()}
                                className="ml-auto bg-blue-600 hover:bg-blue-500 text-white pl-4 pr-5 py-3 rounded-xl font-black uppercase text-[10px] shadow-lg shadow-blue-900/20 active:scale-95 transition-all flex items-center gap-2 group border border-blue-400"
                            >
                                <Check size={18} />
                                <span>{isProforma ? 'Générer Proforma' : `Enregistrer ${data.type}`}</span>
                            </button>
                        ) : (
                            // Facture (avec Crédit)
                            <>
                                {balance > 0 && isInvoice && (
                                    <button
                                        type="button"
                                        disabled={isValidating}
                                        onClick={() => {
                                            if (isValidating) return;
                                            setIsValidating(true);
                                            setTimeout(() => setIsValidating(false), 2000);

                                            if (!data.customerName) {
                                                const nameInput = document.querySelector('input[placeholder="Ex: Moussa Keïta"]') as HTMLInputElement;
                                                if (nameInput) {
                                                    nameInput.focus();
                                                    nameInput.classList.add('ring-4', 'ring-red-500', 'bg-red-50');
                                                    setTimeout(() => nameInput.classList.remove('ring-4', 'ring-red-500', 'bg-red-50'), 2000);
                                                }
                                                return;
                                            }
                                            onValidateCredit(balance);
                                        }}
                                        className="ml-auto bg-orange-500 hover:bg-orange-600 text-white pl-4 pr-5 py-3 rounded-xl font-black uppercase text-[10px] shadow-lg shadow-orange-900/20 active:scale-95 transition-all flex items-center gap-2 group border border-orange-400 disabled:opacity-50"
                                    >
                                        <AlertCircle className="animate-pulse" size={18} />
                                        <span>Valider le crédit</span>
                                        <div className="bg-white/20 p-1 rounded-full"><Check size={12} strokeWidth={4} /></div>
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </section>
        </div>
    );
};

export default InvoiceForm;
