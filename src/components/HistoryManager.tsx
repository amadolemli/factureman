
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
}

const HistoryManager: React.FC<Props> = ({ history, onView, onDelete, onShare, onConvert }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeConvertId, setActiveConvertId] = useState<string | null>(null);

  const filteredHistory = history
    .filter(item =>
      item.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.number.toLowerCase().includes(searchTerm.toLowerCase())
    )
    ;

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
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-blue-900 p-2 rounded-lg">
            <Clock className="text-white" size={20} />
          </div>
          <div>
            <h2 className="text-xl font-black text-gray-900">Historique</h2>
            <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Registre des documents</p>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Chercher client ou N°..."
            className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-medium"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
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
              <div key={item.id} className={`bg-white rounded-2xl border shadow-sm overflow-hidden group hover:border-blue-300 transition-all ${isUnpaid ? 'border-orange-200' : 'border-gray-100'}`}>
                <div className="p-4 flex items-center justify-between relative">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-xl border ${getBadgeColors(item.type)}`}>
                      {isReceipt ? <Receipt size={24} /> : <FileText size={24} />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">{item.number}</span>
                        <span className={`text-[7px] font-black px-1.5 py-0.5 rounded-full border uppercase ${getBadgeColors(item.type)}`}>
                          {item.type}
                        </span>
                        {isUnpaid ? (
                          <span className="flex items-center gap-0.5 text-[7px] font-black text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded-full border border-orange-100 uppercase">
                            <AlertCircle size={8} /> Impayé
                          </span>
                        ) : !isReceipt && (
                          <span className="flex items-center gap-0.5 text-[7px] font-black text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full border border-green-100 uppercase">
                            <CheckCircle2 size={8} /> Payé
                          </span>
                        )}
                      </div>
                      <h3 className="font-bold text-gray-900 uppercase truncate max-w-[120px] sm:max-w-none text-xs">
                        {item.customerName || "Client Comptant"}
                      </h3>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="flex items-center gap-1 text-[9px] text-gray-400 font-bold uppercase tracking-tighter">
                          <Calendar size={10} /> {new Date(item.date).toLocaleDateString('fr-FR')}
                        </span>
                        <span className={`font-black text-xs ${isReceipt ? 'text-green-600' : 'text-blue-900'}`}>
                          {formatCurrency(total)} F
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 sm:gap-2">
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
                          <div className="absolute right-0 bottom-full mb-2 bg-white border border-gray-200 rounded-xl shadow-2xl z-50 p-2 w-48 animate-in zoom-in duration-200">
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
                      onClick={() => { if (confirm("Supprimer ce document de l'historique ?")) onDelete(item.id); }}
                      className="p-2.5 text-red-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors active:scale-90"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-gray-100">
            <div className="bg-gray-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock size={32} className="text-gray-200" />
            </div>
            <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">Historique vide</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default HistoryManager;
