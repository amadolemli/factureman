import React, { useMemo } from 'react';
import QRCode from 'react-qr-code';
import { InvoiceData, DocumentType } from '../types';
import { formatCurrency, numberToWords } from '../utils/format';

interface Props {
  data: InvoiceData;
  remainingBalance?: number;
}

// Helper: Pagination Logic
const paginate = <T,>(array: T[], size: number): T[][] => {
  if (!array.length) return [[]];
  const result: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
};

const InvoicePreview: React.FC<Props> = ({ data, remainingBalance }) => {
  // --- 1. COMMON LOGIC ---
  const isReceipt = data.type === DocumentType.RECEIPT;
  const subtotal = data.items.reduce((acc, item) => acc + (item.quantity * item.unitPrice), 0);
  const amountPaid = data.amountPaid || 0;
  const currentInvoiceBalance = subtotal - amountPaid;
  const isPriceHidden = [DocumentType.QUOTE, DocumentType.DELIVERY_NOTE, DocumentType.PURCHASE_ORDER].includes(data.type);

  const isFinalized = data.isFinalized;
  const snapshot = data.clientBalanceSnapshot;
  const balanceToShow = isFinalized ? snapshot : (remainingBalance ?? snapshot);
  const showClientBalance = isReceipt && balanceToShow !== undefined;

  const maskText = (text: string) => !isFinalized ? "• • • • •" : text;
  const maskDate = (date: string) => !isFinalized ? "••/••/••••" : new Date(date).toLocaleDateString('fr-FR');
  const verifyUrl = `${window.location.protocol}//${window.location.host}/verify/${data.id}`;

  const getColorClass = () => {
    switch (data.type) {
      case DocumentType.DELIVERY_NOTE: return "green";
      case DocumentType.PURCHASE_ORDER: return "orange";
      case DocumentType.PROFORMA: return "purple";
      case DocumentType.RECEIPT: return "green";
      default: return "blue";
    }
  };

  const colors = {
    blue: "text-blue-800 border-blue-800 bg-blue-50",
    green: "text-green-800 border-green-800 bg-green-50",
    orange: "text-orange-800 border-orange-800 bg-orange-50",
    purple: "text-purple-800 border-purple-800 bg-purple-50",
  };

  // --- 2. PAGINATION CONFIG ---
  const itemsPerPage = useMemo(() => {
    if (data.templateId === 'modern') return 18; // Increased to 18 (was 11)
    if (data.templateId === 'elegant') return 20; // Increased to 20 (was 12)
    return 22; // Increased to 22 (was 14)
  }, [data.templateId]);

  const pages = useMemo(() => paginate(data.items, itemsPerPage), [data.items, itemsPerPage]);

  // --- 3. TEMPLATE RENDERERS ---

  // --- CLASSIC TEMPLATE ---
  if (data.templateId === 'classic') {
    const c = getColorClass() as keyof typeof colors;

    return (
      <div id="invoice-preview-container" className="flex flex-col gap-8 bg-gray-50/50 print:bg-white print:gap-0">
        {pages.map((pageItems, index) => {
          const isLastPage = index === pages.length - 1;

          return (
            <div
              key={index}
              className="bg-white p-6 md:p-8 w-full max-w-[850px] mx-auto border-2 border-gray-800 shadow-xl relative min-h-[29.6cm] flex flex-col print:shadow-none print:border-0 print:m-0 print:w-full print:break-after-page"
              style={{ pageBreakAfter: isLastPage ? 'auto' : 'always' }}
            >
              {/* HEADER (Repeated) */}
              {data.business.customHeaderImage ? (
                <div className="mb-6 rounded-xl overflow-hidden border border-gray-200">
                  <img src={data.business.customHeaderImage} alt="En-tête" className="w-full object-contain max-h-40" />
                </div>
              ) : (
                <div className={`border-4 p-4 mb-6 rounded-xl ${colors[c].split(' ')[0]} ${colors[c].split(' ')[1]}`}>
                  {data.business.logo && (
                    <img src={data.business.logo} alt="Logo" className="h-16 mx-auto mb-2 object-contain" />
                  )}
                  <h1 className="text-2xl font-black text-center uppercase">{maskText(data.business.name)}</h1>
                  <p className="text-center text-xs font-bold border-t border-current mt-1 pt-1">{maskText(data.business.specialty)}</p>
                  <p className="text-center text-[10px] mt-1">{maskText(data.business.address)} - Tél: {maskText(data.business.phone)}</p>
                  {(data.business.nif || data.business.rccm) && (
                    <p className="text-center text-[9px] mt-0.5 text-gray-500 font-medium">
                      {data.business.nif && <span>NIF: {data.business.nif}</span>}
                      {data.business.nif && data.business.rccm && <span className="mx-1">•</span>}
                      {data.business.rccm && <span>RCCM: {data.business.rccm}</span>}
                    </p>
                  )}
                </div>
              )}

              {/* INFO BLOCK (Repeated) */}
              <div className="flex flex-col md:flex-row justify-between items-start mb-6 text-sm font-bold gap-4">
                <div className="w-full md:w-auto">
                  <span>Fait le {maskDate(data.date)} {data.createdAt && !isFinalized && <span className="text-gray-500 font-normal">à {new Date(data.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>}</span>
                  <div className="mt-2 space-y-1">
                    <div>
                      {isReceipt ? "REÇU DE :" : "CLIENT :"}
                      <span className="underline decoration-dotted ml-2 uppercase font-black block md:inline mt-1 md:mt-0">{!isFinalized ? "CLIENT MASQUÉ" : (data.customerName || "....................................")}</span>
                    </div>
                    {data.customerPhone && (
                      <div className="text-[10px] font-black text-gray-600">
                        TÉL CLIENT : <span className="font-bold">{maskText(data.customerPhone)}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="w-full md:w-auto text-left md:text-right flex flex-row md:flex-col items-center md:items-end justify-between md:justify-start gap-1 mt-4 md:mt-0">
                  <span className={`px-3 py-1 rounded-full border text-[10px] uppercase font-black ${colors[c]}`}>
                    {data.type}
                  </span>
                  <span className="text-[10px] text-gray-400 font-black">N° {maskText(data.number)}</span>
                  <span className="text-[10px] text-gray-500">Page {index + 1} / {pages.length}</span>
                </div>
              </div>

              {/* WATERMARKS (Repeated) */}
              {!isFinalized && (
                <div className="absolute inset-0 flex items-center justify-center p-10 pointer-events-none opacity-20 overflow-hidden z-0">
                  <p className="text-9xl font-black text-gray-400 -rotate-45 whitespace-nowrap select-none border-8 border-gray-400 p-10 rounded-[3rem]">BROUILLON</p>
                </div>
              )}
              {isFinalized && data.type === DocumentType.INVOICE && amountPaid < subtotal && (
                <div className="absolute inset-0 flex items-center justify-center p-10 pointer-events-none opacity-20 overflow-hidden z-0">
                  <p className="text-9xl font-black text-red-500 -rotate-45 whitespace-nowrap select-none border-8 border-red-500 p-10 rounded-[3rem]">IMPAYÉ</p>
                </div>
              )}
              {isFinalized && data.type === DocumentType.INVOICE && amountPaid >= subtotal && subtotal > 0 && (
                <div className="absolute inset-0 flex items-center justify-center p-10 pointer-events-none opacity-20 overflow-hidden z-0">
                  <p className="text-9xl font-black text-green-600 -rotate-45 whitespace-nowrap select-none border-8 border-green-600 p-10 rounded-[3rem]">PAYÉ</p>
                </div>
              )}

              {/* TABLE BODY (Chunked) - Added flex flex-col to push text down */}
              <div className="flex-grow flex flex-col">
                <table className="w-full border-2 border-gray-800">
                  <thead>
                    <tr className="bg-gray-100 uppercase text-[10px] font-black border-b-2 border-gray-800">
                      <th className="border-r-2 border-gray-800 p-2 w-12">Qté</th>
                      <th className={`${!isPriceHidden ? 'border-r-2' : ''} border-gray-800 p-2 text-left`}>Désignation</th>
                      {!isPriceHidden && (
                        <>
                          <th className="border-r-2 border-gray-800 p-2 w-24 text-right">Montant</th>
                          <th className="p-2 w-24 text-right">TOTAL</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody className="invoice-font text-xs">
                    {pageItems.map((item) => (
                      <tr key={item.id} className="border-b border-gray-200">
                        <td className="border-r-2 border-gray-800 p-2 text-center">{item.quantity}</td>
                        <td className={`${!isPriceHidden ? 'border-r-2' : ''} border-gray-800 p-2 uppercase`}>{item.description}</td>
                        {!isPriceHidden && (
                          <>
                            <td className="border-r-2 border-gray-800 p-2 text-right font-bold">{formatCurrency(item.unitPrice)}</td>
                            <td className="p-2 text-right font-black">{formatCurrency(item.quantity * item.unitPrice)}</td>
                          </>
                        )}
                      </tr>
                    ))}
                    {/* Empty Rows Padding */}
                    {Array.from({ length: Math.max(0, itemsPerPage - pageItems.length) }).map((_, i) => (
                      <tr key={`empty-${i}`} className="h-6 border-b border-gray-50">
                        <td className="border-r-2 border-gray-800"></td><td className={`${!isPriceHidden ? 'border-r-2' : ''} border-gray-800`}></td>
                        {!isPriceHidden && <><td className="border-r-2 border-gray-800"></td><td></td></>}
                      </tr>
                    ))}
                  </tbody>

                  {/* FOOTER TOTALS (ONLY LAST PAGE) */}
                  {!isPriceHidden && isLastPage && (
                    <tfoot>
                      <tr className="border-t-2 border-gray-800 bg-gray-50 font-black">
                        <td colSpan={3} className="border-r-2 border-gray-800 p-2 text-right text-[10px] uppercase">TOTAL {isReceipt ? 'VERSÉ' : 'GÉNÉRAL'}</td>
                        <td className="p-2 text-right text-sm">{formatCurrency(subtotal)} F</td>
                      </tr>
                      {!isReceipt && amountPaid > 0 && (
                        <>
                          <tr className="border-t border-gray-300 font-bold bg-green-50/50">
                            <td colSpan={3} className="border-r-2 border-gray-800 p-2 text-right text-[10px] uppercase">ACOMPTE / PAYÉ</td>
                            <td className="p-2 text-right text-sm text-green-700">{formatCurrency(amountPaid)} F</td>
                          </tr>
                          <tr className="border-t-2 border-gray-800 font-black bg-red-50/50">
                            <td colSpan={3} className="border-r-2 border-gray-800 p-2 text-right text-[10px] uppercase text-red-600 tracking-widest">RELIQUAT (RESTE À PAYER)</td>
                            <td className="p-2 text-right text-sm text-red-600 underline decoration-double">{formatCurrency(currentInvoiceBalance)} F</td>
                          </tr>
                        </>
                      )}
                    </tfoot>
                  )}
                </table>

                {/* CONTINUE TEXT (NON-LAST PAGE) - Pushed to bottom via mt-auto */}
                {!isLastPage && (
                  <div className="mt-auto text-right text-xs italic font-bold text-gray-500 pt-4">
                    Suite page suivante...
                  </div>
                )}

                {/* WORD AMOUNT & BALANCE (LAST PAGE) */}
                {!isPriceHidden && isLastPage && (
                  <div className="mt-4 p-3 border border-gray-200 bg-gray-50 rounded-lg">
                    <p className="text-[8px] uppercase font-black text-gray-400">Somme en toutes lettres :</p>
                    <p className="italic text-xs font-black text-gray-800 uppercase leading-tight">{numberToWords(subtotal)}</p>
                  </div>
                )}

                {showClientBalance && isLastPage && (
                  <div className={`mt-4 p-4 border-2 rounded-xl flex justify-between items-center ${balanceToShow < 0 ? 'border-green-200 bg-green-50 shadow-inner' : 'border-red-200 bg-red-50'}`}>
                    <div>
                      <p className={`text-[10px] font-black uppercase tracking-widest ${balanceToShow < 0 ? 'text-green-400' : 'text-red-400'}`}>SITUATION COMPTE CLIENT (APRES OPÉRATION)</p>
                      <p className={`text-xs font-bold ${balanceToShow < 0 ? 'text-green-800' : 'text-red-800'}`}>{balanceToShow < 0 ? 'Votre nouveau solde disponible (Avoir) :' : 'Votre Reliquat (Dette Restante) à ce jour :'}</p>
                    </div>
                    <p className={`text-xl font-black ${balanceToShow < 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(Math.abs(balanceToShow))} F</p>
                  </div>
                )}
              </div>

              {/* FOOTER & SIGNATURES (LAST PAGE) */}
              {isLastPage && (
                <div className="mt-8 flex justify-between items-end text-[10px] font-black uppercase">
                  <div className="text-center">Signature du Client<div className="h-16"></div>...................</div>
                  {isFinalized && (
                    <div className="flex flex-col items-center opacity-80 mx-4">
                      <div className="bg-white p-1 border border-gray-200"><QRCode value={verifyUrl} size={48} /></div>
                      <p className="text-[6px] font-bold mt-1 tracking-wider text-gray-500">AUTHENTIQUE</p>
                    </div>
                  )}
                  <div className="text-center text-blue-900">
                    Le Gérant (La Boutique)
                    {data.business.signatureUrl ? (
                      <div className="h-16 flex items-center justify-center my-1"><img src={data.business.signatureUrl} alt="Signature" className="h-full object-contain" /></div>
                    ) : (
                      <div className="h-16 flex items-center justify-center text-[8px] text-gray-300 italic">Cachet & Signature</div>
                    )}
                  </div>
                </div>
              )}

              {/* FOOTER INFO (ALL PAGES) */}
              <div className="mt-8 pt-4 border-t border-gray-200 text-center text-[10px] text-gray-400 font-medium opacity-70 flex justify-between">
                <span>Généré par FactureMan</span>
                <span>Page {index + 1} / {pages.length}</span>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // --- MODERN TEMPLATE ---
  if (data.templateId === 'modern') {
    const colorKey = getColorClass() as 'blue' | 'green' | 'orange' | 'purple';
    const theme = {
      blue: { main: 'bg-slate-900', accent: 'text-blue-500', bgAccent: 'bg-blue-500', light: 'bg-slate-50', border: 'border-slate-200' },
      green: { main: 'bg-slate-900', accent: 'text-emerald-500', bgAccent: 'bg-emerald-500', light: 'bg-slate-50', border: 'border-slate-200' },
      orange: { main: 'bg-slate-900', accent: 'text-orange-500', bgAccent: 'bg-orange-500', light: 'bg-slate-50', border: 'border-slate-200' },
      purple: { main: 'bg-slate-900', accent: 'text-purple-500', bgAccent: 'bg-purple-500', light: 'bg-slate-50', border: 'border-slate-200' },
    }[colorKey];

    return (
      <div id="invoice-preview-container" className="flex flex-col gap-8 bg-gray-50/50 print:bg-white print:gap-0">
        {pages.map((pageItems, index) => {
          const isLastPage = index === pages.length - 1;

          return (
            <div
              key={index}
              className="bg-white w-full max-w-[850px] mx-auto shadow-2xl relative min-h-[29.6cm] flex flex-col font-sans print:shadow-none text-slate-800 print:break-after-page"
              style={{ pageBreakAfter: isLastPage ? 'auto' : 'always' }}
            >
              {/* MODERN HEADER (Repeated) */}
              {isReceipt ? (
                <div className="flex flex-col md:flex-row justify-between items-start mb-8 border-b-2 border-slate-100 pb-8 gap-6 p-8">
                  {/* Modern Receipt Header Logic - Copied & Simplified for brevity, normally huge block */}
                  {/* Simplified for chunking context: */}
                  <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className={`h-12 w-12 rounded-lg ${theme.bgAccent} flex items-center justify-center text-white font-bold text-xl shrink-0`}>{data.business.name.substring(0, 2)}</div>
                    <div>
                      <h1 className="text-xl font-bold uppercase tracking-tight text-slate-900">{maskText(data.business.name)}</h1>
                      <p className="text-[10px] text-slate-500 font-medium">{maskText(data.business.address)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`inline-block px-4 py-2 rounded-lg ${theme.bgAccent} mb-2`}>
                      <h2 className="text-sm font-black text-white uppercase tracking-widest text-right">REÇU DE PAGE {index + 1}</h2>
                    </div>
                  </div>
                </div>
              ) : (
                <div className={`${theme.main} text-white p-8 rounded-b-3xl relative overflow-hidden`}>
                  <div className={`absolute -right-10 -top-10 w-40 h-40 rounded-full ${theme.bgAccent} opacity-20 blur-2xl`}></div>
                  <div className="flex justify-between items-start relative z-10">
                    <div className="flex-1">
                      {data.business.customHeaderImage ? (
                        <img src={data.business.customHeaderImage} className="max-h-24 rounded-lg object-contain bg-white/10 p-2 backdrop-blur-sm" />
                      ) : (
                        <div>
                          <h1 className="text-2xl font-bold tracking-tight uppercase text-white">{maskText(data.business.name)}</h1>
                          <p className={`text-xs font-bold uppercase tracking-widest mt-1 ${theme.accent}`}>{maskText(data.business.specialty)}</p>
                          <p className="text-[10px] text-slate-300 font-medium mt-2 opacity-80">{maskText(data.business.address)}</p>
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className={`inline-block px-4 py-1.5 rounded-full ${theme.bgAccent} text-white mb-2 shadow-md relative z-20`}>
                        <h2 className="text-lg font-bold uppercase tracking-wide">{data.type}</h2>
                      </div>
                      <p className="text-xs font-light text-slate-300 opacity-80">Page {index + 1} / {pages.length}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* CLIENT SECTION (Repeated) */}
              <div className="px-8 mt-8">
                <div className={`${theme.light} rounded-2xl p-6 border ${theme.border} border-l-4 border-l-${colorKey}-500 relative`}>
                  <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-2">Facturé à</p>
                  <h3 className="text-xl font-bold text-slate-900">{!isFinalized ? "CLIENT MASQUÉ" : (data.customerName || "Client Comptant")}</h3>
                </div>
              </div>

              {/* TABLE (Chunked) - Added flex flex-col to push text down */}
              <div className="px-8 mt-10 flex-grow flex flex-col">
                <table className="w-full">
                  <thead>
                    <tr className="text-[10px] uppercase font-bold text-slate-400 border-b border-slate-100">
                      <th className="pb-3 text-left w-16 pl-2">Qté</th>
                      <th className="pb-3 text-left">Description</th>
                      {!isPriceHidden && <><th className="pb-3 text-right">Prix Unitaire</th><th className="pb-3 text-right pr-2">Total</th></>}
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {pageItems.map((item) => (
                      <tr key={item.id} className="group hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0">
                        <td className="py-4 pl-2 font-bold text-slate-500">{item.quantity}</td>
                        <td className="py-4 font-semibold text-slate-700">{item.description}</td>
                        {!isPriceHidden && (
                          <>
                            <td className="py-4 text-right text-slate-500 font-medium">{formatCurrency(item.unitPrice)}</td>
                            <td className="py-4 text-right pr-2 font-bold text-slate-900">{formatCurrency(item.quantity * item.unitPrice)}</td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* TOTALS (LAST PAGE) */}
                {!isPriceHidden && isLastPage && (
                  <div className="mt-8 flex justify-end">
                    <div className="w-64">
                      <div className="flex justify-between py-2 text-sm text-slate-500 border-t border-slate-100"><span>Sous-total</span><span className="font-semibold text-slate-900">{formatCurrency(subtotal)} F</span></div>
                      <div className={`${theme.main} text-white p-4 rounded-xl shadow-lg mt-2`}>
                        <div className="flex justify-between items-center"><span className="text-xs uppercase font-bold opacity-80">Total</span><span className="text-xl font-bold">{formatCurrency(isReceipt ? amountPaid : currentInvoiceBalance)} F</span></div>
                      </div>
                    </div>
                  </div>
                )}
                {!isLastPage && <div className="mt-auto text-right text-xs italic font-bold text-slate-400 pt-4">Suite page suivante...</div>}
              </div>

              {/* WATERMARKS REPEATED */}
              {!isFinalized && <div className="absolute inset-0 flex items-center justify-center p-10 pointer-events-none opacity-20 overflow-hidden z-0"><p className="text-9xl font-black text-gray-400 -rotate-45 whitespace-nowrap select-none border-8 border-gray-400 p-10 rounded-[3rem]">BROUILLON</p></div>}

              {/* FOOTER (LAST PAGE) */}
              {isLastPage ? (
                <div className="p-8 mt-auto">
                  <div className="border-t border-slate-100 pt-6 flex justify-between items-end text-[10px] text-slate-400 font-medium uppercase">
                    <div className="w-1/3"><p className="mb-8">Signature Client</p><div className="w-24 h-6 border-b border-dashed border-slate-300"></div></div>
                    <div className="w-1/3 flex justify-center pb-2">{isFinalized && <div className="block opacity-60"><QRCode value={verifyUrl} size={42} /></div>}</div>
                    <div className="w-1/3 text-right"><p className="mb-8">Signature {data.business.name}</p>{data.business.signatureUrl ? <div className="w-24 h-12 ml-auto flex justify-end"><img src={data.business.signatureUrl} className="h-full object-contain" /></div> : <div className="w-24 h-6 border-b border-dashed border-slate-300 ml-auto"></div>}</div>
                  </div>
                </div>
              ) : <div className="h-20"></div>}
            </div>
          );
        })}
      </div>
    );
  }

  // --- ELEGANT TEMPLATE ---
  if (data.templateId === 'elegant') {
    return (
      <div id="invoice-preview-container" className="flex flex-col gap-8 bg-gray-50/50 print:bg-white print:gap-0">
        {pages.map((pageItems, index) => {
          const isLastPage = index === pages.length - 1;

          return (
            <div key={index} className="bg-white p-12 w-full max-w-[850px] mx-auto shadow-xl relative min-h-[29.6cm] flex flex-col font-serif text-gray-900 print:shadow-none print:m-0 print:border-0 print:break-after-page" style={{ fontFamily: 'Georgia, "Times New Roman", Times, serif', pageBreakAfter: isLastPage ? 'auto' : 'always' }}>
              {/* HEADER REPEATED */}
              <div className="text-center mb-8 pb-4 border-b border-gray-300 px-4">
                {data.business.customHeaderImage ? (
                  <div className="mb-2 flex justify-center"><img src={data.business.customHeaderImage} className="w-full object-contain max-h-40" /></div>
                ) : (
                  <>
                    <h1 className="text-2xl md:text-4xl uppercase tracking-widest mb-1 text-slate-800 break-words" style={{ letterSpacing: '0.1em' }}>{maskText(data.business.name)}</h1>
                    <p className="text-xs md:text-sm italic text-slate-500 font-medium mb-1">{maskText(data.business.specialty)}</p>
                    <p className="text-xs text-slate-600 font-serif uppercase tracking-wider mb-1">{maskText(data.business.address)}</p>
                  </>
                )}
              </div>

              {/* INFO REPEATED */}
              <div className="flex flex-col md:flex-row justify-between items-start mb-12 px-2 gap-6 relative">
                <div className="mt-2 w-full md:w-auto">
                  <p className="text-sm italic text-gray-600 mb-1 font-serif">Client :</p>
                  <p className="text-xl font-bold text-black uppercase tracking-wide break-words">{!isFinalized ? "CLIENT MASQUÉ" : (data.customerName || "CLIENT COMPTANT")}</p>
                </div>
                <div className="w-full md:w-auto text-left md:text-right flex flex-row-reverse md:flex-col justify-between items-center md:items-end border-t border-dashed md:border-none pt-4 md:pt-0 border-gray-200">
                  <h2 className="text-lg md:text-xl uppercase border-b-2 border-black inline-block mb-1 pb-0.5 tracking-wider font-normal">{data.type}</h2>
                  <p className="text-sm font-bold text-gray-800">N° {maskText(data.number)}</p>
                  <p className="text-xs italic text-gray-400">Page {index + 1} / {pages.length}</p>
                </div>
              </div>

              {/* WATERMARKS */}
              {!isFinalized && <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-10 z-0"><p className="text-[120px] font-bold text-gray-400 -rotate-45 whitespace-nowrap select-none border-[12px] border-gray-400 p-12 rounded-[3rem]">BROUILLON</p></div>}

              {/* TABLE (Chunked) - Added flex flex-col to push text down */}
              <div className="flex-grow z-10 flex flex-col">
                <table className="w-full mb-8">
                  <thead>
                    <tr className="border-b border-black text-xs font-bold uppercase tracking-wider text-gray-900">
                      <th className="py-3 text-center w-16">QTÉ</th><th className="py-3 text-left pl-4">DÉSIGNATION</th>
                      {!isPriceHidden && <><th className="py-3 text-right">P.U.</th><th className="py-3 text-right">MONTANT</th></>}
                    </tr>
                  </thead>
                  <tbody className="text-sm text-gray-800">
                    {pageItems.map((item) => (
                      <tr key={item.id} className="border-b border-gray-100 last:border-none">
                        <td className="py-4 text-center font-medium">{item.quantity}</td>
                        <td className="py-4 pl-4">{item.description}</td>
                        {!isPriceHidden && <><td className="py-4 text-right">{formatCurrency(item.unitPrice)}</td><td className="py-4 text-right font-bold">{formatCurrency(item.quantity * item.unitPrice)}</td></>}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!isLastPage && <div className="mt-auto text-right text-sm italic text-gray-400 pt-4">Suite page suivante...</div>}
              </div>

              {/* TOTALS (LAST PAGE) */}
              {!isPriceHidden && isLastPage && (
                <div className="flex justify-end mb-12 z-10">
                  <div className="min-w-[250px] bg-gray-50 p-6 rounded-sm">
                    <div className="flex justify-between mb-4 text-sm font-medium text-gray-600"><span>Total Brut</span><span>{formatCurrency(subtotal)}</span></div>
                    <div className="flex justify-between pt-2 border-t border-gray-300 text-xl font-bold text-black"><span>{isReceipt ? 'Net Payé' : 'Net à Payer'}</span><span>{formatCurrency(isReceipt ? amountPaid : currentInvoiceBalance)}</span></div>
                  </div>
                </div>
              )}

              {/* FOOTER (LAST PAGE) */}
              {isLastPage ? (
                <div className="mt-auto px-4 md:px-12 pb-8 pt-6">
                  <div className="flex justify-between items-end mb-8 text-xs font-serif italic text-gray-500">
                    <div className="w-1/3"><p className="mb-8">Pour accord,</p><div className="w-32 h-px bg-gray-300"></div></div>
                    <div className="w-1/3 flex justify-center pb-2">{isFinalized && <div className="opacity-70 mb-1"><QRCode value={verifyUrl} size={48} /></div>}</div>
                    <div className="w-1/3 text-right"><p className="mb-8">La Direction,</p>{data.business.signatureUrl ? <div className="w-32 h-16 ml-auto flex justify-end mb-[-10px]"><img src={data.business.signatureUrl} className="h-full object-contain" /></div> : <div className="w-32 h-px bg-gray-300 ml-auto"></div>}</div>
                  </div>
                </div>
              ) : <div className="h-20"></div>}

              <div className="border-t border-gray-100 pt-4 text-center text-[10px] text-gray-400 uppercase tracking-[0.2em] font-medium opacity-60">Généré par FactureMan • Page {index + 1} / {pages.length}</div>
            </div>
          );
        })}
      </div>
    );
  }

  return <div className="p-8 bg-white border">Template inconnu : {data.templateId}</div>;
};

export default InvoicePreview;
