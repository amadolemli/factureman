
import React, { useState, useEffect } from 'react';
import { CreditRecord, DocumentType } from '../types';
import { formatCurrency } from '../utils/format';
import {
  Search, User, Wallet, ChevronRight, ArrowUpRight,
  ArrowDownLeft, Plus, X, Calendar, Printer, MessageCircle,
  FileCheck, History, ListFilter, Banknote, TrendingUp, TrendingDown,
  PiggyBank, Info, Shield, Award, FileSignature, Share2, Star, Settings, CalendarClock, Ban
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

interface Props {
  credits: CreditRecord[];
  onAddPayment: (customerName: string, amount: number) => void;
  onGenerateReceipt: (customerName: string, amount: number, date: string, transactionId?: string) => void;
  onUpdateBalance: (customerName: string, newBalance: number, reason: string) => void;
  onAddAppointment: (customerName: string, date: string, note: string, notifyDelay: number) => void;
  onUpdateAppointment: (customerName: string, appointmentId: string, newDate: string, newNote: string, notifyDelay: number) => void;
  onToggleAppointment: (customerName: string, appointmentId: string) => void;
  onCancelAppointment: (customerName: string, appointmentId: string) => void;
  onCancelPayment: (customerName: string, transactionId: string, amount: number) => void;
}

const CreditManager: React.FC<Props> = ({ credits, onAddPayment, onGenerateReceipt, onUpdateBalance, onAddAppointment, onUpdateAppointment, onToggleAppointment, onCancelPayment, onCancelAppointment }) => {
  const [activeTab, setActiveTab] = useState<'debtors' | 'prepaid' | 'payments' | 'agenda'>('debtors');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<CreditRecord | null>(null);

  useEffect(() => {
    const handler = (e: PopStateEvent) => {
      // Handle Modal Back Navigation for various modals
      if (!e.state?.modalAppointment) setShowAppointmentModal(false);
      if (!e.state?.modalStats) setShowStatsModal(false);
      if (!e.state?.modalPayment) setShowPaymentModal(false);
      if (!e.state?.modalContract) setShowContractModal(false);
      if (!e.state?.modalAdjustment) setShowAdjustmentModal(false);

      // If we navigated back to a state without customerDetail, close the panel
      if (!e.state?.customerDetail) {
        setSelectedCustomer(null);
      }
    };
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, []);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showContractModal, setShowContractModal] = useState(false);
  const [selectedContractInvoice, setSelectedContractInvoice] = useState<any>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [isPrepaidAction, setIsPrepaidAction] = useState(false);

  // Sync selectedCustomer with global state (e.g. after cancellation)
  useEffect(() => {
    if (selectedCustomer) {
      const fresh = credits.find(c => c.id === selectedCustomer.id);
      if (fresh && fresh !== selectedCustomer) {
        setSelectedCustomer(fresh);
      }
    }
  }, [credits, selectedCustomer]);

  // Appointment State
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [appointmentDate, setAppointmentDate] = useState('');
  const [appointmentNote, setAppointmentNote] = useState('');
  const [notifyTiming, setNotifyTiming] = useState<number>(60); // 60 min default
  const [editingAppointmentId, setEditingAppointmentId] = useState<string | null>(null);

  // Manual Adjustment State
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [adjustmentAmount, setAdjustmentAmount] = useState('');
  const [newCustomerName, setNewCustomerName] = useState('');
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [adjustmentType, setAdjustmentType] = useState<'DEBT' | 'CREDIT'>('DEBT');

  // Computed Lists
  const debtors = credits.filter(c => c.remainingBalance > 0 && c.customerName.toUpperCase() !== 'CLIENT COMPTANT');
  const prepaidClients = credits.filter(c => c.remainingBalance < 0 && c.customerName.toUpperCase() !== 'CLIENT COMPTANT');

  const filteredList = (activeTab === 'debtors' ? debtors : prepaidClients).filter(c =>
    c.customerName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const allPayments = credits.flatMap(c =>
    c.history
      .filter(h => h.type === 'PAYMENT')
      .map(h => ({ ...h, customerName: c.customerName }))
  ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const allAppointments = credits.flatMap(c =>
    (c.appointments || []).map(a => ({ ...a, customerName: c.customerName }))
  ).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());


  const totalGlobalDebt = debtors.reduce((acc, c) => acc + c.remainingBalance, 0);
  const totalGlobalPrepaid = Math.abs(prepaidClients.reduce((acc, c) => acc + c.remainingBalance, 0));

  // Handlers & Helpers
  const handlePaymentSubmit = () => {
    const amount = parseFloat(paymentAmount);
    if (selectedCustomer && amount > 0) {
      onAddPayment(selectedCustomer.customerName, amount);
      setPaymentAmount('');
      window.history.back(); // Closes modal

      // Optimistic update
      const newBalance = selectedCustomer.remainingBalance - amount;
      const updated = {
        ...selectedCustomer,
        remainingBalance: newBalance,
        history: [{
          type: 'PAYMENT' as const,
          id: Math.random().toString(36),
          date: new Date().toISOString(),
          amount: amount,
          description: isPrepaidAction ? 'Versement sur compte (Avoir)' : 'Versement reçu'
        }, ...selectedCustomer.history]
      };
      setSelectedCustomer(updated);
    }
  };

  const calculateStats = (customer: CreditRecord) => {
    const totalPurchased = customer.history.filter(h => h.type === 'INVOICE').reduce((acc, h) => acc + h.amount, 0);
    const totalPaid = customer.history.filter(h => h.type === 'PAYMENT').reduce((acc, h) => acc + h.amount, 0);
    const invoicesCount = customer.history.filter(h => h.type === 'INVOICE').length;

    let score = 50;
    if (totalPurchased > 0) {
      const repaymentRate = (totalPaid / totalPurchased);
      score = Math.min(100, Math.round(repaymentRate * 100));
    } else if (totalPaid > 0) {
      score = 100;
    }

    let tier = 'STANDARD';
    let color = 'text-gray-600';
    let bg = 'bg-gray-100';
    let label = 'Nouveau Client';

    if (score >= 90) { tier = 'PLATINUM'; color = 'text-purple-600'; bg = 'bg-purple-100'; label = 'Client Exemplaire'; }
    else if (score >= 70) { tier = 'GOLD'; color = 'text-amber-600'; bg = 'bg-amber-100'; label = 'Bon Payeur'; }
    else if (score >= 40) { tier = 'SILVER'; color = 'text-blue-600'; bg = 'bg-blue-100'; label = 'Client Standard'; }
    else { tier = 'RISK'; color = 'text-red-600'; bg = 'bg-red-100'; label = 'Risque de Crédit'; }

    return { totalPurchased, totalPaid, invoicesCount, score, tier, color, bg, label };
  };

  const openContract = (invoice: any) => {
    const currentState = window.history.state || {};
    window.history.pushState({ ...currentState, modalContract: true }, '');
    setSelectedContractInvoice(invoice);
    setShowContractModal(true);
  };

  const handleShareContract = async () => {
    if (!selectedCustomer || !selectedContractInvoice) return;

    const input = document.getElementById('contract-paper');
    if (!input) {
      alert("Erreur: Document non trouvé.");
      return;
    }

    try {
      const canvas = await html2canvas(input, { scale: 2, backgroundColor: '#ffffff' });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);

      const pdfBlob = pdf.output('blob');
      const file = new File([pdfBlob], `Reconnaissance_Dette_${selectedCustomer.customerName.replace(/\s+/g, '_')}.pdf`, { type: 'application/pdf' });

      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Reconnaissance de Dette',
          text: `Document pour : ${selectedCustomer.customerName}`
        });
      } else {
        // Fallback direct download
        pdf.save(`Reconnaissance_Dette_${selectedCustomer.customerName.replace(/\s+/g, '_')}.pdf`);
        alert("Le PDF a été téléchargé dans votre téléphone. Vous pouvez maintenant l'envoyer manuellement sur WhatsApp.");
      }
    } catch (e) {
      console.error(e);
      alert("Erreur lors de la génération du PDF.");
    }
  };

  const handleShareProfile = () => {
    if (!selectedCustomer) return;
    const stats = calculateStats(selectedCustomer);
    const message = `*PROFIL CLIENT*\n${selectedCustomer.customerName}\nStatut: ${stats.label}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  };

  // ... (keep rest of functions)

  // NOTE: Moving down to the JSX replacement part for the modal.
  // The replace_file_content tool only supports one contiguous block.
  // I must be careful. The user asked to replace handleShareContract AND the modal.
  // Those are far apart in the file.
  // I should probably use TWO calls or just replace the function first, then the modal.
  // I will execute this change for the function first. Wait, the instruction says replace lines 137-701? That wipes the whole file!
  // NO. The instruction says "Replace handleShareContract function ... with new logic".
  // I will split this into two tool calls to be safe and precise.

  // Actually, I can't issue two tool calls to the SAME file effectively if I don't know the new line numbers after the first edit.
  // I will perform the function update first.

  const handleAdjustmentSubmit = () => {
    const amount = parseFloat(adjustmentAmount);

    // CASE 1: Existing Customer
    if (selectedCustomer && amount >= 0) {
      const currentBalance = selectedCustomer.remainingBalance;
      const change = adjustmentType === 'DEBT' ? amount : -amount;
      const finalBalance = currentBalance + change;

      const typeLabel = adjustmentType === 'DEBT' ? 'Nouvelle Dette' : 'Nouvel Avoir';
      const fullReason = `${typeLabel} (${formatCurrency(amount)} F) - ${adjustmentReason || 'Manuel'}`;

      onUpdateBalance(selectedCustomer.customerName, finalBalance, fullReason);

      setAdjustmentAmount('');
      setAdjustmentReason('');
      window.history.back(); // Closes modal

      // Optimistic update
      setSelectedCustomer({
        ...selectedCustomer,
        remainingBalance: finalBalance
      });
    }
    // CASE 2: New Customer
    else if (!selectedCustomer && newCustomerName && amount >= 0) {
      // Logic: Initial Balance = Amount (if Debt) or -Amount (if Credit)
      const finalBalance = adjustmentType === 'DEBT' ? amount : -amount;
      const fullReason = adjustmentReason || 'Import Solde Initial';

      onUpdateBalance(newCustomerName, finalBalance, fullReason);

      setNewCustomerName('');
      setAdjustmentAmount('');
      setAdjustmentReason('');
      window.history.back(); // Closes modal
    }
  };

  // ... (keep existing JSX) ...



  // ... (keep appointments logic)

  // ... (keep stats logic)




  const handleAppointmentSubmit = () => {
    if (selectedCustomer && appointmentDate) {
      if (editingAppointmentId) {
        onUpdateAppointment(selectedCustomer.customerName, editingAppointmentId, appointmentDate, appointmentNote, notifyTiming);
        alert("Rendez-vous modifié !");
      } else {
        onAddAppointment(selectedCustomer.customerName, appointmentDate, appointmentNote, notifyTiming);
        alert("Rendez-vous programmé avec succès !");
      }
      window.history.back();
      setAppointmentDate('');
      setAppointmentNote('');
      setEditingAppointmentId(null);
      setNotifyTiming(60);
    }
  };

  const openAppointmentModal = (customer?: CreditRecord, appointment?: any) => {
    // Push history state for back button support
    const currentState = window.history.state || {};
    window.history.pushState({ ...currentState, modalAppointment: true }, '');

    if (customer) setSelectedCustomer(customer);

    if (appointment) {
      setEditingAppointmentId(appointment.id);
      setAppointmentDate(appointment.date);
      setAppointmentNote(appointment.note);
      setNotifyTiming(60); // Default or load if we persisted it
    } else {
      setEditingAppointmentId(null);
      setAppointmentDate('');
      setAppointmentNote('');
    }
    setShowAppointmentModal(true);
  };




  const [showStatsModal, setShowStatsModal] = useState(false);
  const [statsFilter, setStatsFilter] = useState<'DAY' | 'WEEK' | 'MONTH' | 'YEAR'>('DAY');

  const getFilteredPayments = () => {
    const now = new Date();
    return allPayments.filter(p => {
      const pDate = new Date(p.date);
      if (statsFilter === 'DAY') {
        return pDate.toDateString() === now.toDateString();
      } else if (statsFilter === 'WEEK') {
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return pDate >= oneWeekAgo;
      } else if (statsFilter === 'MONTH') {
        return pDate.getMonth() === now.getMonth() && pDate.getFullYear() === now.getFullYear();
      } else {
        return pDate.getFullYear() === now.getFullYear();
      }
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  const filteredStats = getFilteredPayments();
  const totalFilteredStats = filteredStats.reduce((acc, p) => acc + p.amount, 0);


  return (
    <div className="space-y-6 pb-24 animate-in fade-in duration-500">
      {/* Dashboard Card Switchable */}
      <div className="grid grid-cols-2 gap-3">
        <div
          onClick={() => {
            const currentState = window.history.state || {};
            window.history.pushState({ ...currentState, modalStats: true }, '');
            setShowStatsModal(true);
          }}
          className="col-span-2 bg-emerald-900 p-6 rounded-[2rem] shadow-xl text-white relative overflow-hidden flex items-center justify-between group cursor-pointer hover:bg-emerald-800 transition-colors"
        >
          <div className="relative z-10">
            <p className="text-[9px] font-black uppercase tracking-widest opacity-60 mb-2">Total Encaissements (Revenus)</p>
            <h2 className="text-3xl font-black tracking-tight">{formatCurrency(allPayments.reduce((acc, p) => acc + p.amount, 0))} <span className="text-sm opacity-40">F CFA</span></h2>
            <p className="text-[9px] font-bold mt-2 flex items-center gap-1 opacity-80"><TrendingUp size={12} /> Cliquez pour voir détails</p>
          </div>
          <div className="bg-white/10 p-3 rounded-full">
            <Wallet size={32} className="text-emerald-300" />
          </div>
          <TrendingUp className="absolute -left-4 -bottom-4 text-white/5 rotate-180" size={120} />
          <div className="absolute right-0 top-0 w-32 h-32 bg-emerald-400/20 blur-3xl rounded-full"></div>
        </div>

        <div className="bg-blue-900 p-5 rounded-[2rem] shadow-xl text-white relative overflow-hidden">
          <p className="text-[8px] font-black uppercase tracking-widest opacity-60 mb-1">Total Dettes</p>
          <h2 className="text-xl font-black">{formatCurrency(totalGlobalDebt)} <span className="text-[10px] opacity-40">F</span></h2>
          <ArrowDownLeft className="absolute -right-2 -bottom-2 text-white/5" size={60} />
        </div>
        <div className="bg-green-700 p-5 rounded-[2rem] shadow-xl text-white relative overflow-hidden">
          <p className="text-[8px] font-black uppercase tracking-widest opacity-60 mb-1">Total Avances</p>
          <h2 className="text-xl font-black">{formatCurrency(totalGlobalPrepaid)} <span className="text-[10px] opacity-40">F</span></h2>
          <PiggyBank className="absolute -right-2 -bottom-2 text-white/5" size={60} />
        </div>
      </div>

      {/* STATS MODAL */}
      {showStatsModal && (
        <div className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg max-h-[90vh] rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95 duration-200">
            <div className="bg-emerald-900 p-6 text-white flex justify-between items-center shrink-0">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Rapport Financier</p>
                <h3 className="text-xl font-black uppercase">Encaissements</h3>
              </div>
              <button onClick={() => window.history.back()} className="bg-white/10 p-2 rounded-full hover:bg-white/20"><X size={20} /></button>
            </div>

            <div className="p-4 bg-emerald-50 border-b border-emerald-100 flex gap-2 overflow-x-auto shrink-0 no-scrollbar">
              {[
                { id: 'DAY', label: "Aujourd'hui" },
                { id: 'WEEK', label: '7 Jours' },
                { id: 'MONTH', label: 'Ce Mois' },
                { id: 'YEAR', label: 'Année' }
              ].map((filter) => (
                <button
                  key={filter.id}
                  onClick={() => setStatsFilter(filter.id as any)}
                  className={`flex-1 py-2 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${statsFilter === filter.id ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200' : 'bg-white text-emerald-800 border border-emerald-100'
                    }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            <div className="p-6 text-center shrink-0">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Total Période</p>
              <h2 className="text-4xl font-black text-emerald-600 tracking-tight">{formatCurrency(totalFilteredStats)} <span className="text-lg text-emerald-300">F</span></h2>
            </div>

            <div className="flex-grow overflow-y-auto p-4 space-y-3 bg-gray-50/50">
              {filteredStats.length > 0 ? (
                filteredStats.map((p) => (
                  <div key={p.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
                        <TrendingUp size={16} />
                      </div>
                      <div>
                        <p className="text-xs font-black text-gray-900 uppercase">{p.customerName}</p>
                        <p className="text-[9px] text-gray-400 font-bold">{new Date(p.date).toLocaleString()}</p>
                      </div>
                    </div>
                    <p className="font-black text-emerald-600 text-sm">+{formatCurrency(p.amount)} F</p>
                  </div>
                ))
              ) : (
                <div className="text-center py-10 opacity-40">
                  <p className="font-bold text-gray-400 text-xs">Aucun encaissement sur cette période</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TABS & CLIENT LIST (Existing Code) */}
      {!selectedCustomer && (
        <div className="flex bg-white p-1 rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
          <button
            onClick={() => setActiveTab('debtors')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'debtors' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400'}`}
          >
            <ArrowUpRight size={14} /> DETTES
          </button>
          <button
            onClick={() => setActiveTab('prepaid')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'prepaid' ? 'bg-green-600 text-white shadow-lg' : 'text-gray-400'}`}
          >
            <PiggyBank size={14} /> AVANCES
          </button>
          <button
            onClick={() => setActiveTab('payments')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'payments' ? 'bg-gray-800 text-white shadow-lg' : 'text-gray-400'}`}
          >
            <History size={14} /> ENCAISSEMENTS
          </button>
          <button
            onClick={() => setActiveTab('agenda')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'agenda' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-400'}`}
          >
            <Calendar size={14} /> Agenda
          </button>
        </div>
      )}

      {!selectedCustomer ? (
        <div key={activeTab} className="flex flex-col gap-4 animate-in fade-in duration-300 w-full">
          {activeTab === 'agenda' ? (
            <div className="space-y-3">
              <div className="flex justify-between items-center px-2">
                <h3 className="text-xs font-black uppercase text-gray-400">Rendez-vous programmés</h3>
                <button onClick={() => { setSelectedCustomer(null); /* Force user to go to Client Profile to add? Or add generic Select? For now, keep simple: Add from Client Profile */ }} className="text-[10px] text-gray-400">Pour ajouter, aller sur le profil client</button>
              </div>

              {allAppointments.length > 0 ? allAppointments.map(appt => (
                <div key={appt.id} className={`p-4 rounded-2xl border flex justify-between items-center ${appt.completed ? 'bg-gray-50 border-gray-100 opacity-60' : 'bg-white border-indigo-100 shadow-sm'}`}>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => onToggleAppointment(appt.customerName, appt.id)}
                      className={`p-2 rounded-full border-2 ${appt.completed ? 'bg-green-100 border-green-200 text-green-600' : 'border-gray-200 text-gray-300 hover:border-green-500 hover:text-green-500'}`}
                    >
                      <FileCheck size={16} />
                    </button>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className={`font-black uppercase text-xs ${appt.completed ? 'line-through text-gray-400' : 'text-indigo-900'}`}>{appt.customerName}</h4>
                        {new Date(appt.date) < new Date() && !appt.completed && <span className="bg-red-100 text-red-600 text-[8px] px-1 rounded font-bold">EN RETARD</span>}
                      </div>
                      <p className="text-[10px] font-bold text-gray-500">{new Date(appt.date).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                      {appt.note && <p className="text-[9px] italic text-gray-400 mt-1">"{appt.note}"</p>}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openAppointmentModal(credits.find(c => c.customerName === appt.customerName), appt)}
                      className="p-2 bg-gray-50 text-blue-600 rounded-lg active:scale-95"
                      disabled={appt.completed}
                    >
                      <Settings size={16} />
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm("Supprimer ce rendez-vous ?")) {
                          onCancelAppointment(appt.customerName, appt.id);
                        }
                      }}
                      className="p-2 bg-red-50 text-red-600 rounded-lg active:scale-95"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              )) : (
                <div className="text-center py-12 bg-white rounded-3xl border-2 border-dashed border-gray-100">
                  <Calendar size={48} className="mx-auto text-indigo-100 mb-4" />
                  <p className="text-gray-400 font-black uppercase text-[10px]">Aucun rendez-vous prévu</p>
                </div>
              )}
            </div>
          ) : (activeTab === 'debtors' || activeTab === 'prepaid') ? (
            <div className="flex flex-col gap-4 w-full">
              {/* Search + Add Client Button */}
              <div className="relative flex gap-2">
                <div className="relative flex-grow">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="text"
                    placeholder="Chercher un client..."
                    className="w-full pl-12 pr-4 py-4 bg-white border border-gray-200 rounded-2xl shadow-sm focus:ring-2 focus:ring-blue-500 outline-none font-bold uppercase text-xs"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <button
                  onClick={() => {
                    setSelectedCustomer(null);
                    setNewCustomerName('');
                    setAdjustmentAmount('');
                    setAdjustmentReason('');
                    const currentState = window.history.state || {};
                    window.history.pushState({ ...currentState, modalAdjustment: true }, '');
                    setShowAdjustmentModal(true);
                  }}
                  className="bg-blue-900 text-white px-4 rounded-xl shadow-lg active:scale-95 transition-all flex items-center justify-center"
                >
                  <Plus size={24} />
                </button>
              </div>

              <div className="space-y-3">
                {filteredList.length > 0 ? filteredList.map(credit => (
                  <button
                    key={credit.id}
                    onClick={() => {
                      window.history.pushState({ step: 'CREDIT', customerDetail: true }, '');
                      setSelectedCustomer(credit);
                    }}
                    className="w-full bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between hover:border-blue-300 transition-all active:scale-98 group"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center border transition-colors ${credit.remainingBalance > 0 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                        <User size={24} />
                      </div>
                      <div className="text-left">
                        <h3 className="font-black text-gray-900 uppercase text-xs truncate max-w-[150px]">{credit.customerName}</h3>
                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                          {credit.remainingBalance > 0 ? 'Dette' : 'Avoir disponible'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-black ${credit.remainingBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {formatCurrency(Math.abs(credit.remainingBalance))} F
                      </p>
                      <div className="flex items-center justify-end text-[8px] font-bold text-blue-400 uppercase">
                        Détails <ChevronRight size={12} />
                      </div>
                    </div>
                  </button>
                )) : (
                  <div className="text-center py-20 bg-white rounded-[2rem] border-2 border-dashed border-gray-100">
                    <User size={48} className="mx-auto text-gray-100 mb-4" />
                    <p className="text-gray-400 font-black uppercase text-[10px]">Aucun client trouvé ici</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {allPayments.length > 0 ? allPayments.map((p) => (
                <div key={p.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-50 text-green-600 rounded-lg">
                      <ArrowDownLeft size={18} />
                    </div>
                    <div>
                      <p className="text-xs font-black text-gray-900 uppercase">{p.customerName}</p>
                      <p className="text-[9px] text-gray-400 font-bold">{new Date(p.date).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className={`font-black ${p.status === 'CANCELLED' ? 'text-gray-400 line-through' : 'text-green-600'}`}>{formatCurrency(p.amount)} F</p>

                    {p.status !== 'CANCELLED' && (
                      <button
                        onClick={() => {
                          if (window.confirm("Voulez-vous vraiment ANNULER ce versement ?")) {
                            onCancelPayment(p.customerName || '', p.id, p.amount);
                          }
                        }}
                        className="p-2 bg-red-50 text-red-600 rounded-lg active:scale-95 border border-red-100"
                      >
                        <Ban size={16} />
                      </button>
                    )}

                    <button
                      onClick={() => onGenerateReceipt(p.customerName || '', p.amount, p.date, p.id)}
                      className={`p-2 rounded-lg active:scale-90 transition-all ${p.status === 'CANCELLED' ? 'bg-gray-100 text-gray-300 cursor-not-allowed' : 'bg-blue-50 text-blue-600'}`}
                      disabled={p.status === 'CANCELLED'}
                    >
                      <Printer size={16} />
                    </button>
                  </div>
                </div>
              )) : (
                <div className="text-center py-12 bg-white rounded-3xl border-2 border-dashed border-gray-100">
                  <p className="text-gray-400 font-black uppercase text-[10px]">Aucun mouvement de caisse</p>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6 animate-in slide-in-from-right duration-300">
          <div className="flex items-center justify-between">
            <button onClick={() => window.history.back()} className="flex items-center gap-2 text-gray-500 font-bold uppercase text-[10px] bg-white px-4 py-2 rounded-xl active:scale-95 transition-all shadow-sm border border-gray-100">
              <ChevronRight className="rotate-180" size={14} /> Retour
            </button>
            <button onClick={handleShareProfile} className="flex items-center gap-2 text-white font-bold uppercase text-[10px] bg-blue-600 px-4 py-2 rounded-xl active:scale-95 transition-all shadow-lg shadow-blue-200">
              <Share2 size={14} /> Partager Profil
            </button>
          </div>

          {/* CUSTOMER PROFILE HEADER */}
          <div className="bg-white rounded-[2rem] border border-gray-100 shadow-xl overflow-hidden relative">
            <div className={`p-6 pb-12 ${calculateStats(selectedCustomer).bg}`}>
              <div className="flex justify-between items-start">
                <div className="bg-white p-4 rounded-2xl shadow-sm inline-block">
                  <User size={32} className={calculateStats(selectedCustomer).color} />
                </div>
                <div className="text-right">
                  <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white shadow-sm text-[10px] font-black uppercase ${calculateStats(selectedCustomer).color}`}>
                    {calculateStats(selectedCustomer).score >= 90 ? <Award size={12} /> : <Shield size={12} />}
                    Score Crédit : {calculateStats(selectedCustomer).score}/100
                  </div>
                </div>
              </div>
              <div className="mt-4">
                <h2 className="text-2xl font-black text-gray-900 uppercase leading-none mb-1">{selectedCustomer.customerName}</h2>
                <p className={`text-xs font-bold uppercase ${calculateStats(selectedCustomer).color}`}>{calculateStats(selectedCustomer).label}</p>
              </div>
            </div>

            <div className="bg-white p-6 -mt-6 rounded-t-[2rem] relative z-10 grid grid-cols-2 gap-4">
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 text-center">
                <p className="text-[9px] font-black uppercase text-gray-400 mb-1">Dette Totale</p>
                <p className={`text-xl font-black ${selectedCustomer.remainingBalance > 0 ? 'text-red-500' : 'text-gray-900'}`}>{formatCurrency(selectedCustomer.remainingBalance > 0 ? selectedCustomer.remainingBalance : 0)} F</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 text-center">
                <p className="text-[9px] font-black uppercase text-gray-400 mb-1">Confiance</p>
                <div className="flex justify-center gap-0.5 mt-1">
                  {[1, 2, 3, 4, 5].map(s => (
                    <Star
                      key={s}
                      size={14}
                      className={`${s <= (calculateStats(selectedCustomer).score / 20) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200'}`}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="px-6 pb-6 pt-0 space-y-3">
              <button
                onClick={() => {
                  setIsPrepaidAction(false);
                  const currentState = window.history.state || {};
                  window.history.pushState({ ...currentState, modalPayment: true }, '');
                  setShowPaymentModal(true);
                }}
                className="w-full bg-blue-900 text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 active:scale-95 transition-all"
              >
                <Banknote size={20} /> Règlement / Versement
              </button>
              <div className="w-full">
                <button
                  onClick={() => {
                    if (selectedCustomer.customerName) {
                      // Assuming we might have phone in credits, but currently credits only has customerName. 
                      // We rely on the App.tsx loop to find phone, but here we don't have it easily.
                      // The 'window.open' link logic was not fully implemented in previous code block (it was just a button with no onClick).
                      // I will add the onClick logic as a bonus if possible, or just keep style.
                    }
                  }}
                  className="w-full bg-gray-50 text-gray-600 py-3 rounded-xl font-black uppercase text-[10px] tracking-wide border border-gray-100 flex items-center justify-center gap-2 active:scale-95 transition-all"
                >
                  <MessageCircle size={16} /> Contacter
                </button>
              </div>

              <button
                onClick={() => openAppointmentModal(selectedCustomer)}
                className="w-full bg-indigo-50 text-indigo-700 py-3 rounded-xl font-black uppercase text-[10px] tracking-wide border border-indigo-100 flex items-center justify-center gap-2 active:scale-95 transition-all"
              >
                <CalendarClock size={16} /> Programmer un Rappel / RDV
              </button>

              <button
                onClick={() => {
                  const currentState = window.history.state || {};
                  window.history.pushState({ ...currentState, modalAdjustment: true }, '');
                  setShowAdjustmentModal(true);
                }}
                className="w-full mt-3 bg-gray-900 text-white py-3 rounded-xl font-black uppercase text-[10px] tracking-wide border border-gray-700 flex items-center justify-center gap-2 active:scale-95 transition-all opacity-50 hover:opacity-100"
              >
                <Settings size={14} /> Ajuster Manuellement Solde
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {/* AGENDA / APPOINTMENTS SECTION */}
            {selectedCustomer.appointments && selectedCustomer.appointments.filter(a => !a.completed).length > 0 && (
              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase tracking-widest px-2 flex items-center gap-2 text-indigo-900">
                  <CalendarClock size={16} className="text-indigo-500" /> Agenda & Rappels
                </h4>
                {selectedCustomer.appointments.filter(a => !a.completed).map((apt) => (
                  <div key={apt.id} className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
                        <Calendar size={18} />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-indigo-900 uppercase">{new Date(apt.date).toLocaleString()}</p>
                        <p className="text-[9px] text-indigo-500 font-bold">{apt.note || 'Pas de note'}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        if (window.confirm("Annuler ce rendez-vous ?")) {
                          onCancelAppointment(selectedCustomer.customerName, apt.id);
                        }
                      }}
                      className="p-2 bg-white text-red-500 rounded-lg shadow-sm border border-red-100 active:scale-95"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <h4 className="text-xs font-black uppercase tracking-widest px-2 flex items-center gap-2">

              <FileSignature size={16} className="text-blue-500" /> Contrats & Historique
            </h4>
            <div className="space-y-3">
              {selectedCustomer.history.map((h) => (
                <div key={h.id} className="bg-white p-4 rounded-2xl border border-gray-50 shadow-sm flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl ${h.type === 'INVOICE' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                      {h.type === 'INVOICE' ? <FileSignature size={18} /> : <ArrowDownLeft size={18} />}
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-gray-900 uppercase truncate max-w-[150px]">{h.description}</p>
                      <p className="text-[9px] text-gray-400 font-bold">{new Date(h.date).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="text-right flex items-center gap-3">
                    <p className={`font-black text-sm ${h.type === 'INVOICE' ? 'text-red-600' : 'text-green-600'}`}>
                      {formatCurrency(h.amount)} F
                    </p>
                    {h.type === 'PAYMENT' ? (
                      <div className="flex gap-2">
                        {h.status !== 'CANCELLED' && (
                          <button
                            onClick={() => {
                              if (window.confirm("Voulez-vous vraiment ANNULER ce versement ?\n\nUn reçu d'annulation sera généré.")) {
                                onCancelPayment(selectedCustomer.customerName, h.id, h.amount);
                              }
                            }}
                            className="p-2 bg-red-50 text-red-600 rounded-lg active:scale-95 border border-red-100"
                            title="Annuler Transaction"
                          >
                            <Ban size={16} />
                          </button>
                        )}
                        <button
                          onClick={() => onGenerateReceipt(selectedCustomer.customerName, h.amount, h.date, h.id)}
                          className={`p-2 rounded-lg active:scale-95 ${h.status === 'CANCELLED' ? 'bg-gray-100 text-gray-300 cursor-not-allowed' : 'bg-blue-50 text-blue-600'}`}
                          disabled={h.status === 'CANCELLED'}
                        >
                          <Printer size={16} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => openContract(h)}
                        className="p-2 bg-gray-50 text-gray-600 rounded-lg active:scale-95 border border-gray-100"
                        title="Voir le contrat"
                      >
                        <FileSignature size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-blue-950/60 backdrop-blur-md z-[110] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className={`p-8 text-white flex justify-between items-start ${isPrepaidAction ? 'bg-green-600' : 'bg-blue-900'}`}>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">{isPrepaidAction ? 'Épargne Achat' : 'Encaissement'}</p>
                <h3 className="text-2xl font-black uppercase leading-tight">{isPrepaidAction ? 'Charger Compte' : 'Versement'}</h3>
              </div>
              <button onClick={() => window.history.back()} className="bg-white/20 p-2 rounded-full"><X size={24} /></button>
            </div>
            <div className="p-8 space-y-6">
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex items-center gap-3">
                <Info size={16} className="text-blue-500" />
                <p className="text-[9px] font-bold text-gray-500 uppercase leading-tight">Ce montant sera déduit du solde du client et un reçu lui sera délivré.</p>
              </div>
              <div className="relative">
                <input
                  autoFocus
                  type="number"
                  className={`w-full p-5 bg-gray-50 border-2 rounded-2xl text-3xl font-black outline-none focus:ring-4 transition-all ${isPrepaidAction ? 'border-green-100 text-green-700 focus:ring-green-500/10' : 'border-blue-100 text-blue-900 focus:ring-blue-500/10'}`}
                  placeholder="0"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-gray-200 text-2xl">F</span>
              </div>
              <button
                onClick={handlePaymentSubmit}
                className={`w-full py-5 rounded-2xl font-black uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 active:scale-95 transition-all ${isPrepaidAction ? 'bg-green-600 shadow-green-100' : 'bg-blue-900 shadow-blue-100'} text-white`}
              >
                <FileCheck size={20} /> Valider & Créer Reçu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contract Preview Modal */}
      {showContractModal && selectedContractInvoice && selectedCustomer && (
        <div className="fixed inset-0 bg-gray-900/90 backdrop-blur-sm z-[120] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md max-h-[90vh] overflow-y-auto rounded-xl shadow-2xl animate-in zoom-in-95 duration-300 relative">

            {/* Paper Header / Actions */}
            <div className="sticky top-0 z-50 bg-gray-100 border-b border-gray-200 p-3 flex justify-between items-center">
              <h3 className="text-xs font-black uppercase text-gray-500">Aperçu du Document</h3>
              <button onClick={() => window.history.back()} className="bg-gray-300 hover:bg-red-500 hover:text-white text-gray-700 p-2 rounded-lg transition-colors"><X size={18} /></button>
            </div>

            {/* Paper Style */}
            <div id="contract-paper" className="bg-[#fffefe] p-8 min-h-[500px] flex flex-col relative text-gray-800 font-serif border-x-8 border-b-8 border-double border-gray-100">
              <div className="text-center border-b-2 border-black pb-4 mb-6">
                <h2 className="text-2xl font-bold uppercase tracking-widest text-black">Reconnaissance de Dette</h2>
                <p className="text-xs italic mt-1 text-gray-500">Document certifié conforme - Mali-Facture</p>
              </div>

              <div className="space-y-6 flex-grow text-sm leading-loose">
                <p>
                  Je soussigné(e), <br />
                  <strong className="text-lg uppercase">{selectedCustomer.customerName}</strong>
                </p>
                <p>
                  Reconnais devoir à l'entreprise :<br />
                  <strong>MALI-FACTURE COMMERCE</strong>
                </p>
                <p>
                  La somme de :<br />
                  <strong className="text-xl border-b border-black">{formatCurrency(selectedContractInvoice.amount)} Francs CFA</strong>
                </p>
                <p>
                  Au titre de : <br />
                  <span className="italic">{selectedContractInvoice.description}</span>
                </p>
                <div className="my-8 text-right">
                  <p className="mb-8">Fait le {new Date(selectedContractInvoice.date).toLocaleDateString()}, à Bamako.</p>
                  <div className="border border-dashed border-gray-400 h-24 w-40 ml-auto flex items-center justify-center bg-gray-50 text-gray-400 text-xs">
                    Signature & Cachet
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 flex gap-3 font-sans shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
              <button onClick={handleShareContract} className="flex-1 bg-green-600 text-white py-3 font-bold uppercase text-xs rounded-xl flex items-center justify-center gap-2 hover:bg-green-700 transition-colors shadow-lg">
                <Share2 size={16} /> WhatsApp PDF
              </button>
              <button onClick={() => window.print()} className="flex-1 bg-gray-100 text-gray-900 py-3 font-bold uppercase text-xs rounded-xl flex items-center justify-center gap-2 hover:bg-gray-200 transition-colors">
                <Printer size={16} /> Imprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Appointment Modal */}
      {showAppointmentModal && selectedCustomer && (
        <div className="fixed inset-0 bg-blue-950/60 backdrop-blur-md z-[120] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="bg-indigo-900 p-8 text-white flex justify-between items-start">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">Agenda</p>
                <h3 className="text-xl font-black uppercase leading-tight">{editingAppointmentId ? 'Modifier RDV' : 'Nouveau Rappel'}</h3>
              </div>
              <button onClick={() => window.history.back()} className="bg-white/20 p-2 rounded-full"><X size={24} /></button>
            </div>
            <div className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-gray-400 pl-2">Date & Heure</label>
                <input
                  type="datetime-local"
                  className="w-full p-4 bg-gray-50 border-2 border-gray-100 rounded-xl font-bold text-gray-900 outline-none focus:border-indigo-500"
                  value={appointmentDate}
                  onChange={(e) => setAppointmentDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-gray-400 pl-2">Motif (Optionnel)</label>
                <textarea
                  className="w-full p-4 bg-gray-50 border-2 border-gray-100 rounded-xl font-medium text-sm outline-none focus:border-indigo-500 min-h-[100px]"
                  placeholder="Ex: Promesse de paiement..."
                  value={appointmentNote}
                  onChange={(e) => setAppointmentNote(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-gray-400 pl-2">Notification (Rappel)</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setNotifyTiming(15)}
                    className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all border-2 ${notifyTiming === 15 ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-100 bg-gray-50 text-gray-400'}`}
                  >
                    15 min avant
                  </button>
                  <button
                    onClick={() => setNotifyTiming(60)}
                    className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all border-2 ${notifyTiming === 60 ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-100 bg-gray-50 text-gray-400'}`}
                  >
                    1 H avant
                  </button>
                </div>
              </div>
              <button
                onClick={() => {
                  handleAppointmentSubmit();
                  if (activeTab === 'agenda') setSelectedCustomer(null);
                }}
                disabled={!appointmentDate}
                className="w-full py-4 bg-indigo-600 text-white rounded-xl font-black uppercase tracking-widest text-xs hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-indigo-200"
              >
                {editingAppointmentId ? 'Sauvegarder Modifs' : 'Confirmer le RDV'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Transaction Modal */}

      {showAdjustmentModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[130] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-[2rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="bg-gray-900 p-6 text-white flex justify-between items-center">
              <h3 className="font-black uppercase tracking-widest text-sm">{selectedCustomer ? 'Ajouter Transaction' : 'Nouveau Client / Dossier'}</h3>
              <button onClick={() => window.history.back()} className="bg-white/10 p-2 rounded-full hover:bg-white/20"><X size={16} /></button>
            </div>
            <div className="p-6 space-y-4">

              {/* Input Type Buttons */}
              <div className="flex bg-gray-100 p-1 rounded-xl">
                <button
                  onClick={() => setAdjustmentType('DEBT')}
                  className={`flex-1 py-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${adjustmentType === 'DEBT' ? 'bg-red-500 text-white shadow-lg' : 'text-gray-400'}`}
                >
                  {selectedCustomer ? 'Ajouter Dette (+)' : 'Solde Débiteur (Doit)'}
                </button>
                <button
                  onClick={() => setAdjustmentType('CREDIT')}
                  className={`flex-1 py-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${adjustmentType === 'CREDIT' ? 'bg-green-500 text-white shadow-lg' : 'text-gray-400'}`}
                >
                  {selectedCustomer ? 'Ajouter Avoir (-)' : 'Solde Créditeur (A)'}
                </button>
              </div>

              {/* Customer Name Input if Creating */}
              {!selectedCustomer && (
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-gray-400 pl-2">Nom du Client</label>
                  <input
                    type="text"
                    autoFocus
                    className="w-full p-4 bg-gray-50 border-2 border-gray-100 rounded-xl font-black text-sm outline-none focus:border-blue-500 uppercase"
                    placeholder="NOM FAMILLE"
                    value={newCustomerName}
                    onChange={e => setNewCustomerName(e.target.value)}
                  />
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-gray-400 pl-2">Montant {selectedCustomer ? '' : 'Initial'}</label>
                <input
                  type="number"
                  className="w-full p-4 bg-gray-50 border-2 border-gray-100 rounded-xl font-black text-2xl outline-none focus:border-blue-500"
                  placeholder="0"
                  value={adjustmentAmount}
                  onChange={e => setAdjustmentAmount(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-gray-400 pl-2">Motif (Ex: Prêt, Reprise...)</label>
                <input
                  type="text"
                  className="w-full p-4 bg-gray-50 border-2 border-gray-100 rounded-xl font-bold text-xs outline-none focus:border-blue-500"
                  placeholder="Facultatif"
                  value={adjustmentReason}
                  onChange={e => setAdjustmentReason(e.target.value)}
                />
              </div>

              {/* Balance Preview (Only for existing) */}
              {selectedCustomer && adjustmentAmount && (
                <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 flex justify-between items-center">
                  <span className="text-[9px] font-bold text-blue-400 uppercase">Nouveau Solde Prévu</span>
                  <span className="text-sm font-black text-blue-900">
                    {formatCurrency(selectedCustomer.remainingBalance + (adjustmentType === 'DEBT' ? parseFloat(adjustmentAmount) : -parseFloat(adjustmentAmount)))} F
                  </span>
                </div>
              )}

              <button
                onClick={handleAdjustmentSubmit}
                className="w-full py-4 bg-black text-white rounded-xl font-black uppercase tracking-widest text-xs hover:bg-gray-800"
              >
                {selectedCustomer ? 'Confirmer Ajout' : 'Créer Dossier'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div >
  );
};

export default CreditManager;
