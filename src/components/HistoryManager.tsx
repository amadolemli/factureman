
import React, { useState } from 'react';
import { InvoiceData, DocumentType } from '../types';
import { formatCurrency } from '../utils/format';
import {
  Search, FileText, Trash2, Eye, Calendar, User,
  ChevronRight, Clock, MessageCircle, CopyPlus, X,
  CheckCircle2, AlertCircle, Receipt
} from 'lucide-react';

interface Props {
  history: InvoiceData[];
  onView: (invoice: InvoiceData) => void;
  onDelete: (id: string) => void;
  onShare: (invoice: InvoiceData) => void;
  onConvert: (invoice: InvoiceData, newType: DocumentType) => void;
  onRestore: (id: string) => void;
  onPermanentDelete: (id: string) => void;
}

const HistoryManager: React.FC<Props> = ({ history, onView, onDelete, onShare, onConvert, onRestore, onPermanentDelete }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<DocumentType | 'ALL'>('ALL');
  const [activeConvertId, setActiveConvertId] = useState<string | null>(null);
  const [isTrashView, setIsTrashView] = useState(false); // Toggle for Trash View

  // Helper to safely format date for search comparison
  const formatDateForSearch = (isoString: string) => {
    try {
      return new Date(isoString).toLocaleDateString('fr-FR');
    } catch {
      return '';
    }
  };

  const filteredHistory = history
    .filter(item => {
      // TRASH FILTER: Show only deleted if isTrashView, else show non-deleted
      if (isTrashView) {
        if (!item.deletedAt) return false;
      } else {
        if (item.deletedAt) return false;
      }

      const term = searchTerm.toLowerCase();
      const total = item.items.reduce((acc, i) => acc + (i.quantity * i.unitPrice), 0).toString();

      const matchesSearch =
        item.customerName.toLowerCase().includes(term) ||
        item.number.toLowerCase().includes(term) ||
        (item.customerPhone && item.customerPhone.includes(term)) ||
        formatDateForSearch(item.date).includes(term) ||
        total.includes(term);

      const matchesType = filterType === 'ALL' || item.type === filterType;

      return matchesSearch && matchesType;
    })
    .sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : new Date(a.date).getTime();
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : new Date(b.date).getTime();
      return timeB - timeA;
    });

  const getBadgeColors = (type: DocumentType) => {
    switch (type) {
      case DocumentType.DELIVERY_NOTE: return "bg-green-100 text-green-700 border-green-200";
      case DocumentType.PURCHASE_ORDER: return "bg-orange-100 text-orange-700 border-orange-200";
      case DocumentType.PROFORMA: return "bg-purple-100 text-purple-700 border-purple-200";
      case DocumentType.RECEIPT: return "bg-green-600 text-white border-green-700";
      default: return "bg-blue-100 text-blue-700 border-blue-200";
    }
  };

  const calculateTotal = (items: any[]) => {
    return items.reduce((acc, item) => acc + (item.quantity * item.unitPrice), 0);
  };

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500">
      <div className={`bg-white p-4 rounded-2xl shadow-sm border ${isTrashView ? 'border-red-200 bg-red-50' : 'border-gray-200'} sticky top-0 z-30 transition-colors`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`${isTrashView ? 'bg-red-600' : 'bg-blue-900'} p-2 rounded-lg transition-colors`}>
              {isTrashView ? <Trash2 className="text-white" size={20} /> : <Clock className="text-white" size={20} />}
            </div>
            <div>
              <h2 className={`text-xl font-black ${isTrashView ? 'text-red-900' : 'text-gray-900'}`}>
                {isTrashView ? 'Corbeille' : 'Historique'}
              </h2>
              <p className={`text-xs font-bold uppercase tracking-widest ${isTrashView ? 'text-red-400' : 'text-gray-500'}`}>
                {isTrashView ? 'Éléments supprimés' : 'Registre des documents'}
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsTrashView(!isTrashView)}
            className={`p-2 rounded-xl transition-all flex items-center gap-2 font-bold text-xs uppercase ${isTrashView
              ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              : 'bg-red-100 text-red-600 hover:bg-red-200'
              }`}
            title={isTrashView ? "Retour à l'historique" : "Voir la corbeille"}
          >
            {isTrashView ? <Clock size={16} /> : <Trash2 size={16} />}
            <span className="hidden sm:inline">{isTrashView ? 'Historique' : 'Corbeille'}</span>
          </button>
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Client, N°, Tél, Date..."
            className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-medium text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          <button
            onClick={() => setFilterType('ALL')}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase whitespace-nowrap transition-colors border ${filterType === 'ALL'
              ? (isTrashView ? 'bg-red-600 text-white border-red-600' : 'bg-blue-900 text-white border-blue-900')
              : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
              }`}
          >
            Tout voir
          </button>
          {Object.values(DocumentType).map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase whitespace-nowrap transition-colors border ${filterType === type
                ? getBadgeColors(type).replace('bg-', 'bg-opacity-100 bg-').replace('text-', 'text-white text-').split(' ')[0] + ' text-white border-transparent'
                : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                }`}
              style={filterType === type ? { backgroundColor: type === DocumentType.RECEIPT ? '#16a34a' : (isTrashView ? '#dc2626' : 'rgb(30, 58, 138)') } : {}}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {filteredHistory.length > 0 ? (
          filteredHistory.map((item) => {
            const total = calculateTotal(item.items);
            const paid = item.amountPaid || 0;
            const isUnpaid = total > paid && item.type !== DocumentType.RECEIPT;
            const isReceipt = item.type === DocumentType.RECEIPT;

            return (
              <div key={item.id} className={`bg-white rounded-2xl border shadow-sm group hover:border-blue-300 transition-all ${isTrashView ? 'opacity-80 hover:opacity-100 border-red-100' : (isUnpaid ? 'border-orange-200' : 'border-gray-100')}`}>
                <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative">
                  <div className="flex items-center gap-4 w-full sm:w-auto">
                    <div className={`p-3 rounded-xl border ${getBadgeColors(item.type)} ${isTrashView ? 'grayscale' : ''}`}>
                      {isReceipt ? <Receipt size={24} /> : <FileText size={24} />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">{item.number}</span>
                        <span className={`text-[7px] font-black px-1.5 py-0.5 rounded-full border uppercase ${getBadgeColors(item.type)}`}>
                          {item.type}
                        </span>
                        {isTrashView && (
                          <span className="flex items-center gap-0.5 text-[7px] font-black text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full border border-red-100 uppercase">
                            <Trash2 size={8} /> Supprimé
                          </span>
                        )}
                        {!isTrashView && isUnpaid ? (
                          <span className="flex items-center gap-0.5 text-[7px] font-black text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded-full border border-orange-100 uppercase">
                            <AlertCircle size={8} /> Impayé
                          </span>
                        ) : !isTrashView && !isReceipt && (
                          <span className="flex items-center gap-0.5 text-[7px] font-black text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full border border-green-100 uppercase">
                            <CheckCircle2 size={8} /> Payé
                          </span>
                        )}
                      </div>
                      <h3 className="font-bold text-gray-900 uppercase truncate text-xs">
                        {item.customerName || "Client Comptant"}
                      </h3>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="flex items-center gap-1 text-[9px] text-gray-400 font-bold uppercase tracking-tighter">
                          <Calendar size={10} />
                          {new Date(item.date).toLocaleDateString('fr-FR')}
                        </span>
                        <span className={`font-black text-xs ${isTrashView ? 'text-gray-500 line-through' : (isReceipt ? 'text-green-600' : 'text-blue-900')}`}>
                          {formatCurrency(isReceipt ? paid : total)} F
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto border-t sm:border-t-0 border-gray-50 pt-3 sm:pt-0">
                    {isTrashView ? (
                      /* TRASH ACTIONS */
                      <>
                        <button
                          onClick={() => onRestore(item.id)}
                          className="px-3 py-2 bg-green-50 text-green-600 hover:bg-green-100 rounded-xl transition-colors active:scale-90 flex items-center gap-1 text-[10px] font-bold uppercase"
                          title="Restaurer"
                        >
                          <Clock size={16} /> Restaurer
                        </button>
                      </>
                    ) : (
                      /* NORMAL ACTIONS */
                      <>
                        <button
                          onClick={() => onShare(item)}
                          className="p-2.5 text-[#25D366] hover:bg-green-50 rounded-xl transition-colors active:scale-90"
                          title="Partager WhatsApp"
                        >
                          <MessageCircle size={18} />
                        </button>

                        {!isReceipt && (
                          <div className="relative">
                            <button
                              onClick={() => setActiveConvertId(activeConvertId === item.id ? null : item.id)}
                              className={`p-2.5 rounded-xl transition-all ${activeConvertId === item.id ? 'bg-blue-600 text-white' : 'text-blue-400 hover:bg-blue-50'}`}
                              title="Convertir"
                            >
                              <CopyPlus size={18} />
                            </button>

                            {activeConvertId === item.id && (
                              <div className="absolute left-0 sm:left-auto sm:right-0 top-full mt-2 bg-white border border-gray-200 rounded-xl shadow-2xl z-20 p-2 w-48 animate-in zoom-in duration-200">
                                <div className="flex justify-between items-center px-2 py-1 mb-1 border-b">
                                  <span className="text-[8px] font-black uppercase text-gray-400">Convertir vers :</span>
                                  <button onClick={() => setActiveConvertId(null)}><X size={12} /></button>
                                </div>
                                {Object.values(DocumentType).filter(t => t !== item.type && t !== DocumentType.RECEIPT).map(type => (
                                  <button
                                    key={type}
                                    onClick={() => {
                                      onConvert(item, type);
                                      setActiveConvertId(null);
                                    }}
                                    className="w-full text-left p-2 hover:bg-blue-50 text-[9px] font-black text-blue-900 rounded-lg flex items-center justify-between"
                                  >
                                    {type} <ChevronRight size={12} />
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        <button
                          onClick={() => onView(item)}
                          className="p-2.5 text-blue-600 hover:bg-blue-50 rounded-xl transition-colors active:scale-90"
                          title="Ouvrir"
                        >
                          <Eye size={20} />
                        </button>

                        <button
                          onClick={() => { if (confirm("Mettre ce document à la corbeille ? (Les stocks et soldes seront rétablis)")) onDelete(item.id); }}
                          className="p-2.5 text-red-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors active:scale-90"
                          title="Mettre à la corbeille"
                        >
                          <Trash2 size={18} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-gray-100">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${isTrashView ? 'bg-red-50' : 'bg-gray-50'}`}>
              {isTrashView ? <Trash2 size={32} className="text-red-200" /> : <Clock size={32} className="text-gray-200" />}
            </div>
            <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">
              {isTrashView ? 'Corbeille vide' : 'Historique vide'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default HistoryManager;
