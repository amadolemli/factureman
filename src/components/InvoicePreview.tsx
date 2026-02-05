
import React from 'react';
import QRCode from 'react-qr-code';
import { InvoiceData, DocumentType } from '../types';
import { formatCurrency, numberToWords } from '../utils/format';

interface Props {
  data: InvoiceData;
  remainingBalance?: number;
}

const InvoicePreview: React.FC<Props> = ({ data, remainingBalance }) => {
  const isReceipt = data.type === DocumentType.RECEIPT;
  const subtotal = data.items.reduce((acc, item) => acc + (item.quantity * item.unitPrice), 0);
  const amountPaid = data.amountPaid || 0;
  const currentInvoiceBalance = subtotal - amountPaid;
  const isPriceHidden = [DocumentType.QUOTE, DocumentType.DELIVERY_NOTE, DocumentType.PURCHASE_ORDER].includes(data.type);

  // Helper to determine if we should show the client balance section
  // Logic: Show ONLY if it is a RECEIPT.
  // CRITICAL: If finalized, ONLY use the snapshot. Do NOT use current remainingBalance prop as it changes over time.
  const isFinalized = data.isFinalized;
  const snapshot = data.clientBalanceSnapshot;

  const balanceToShow = isFinalized ? snapshot : (remainingBalance ?? snapshot);
  const showClientBalance = isReceipt && balanceToShow !== undefined;

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

  const c = getColorClass() as keyof typeof colors;

  // Masking Logic for Drafts
  const isDraft = !data.isFinalized;
  const maskText = (text: string) => isDraft ? "• • • • •" : text;
  const maskDate = (date: string) => isDraft ? "••/••/••••" : new Date(date).toLocaleDateString('fr-FR');

  // QR Code Data (Public Safe Data)
  // We use the ID to let the user fetch status from the server.
  const verifyUrl = `${window.location.protocol}//${window.location.host}/verify/${data.id}`;

  // --- TEMPLATE: CLASSIC ---
  if (data.templateId === 'classic') {
    return (
      <div id="invoice-preview-container" className="bg-white p-6 md:p-8 max-w-2xl mx-auto border-2 border-gray-800 shadow-xl relative min-h-[850px] flex flex-col print:shadow-none print:border-gray-800">



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

        <div className="flex flex-col md:flex-row justify-between items-start mb-6 text-sm font-bold gap-4">
          <div className="w-full md:w-auto">
            <span>Fait le {maskDate(data.date)} {data.createdAt && !isDraft && <span className="text-gray-500 font-normal">à {new Date(data.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>}</span>
            <div className="mt-2 space-y-1">
              <div>
                {isReceipt ? "REÇU DE :" : "CLIENT :"}
                <span className="underline decoration-dotted ml-2 uppercase font-black block md:inline mt-1 md:mt-0">{isDraft ? "CLIENT MASQUÉ" : (data.customerName || "....................................")}</span>
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
          </div>
        </div>

        {/* WATERMARK BROUILLON */}
        {isDraft && (
          <div className="absolute inset-0 flex items-center justify-center p-10 pointer-events-none opacity-20 overflow-hidden z-0">
            <p className="text-9xl font-black text-gray-400 -rotate-45 whitespace-nowrap select-none border-8 border-gray-400 p-10 rounded-[3rem]">
              BROUILLON
            </p>
          </div>
        )}

        {/* WATERMARK IMPAYÉ */}
        {!isDraft && data.type === DocumentType.INVOICE && amountPaid === 0 && (
          <div className="absolute inset-0 flex items-center justify-center p-10 pointer-events-none opacity-20 overflow-hidden z-0">
            <p className="text-9xl font-black text-red-500 -rotate-45 whitespace-nowrap select-none border-8 border-red-500 p-10 rounded-[3rem]">
              IMPAYÉ
            </p>
          </div>
        )}

        {/* WATERMARK PAYÉ (Fully Paid) */}
        {!isDraft && data.type === DocumentType.INVOICE && amountPaid >= subtotal && subtotal > 0 && (
          <div className="absolute inset-0 flex items-center justify-center p-10 pointer-events-none opacity-20 overflow-hidden z-0">
            <p className="text-9xl font-black text-green-600 -rotate-45 whitespace-nowrap select-none border-8 border-green-600 p-10 rounded-[3rem] animate-in zoom-in-50 duration-500">
              PAYÉ
            </p>
          </div>
        )}

        <div className="flex-grow">
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
              {data.items.map((item) => (
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
              {Array.from({ length: 6 - data.items.length }).map((_, i) => (
                <tr key={i} className="h-6 border-b border-gray-50 opacity-10">
                  <td className="border-r-2 border-gray-800"></td><td className={`${!isPriceHidden ? 'border-r-2' : ''} border-gray-800`}></td>
                  {!isPriceHidden && <><td className="border-r-2 border-gray-800"></td><td></td></>}
                </tr>
              ))}
            </tbody>
            {!isPriceHidden && (
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
          {!isPriceHidden && (
            <div className="mt-4 p-3 border border-gray-200 bg-gray-50 rounded-lg">
              <p className="text-[8px] uppercase font-black text-gray-400">Somme en toutes lettres :</p>
              <p className="italic text-xs font-black text-gray-800 uppercase leading-tight">{numberToWords(subtotal)}</p>
            </div>
          )}

          {showClientBalance && (
            <div className={`mt-4 p-4 border-2 rounded-xl flex justify-between items-center ${balanceToShow < 0 ? 'border-green-200 bg-green-50 shadow-inner' : 'border-red-200 bg-red-50'
              }`}>
              <div>
                <p className={`text-[10px] font-black uppercase tracking-widest ${balanceToShow < 0 ? 'text-green-400' : 'text-red-400'}`}>
                  SITUATION COMPTE CLIENT (APRES OPÉRATION)
                </p>
                <p className={`text-xs font-bold ${balanceToShow < 0 ? 'text-green-800' : 'text-red-800'}`}>
                  {balanceToShow < 0 ? 'Votre nouveau solde disponible (Avoir) :' : 'Votre Reliquat (Dette Restante) à ce jour :'}
                </p>
              </div>
              <p className={`text-xl font-black ${balanceToShow < 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(Math.abs(balanceToShow))} F
              </p>
            </div>
          )}
        </div>

        <div className="mt-8 flex justify-between items-end text-[10px] font-black uppercase">
          <div className="text-center">Signature du Client<div className="h-16"></div>...................</div>

          {/* QR Code Centered */}
          {!isDraft && (
            <div className="flex flex-col items-center opacity-80 mx-4">
              <div className="bg-white p-1 border border-gray-200">
                <QRCode value={verifyUrl} size={48} />
              </div>
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
        <div className="mt-8 pt-4 border-t border-gray-200 text-center text-[10px] text-gray-400 font-medium opacity-70">
          Généré par FactureMan — Gérez tout. Simplement
        </div>
      </div>
    );
  }

  // --- TEMPLATE: MODERN ---
  if (data.templateId === 'modern') {
    const colorKey = getColorClass() as 'blue' | 'green' | 'orange' | 'purple';

    // Palette de couleurs moderne et plus douce
    const theme = {
      blue: { main: 'bg-slate-900', accent: 'text-blue-500', bgAccent: 'bg-blue-500', light: 'bg-slate-50', border: 'border-slate-200' },
      green: { main: 'bg-slate-900', accent: 'text-emerald-500', bgAccent: 'bg-emerald-500', light: 'bg-slate-50', border: 'border-slate-200' },
      orange: { main: 'bg-slate-900', accent: 'text-orange-500', bgAccent: 'bg-orange-500', light: 'bg-slate-50', border: 'border-slate-200' },
      purple: { main: 'bg-slate-900', accent: 'text-purple-500', bgAccent: 'bg-purple-500', light: 'bg-slate-50', border: 'border-slate-200' },
    }[colorKey];

    // --- VARIANT: MODERN CHEQUE (REÇU UNIQUEMENT) ---
    if (isReceipt) {
      return (
        <div id="invoice-preview-container" className="bg-white max-w-2xl mx-auto shadow-2xl relative min-h-[850px] flex flex-col font-sans print:shadow-none text-slate-800">

          {/* Top Decorative Strip */}
          <div className={`h-2 w-full ${theme.bgAccent}`}></div>

          <div className="p-8 flex-grow flex flex-col relative overflow-hidden">
            {/* Background Watermark/Decoration */}
            <div className={`absolute top-0 right-0 w-64 h-64 rounded-full ${theme.bgAccent} opacity-5 blur-3xl -z-10 translate-x-1/3 -translate-y-1/3`}></div>
            <div className={`absolute bottom-0 left-0 w-80 h-80 rounded-full ${theme.bgAccent} opacity-5 blur-3xl -z-10 -translate-x-1/3 translate-y-1/3`}></div>

            {/* Header: Logo & Receipt Info */}
            <div className="flex flex-col md:flex-row justify-between items-start mb-12 border-b-2 border-slate-100 pb-8 gap-6">
              <div className="flex items-center gap-4 w-full md:w-auto">
                {data.business.logo ? (
                  <img src={data.business.logo} className="h-16 object-contain" />
                ) : (
                  <div className={`h-12 w-12 rounded-lg ${theme.bgAccent} flex items-center justify-center text-white font-bold text-xl shrink-0`}>{data.business.name.substring(0, 2)}</div>
                )}
                <div>
                  <h1 className="text-xl font-bold uppercase tracking-tight text-slate-900 leading-tight">{maskText(data.business.name)}</h1>
                  <div className="text-[10px] text-slate-500 font-medium space-y-0.5 mt-1">
                    <p>{maskText(data.business.address)}</p>
                    <p>{maskText(data.business.phone)}</p>
                    {data.business.nif && <span className="mr-2">NIF: {data.business.nif}</span>}
                    {data.business.rccm && <span>RCCM: {data.business.rccm}</span>}
                  </div>
                </div>
              </div>

              <div className="w-full md:w-auto text-left md:text-right flex flex-row-reverse md:flex-col justify-between items-center md:items-end">
                <div className={`inline-block px-4 md:px-6 py-2 rounded-lg ${theme.bgAccent} mb-0 md:mb-4 shadow-lg shadow-${colorKey}-500/30 md:transform md:scale-110 md:origin-right`}>
                  <h2 className="text-sm md:text-2xl font-black text-white uppercase tracking-widest leading-none text-center md:text-right">REÇU DE<br />VERSEMENT</h2>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">N° {maskText(data.number)}</p>
                  <p className="text-xs font-medium text-slate-400">
                    {maskDate(data.date)} {data.createdAt && !isDraft && <span>- {new Date(data.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>}
                  </p>
                </div>
              </div>
            </div>

            {/* Check Body */}
            <div className="flex-grow space-y-8 px-4">

              {/* Received From */}
              <div className="flex flex-col md:flex-row md:items-end gap-2 md:gap-4">
                <span className="text-xs md:text-sm font-bold uppercase text-slate-400 tracking-widest whitespace-nowrap w-32">Reçu de</span>
                <div className="flex-grow border-b-2 border-slate-200 pb-1 px-4 text-lg md:text-xl font-bold text-slate-900 relative">
                  {isDraft ? "CLIENT MASQUÉ" : (data.customerName || "................................................")}
                  <span className="absolute right-0 bottom-1 text-[8px] md:text-[10px] text-slate-300 font-normal">CLIENT</span>
                </div>
              </div>

              {/* Amount in words */}
              <div className="flex items-end gap-4">
                <span className="text-sm font-bold uppercase text-slate-400 tracking-widest whitespace-nowrap w-32">La somme de</span>
                <div className="flex-grow border-b-2 border-slate-200 pb-1 px-4 text-lg font-medium italic text-slate-700 bg-slate-50/50 rounded-t-lg">
                  {numberToWords(amountPaid)} Francs CFA
                </div>
              </div>

              {/* For / Reason */}
              <div className="flex items-start gap-4">
                <span className="text-sm font-bold uppercase text-slate-400 tracking-widest whitespace-nowrap w-32 mt-2">Pour</span>
                <div className="flex-grow rounded-xl bg-slate-50 border border-slate-100 p-4 text-sm font-medium text-slate-600 min-h-[100px]">
                  <ul className="space-y-1">
                    {data.items.map(item => (
                      <li key={item.id} className="flex justify-between">
                        <span>• {item.description}</span>
                        {/* <span>{formatCurrency(item.unitPrice * item.quantity)}</span> */}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Amount Box */}
              <div className="flex justify-end mt-4">
                <div className={`${theme.main} text-white p-6 rounded-2xl shadow-xl flex items-center gap-6 min-w-[300px]`}>
                  <span className="text-xs font-bold uppercase tracking-widest opacity-60">Montant<br />Versé</span>
                  <span className="text-3xl font-black tracking-tighter">{formatCurrency(amountPaid)} <span className="text-lg opacity-50 font-normal">F CFA</span></span>
                </div>
              </div>

            </div>

            {/* Signatures */}
            <div className="mt-16 grid grid-cols-2 gap-12 text-[10px] uppercase font-bold text-slate-400 tracking-widest">
              <div className="text-center border-t border-slate-100 pt-4">
                Signature Client
              </div>
              <div className="text-center border-t border-slate-100 pt-4">
                Signature {data.business.name}
                {data.business.signatureUrl ? (
                  <div className="mt-2 flex justify-center"><img src={data.business.signatureUrl} alt="Signature" className="h-12 object-contain" /></div>
                ) : (
                  <div className="mt-2 text-slate-300 text-[8px] font-normal italic lowercase">Non signé</div>
                )}
              </div>
            </div>

          </div>

          {/* WATERMARK BROUILLON */}
          {isDraft && (
            <div className="absolute inset-0 flex items-center justify-center p-10 pointer-events-none opacity-20 overflow-hidden z-0">
              <p className="text-9xl font-black text-gray-400 -rotate-45 whitespace-nowrap select-none border-8 border-gray-400 p-10 rounded-[3rem]">
                BROUILLON
              </p>
            </div>
          )}

          {/* Client Situation Footer */}
          {showClientBalance && (
            <div className={`bg-slate-50 p-6 border-t ${theme.border}`}>
              <div className={`p-4 rounded-xl border ${balanceToShow < 0 ? 'bg-emerald-white border-emerald-200' : 'bg-red-50 border-red-200'} flex justify-between items-center relative overflow-hidden`}>
                <div className={`absolute left-0 top-0 bottom-0 w-2 ${balanceToShow < 0 ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                <div className="pl-4">
                  <p className={`text-[10px] font-black uppercase tracking-widest ${balanceToShow < 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    Situation du compte
                  </p>
                  <p className={`text-xs font-bold ${balanceToShow < 0 ? 'text-emerald-800' : 'text-red-800'}`}>
                    {balanceToShow < 0 ? 'Nouveau Solde Disponible (Avoir)' : 'Reste à devoir (Dette)'}
                  </p>
                </div>
                <p className={`text-xl font-black ${balanceToShow < 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {formatCurrency(Math.abs(balanceToShow))} F
                </p>
              </div>
            </div>
          )}

          <div className="mt-4 text-center text-[10px] text-slate-300 font-medium opacity-70 pb-4">
            Généré par FactureMan — Gérez tout. Simplement
          </div>
        </div>
      );
    }

    return (
      <div id="invoice-preview-container" className="bg-white max-w-2xl mx-auto shadow-2xl relative min-h-[850px] flex flex-col font-sans print:shadow-none text-slate-800">

        {/* En-tête Moderne Sombre */}
        <div className={`${theme.main} text-white p-8 rounded-b-3xl relative overflow-hidden`}>
          {/* Cercle décoratif */}
          <div className={`absolute -right-10 -top-10 w-40 h-40 rounded-full ${theme.bgAccent} opacity-20 blur-2xl`}></div>
          <div className={`absolute left-10 bottom-0 w-20 h-20 rounded-full ${theme.bgAccent} opacity-10 blur-xl`}></div>

          <div className="flex justify-between items-start relative z-10">
            <div className="flex-1">
              {data.business.customHeaderImage ? (
                <img src={data.business.customHeaderImage} className="max-h-24 rounded-lg object-contain bg-white/10 p-2 backdrop-blur-sm" />
              ) : (
                <div>
                  {data.business.logo && <img src={data.business.logo} className="h-12 mb-3 object-contain brightness-0 invert opacity-90" />}
                  <h1 className="text-2xl font-bold tracking-tight uppercase text-white">{maskText(data.business.name)}</h1>
                  <p className={`text-xs font-bold uppercase tracking-widest mt-1 ${theme.accent}`}>{maskText(data.business.specialty)}</p>

                  <div className="mt-4 text-[10px] text-slate-300 font-medium leading-relaxed opacity-80">
                    <p>{maskText(data.business.address)}</p>
                    <p>{maskText(data.business.phone)}</p>
                    {(data.business.nif || data.business.rccm) && (
                      <div className="flex flex-col mt-1">
                        {data.business.nif && <span>NIF: {data.business.nif}</span>}
                        {data.business.rccm && <span>RCCM: {data.business.rccm}</span>}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="text-right">
              <div className={`inline-block px-4 py-1.5 rounded-full ${theme.bgAccent} text-white mb-2 shadow-lg shadow-${colorKey}-900/50`}>
                <h2 className="text-lg font-bold uppercase tracking-wide">{data.type}</h2>
              </div>
              <div className="text-slate-300 space-y-1 mt-2">
                <p className="text-sm font-light">N° <span className="font-bold text-white">{maskText(data.number)}</span></p>
                <p className="text-xs font-light opacity-80">
                  {maskDate(data.date)} {data.createdAt && !isDraft && <span>• {new Date(data.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>}
                </p>
              </div>
            </div>
          </div>
        </div>



        {/* Section Client 'Carte' */}
        <div className="px-8 mt-8">
          <div className={`${theme.light} rounded-2xl p-6 border ${theme.border} border-l-4 border-l-${colorKey}-500 relative`}>
            <div className={`absolute top-0 bottom-0 left-0 w-1 ${theme.bgAccent} rounded-l-2xl`}></div>
            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-2">Facturé à</p>
            <h3 className="text-xl font-bold text-slate-900">{isDraft ? "CLIENT MASQUÉ" : (data.customerName || "Client Comptant")}</h3>
            {data.customerPhone && (
              <p className="text-sm font-medium text-slate-600 mt-1 flex items-center gap-2">
                <span className="opacity-50">Tél:</span> {maskText(data.customerPhone)}
              </p>
            )}
          </div>
        </div>

        {/* Tableau épuré */}
        <div className="px-8 mt-10 flex-grow">
          <table className="w-full">
            <thead>
              <tr className="text-[10px] uppercase font-bold text-slate-400 border-b border-slate-100">
                <th className="pb-3 text-left w-16 pl-2">Qté</th>
                <th className="pb-3 text-left">Description</th>
                {!isPriceHidden && (
                  <>
                    <th className="pb-3 text-right">Prix Unitaire</th>
                    <th className="pb-3 text-right pr-2">Total</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="text-sm">
              {data.items.map((item, index) => (
                <tr key={item.id} className={`group hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0`}>
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

          {!isPriceHidden && (
            <div className="mt-8 flex justify-end">
              <div className="w-64">
                <div className="flex justify-between py-2 text-sm text-slate-500 border-t border-slate-100">
                  <span>Sous-total</span>
                  <span className="font-semibold text-slate-900">{formatCurrency(subtotal)} F</span>
                </div>

                {amountPaid > 0 && !isReceipt && (
                  <div className="flex justify-between py-2 text-sm text-emerald-600 bg-emerald-50/50 px-2 rounded-lg mb-2">
                    <span className="font-bold">Montant payé</span>
                    <span className="font-bold">{formatCurrency(amountPaid)} F</span>
                  </div>
                )}

                <div className={`${theme.main} text-white p-4 rounded-xl shadow-lg mt-2`}>
                  <div className="flex justify-between items-center">
                    <span className="text-xs uppercase font-bold opacity-80">Total {isReceipt ? 'Versé' : 'Net à Payer'}</span>
                    <span className="text-xl font-bold">{formatCurrency(isReceipt ? amountPaid : currentInvoiceBalance)} F</span>
                  </div>
                </div>

                <p className="text-[9px] text-slate-400 text-right mt-2 italic px-1">
                  Arrêté la présente facture à la somme de : <br />
                  <span className="font-bold not-italic text-slate-600">{numberToWords(isReceipt ? amountPaid : subtotal)} Francs CFA</span>
                </p>
              </div>
            </div>
          )}

          {/* WATERMARK BROUILLON */}
          {isDraft && (
            <div className="absolute inset-0 flex items-center justify-center p-10 pointer-events-none opacity-20 overflow-hidden z-0">
              <p className="text-9xl font-black text-gray-400 -rotate-45 whitespace-nowrap select-none border-8 border-gray-400 p-10 rounded-[3rem]">
                BROUILLON
              </p>
            </div>
          )}

          {/* WATERMARK IMPAYÉ */}
          {!isDraft && data.type === DocumentType.INVOICE && amountPaid === 0 && (
            <div className="absolute inset-0 flex items-center justify-center p-10 pointer-events-none opacity-20 overflow-hidden z-0">
              <p className="text-9xl font-black text-red-500 -rotate-45 whitespace-nowrap select-none border-8 border-red-500 p-10 rounded-[3rem]">
                IMPAYÉ
              </p>
            </div>
          )}

          {/* WATERMARK PAYÉ (Fully Paid) */}
          {!isDraft && data.type === DocumentType.INVOICE && amountPaid >= subtotal && subtotal > 0 && (
            <div className="absolute inset-0 flex items-center justify-center p-10 pointer-events-none opacity-20 overflow-hidden z-0">
              <p className="text-9xl font-black text-green-600 -rotate-45 whitespace-nowrap select-none border-8 border-green-600 p-10 rounded-[3rem] animate-in zoom-in-50 duration-500">
                PAYÉ
              </p>
            </div>
          )}


          {showClientBalance && (
            <div className={`mt-8 p-4 rounded-xl border ${balanceToShow < 0 ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-red-50 border-red-100 text-red-800'} flex justify-between items-center`}>
              <span className="text-xs font-bold uppercase">Solde après opération</span>
              <span className="text-lg font-bold">{formatCurrency(Math.abs(balanceToShow))} F</span>
            </div>
          )}
        </div>

        {/* Pied de page */}
        <div className="p-8 mt-auto">
          <div className="border-t border-slate-100 pt-6 flex justify-between items-end text-[10px] text-slate-400 font-medium uppercase">
            <div>
              <p className="mb-8">Signature Client</p>
              <div className="w-24 h-6 border-b border-dashed border-slate-300"></div>
            </div>
            <div className="text-right flex items-end gap-4">
              {/* QR Code for Modern in footer */}
              {!isDraft && (
                <div className="hidden md:block opacity-60">
                  <QRCode value={verifyUrl} size={42} />
                </div>
              )}
              <div>
                <p className="mb-8">Signature {data.business.name}</p>
                {data.business.signatureUrl ? (
                  <div className="w-24 h-12 ml-auto flex justify-end"><img src={data.business.signatureUrl} alt="Signature" className="h-full object-contain" /></div>
                ) : (
                  <div className="w-24 h-6 border-b border-dashed border-slate-300 ml-auto"></div>
                )}
              </div>
            </div>
          </div>
          <div className={`text-center mt-6 text-[9px] font-bold ${theme.accent} opacity-80`}>
            Merci de votre confiance
          </div>
        </div>

        <div className="w-full text-center text-[10px] text-slate-300 font-medium opacity-70 pb-2">
          Généré par FactureMan — Gérez tout. Simplement
        </div>
      </div >
    );
  }

  // --- TEMPLATE: ELEGANT ---
  if (data.templateId === 'elegant') {
    return (
      <div id="invoice-preview-container" className="bg-white p-12 max-w-2xl mx-auto shadow-xl relative min-h-[850px] flex flex-col font-serif text-gray-900 print:shadow-none print:m-0" style={{ fontFamily: 'Georgia, "Times New Roman", Times, serif' }}>

        {/* HEADER */}
        <div className="text-center mb-8 pb-4 border-b border-gray-300 px-4">
          {data.business.customHeaderImage ? (
            <div className="mb-2 flex justify-center">
              <img src={data.business.customHeaderImage} alt="En-tête" className="w-full object-contain max-h-40" />
            </div>
          ) : (
            <>
              {data.business.logo && (
                <div className="mb-4 flex justify-center">
                  <img src={data.business.logo} alt="Logo" className="h-20 object-contain" />
                </div>
              )}
              <h1 className="text-2xl md:text-4xl uppercase tracking-widest mb-1 text-slate-800 break-words" style={{ letterSpacing: '0.1em' }}>
                {maskText(data.business.name)}
              </h1>
              <p className="text-xs md:text-sm italic text-slate-500 font-medium mb-1">
                {maskText(data.business.specialty)}
              </p>
              <p className="text-xs text-slate-600 font-serif uppercase tracking-wider mb-1">
                {maskText(data.business.address)}
              </p>
              <p className="text-sm font-bold text-slate-800">
                Tél: {maskText(data.business.phone)}
              </p>
              {(data.business.nif || data.business.rccm) && (
                <p className="text-[10px] text-gray-400 mt-1">
                  {data.business.nif && <span>NIF: {data.business.nif}  </span>}
                  {data.business.rccm && <span>RCCM: {data.business.rccm}</span>}
                </p>
              )}
            </>
          )}
        </div>

        {/* CLIENT & DOCUMENT INFO */}
        <div className="flex flex-col md:flex-row justify-between items-start mb-12 px-2 gap-6 relative">
          <div className="mt-2 w-full md:w-auto">
            <p className="text-sm italic text-gray-600 mb-1 font-serif">Client :</p>
            <p className="text-xl font-bold text-black uppercase tracking-wide break-words">
              {isDraft ? "CLIENT MASQUÉ" : (data.customerName || "CLIENT COMPTANT")}
            </p>
            {data.customerPhone && (
              <p className="text-sm text-gray-600 mt-1">{maskText(data.customerPhone)}</p>
            )}
          </div>

          <div className="w-full md:w-auto text-left md:text-right flex flex-row-reverse md:flex-col justify-between items-center md:items-end border-t border-dashed md:border-none pt-4 md:pt-0 border-gray-200">
            <h2 className="text-lg md:text-xl uppercase border-b-2 border-black inline-block mb-1 pb-0.5 tracking-wider font-normal">
              {data.type}
            </h2>
            <div className="flex flex-col items-start md:items-end gap-0.5 mt-1">
              <p className="text-sm font-bold text-gray-800">N° {maskText(data.number)}</p>
              <p className="text-sm text-gray-600">
                {maskDate(data.date)} {data.createdAt && !isDraft && <span className="text-xs italic">({new Date(data.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })})</span>}
              </p>
            </div>
          </div>
        </div>

        {/* WATERMARK BROUILLON */}
        {isDraft && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-10 z-0">
            <p className="text-[120px] font-bold text-gray-400 -rotate-45 whitespace-nowrap select-none border-[12px] border-gray-400 p-12 rounded-[3rem]">
              BROUILLON
            </p>
          </div>
        )}

        {/* WATERMARK IMPAYÉ */}
        {!isDraft && data.type === DocumentType.INVOICE && amountPaid === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-10 z-0">
            <p className="text-[120px] font-bold text-red-500 -rotate-45 whitespace-nowrap select-none border-[12px] border-red-500 p-12 rounded-[3rem]">
              IMPAYÉ
            </p>
          </div>
        )}

        {/* WATERMARK PAYÉ (Fully Paid) */}
        {!isDraft && data.type === DocumentType.INVOICE && amountPaid >= subtotal && subtotal > 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-15 z-0">
            <p className="text-[120px] font-bold text-green-600 -rotate-45 whitespace-nowrap select-none border-[12px] border-green-600 p-12 rounded-[3rem]">
              PAYÉ
            </p>
          </div>
        )}

        {/* TABLE */}
        <div className="flex-grow z-10">
          <table className="w-full mb-8">
            <thead>
              <tr className="border-b border-black text-xs font-bold uppercase tracking-wider text-gray-900">
                <th className="py-3 text-center w-16">QTÉ</th>
                <th className="py-3 text-left pl-4">DÉSIGNATION</th>
                {!isPriceHidden && (
                  <>
                    <th className="py-3 text-right">P.U.</th>
                    <th className="py-3 text-right">MONTANT</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="text-sm text-gray-800">
              {data.items.map((item) => (
                <tr key={item.id} className="border-b border-gray-100 last:border-none">
                  <td className="py-4 text-center font-medium">{item.quantity}</td>
                  <td className="py-4 pl-4">{item.description}</td>
                  {!isPriceHidden && (
                    <>
                      <td className="py-4 text-right">{formatCurrency(item.unitPrice)}</td>
                      <td className="py-4 text-right font-bold">{formatCurrency(item.quantity * item.unitPrice)}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* TOTALS */}
        {!isPriceHidden && (
          <div className="flex justify-end mb-12 z-10">
            <div className="min-w-[250px] bg-gray-50 p-6 rounded-sm">
              <div className="flex justify-between mb-4 text-sm font-medium text-gray-600">
                <span>Total Brut</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>

              {amountPaid > 0 && !isReceipt && (
                <div className="flex justify-between mb-2 text-sm text-emerald-700 italic border-b border-emerald-100 pb-2">
                  <span>Déjà Payé</span>
                  <span>- {formatCurrency(amountPaid)}</span>
                </div>
              )}

              <div className="flex justify-between pt-2 border-t border-gray-300 text-xl font-bold text-black">
                <span>{isReceipt ? 'Net Payé' : 'Net à Payer'}</span>
                <span>{formatCurrency(isReceipt ? amountPaid : currentInvoiceBalance)}</span>
              </div>
            </div>
          </div>
        )}

        {/* CLIENT SITUATION (Hidden on Invoice unless requested) */}
        {showClientBalance && (
          <div className={`mt-2 mb-8 p-4 border text-center text-sm ${balanceToShow < 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
            <span className="font-bold uppercase tracking-widest block text-xs opacity-70 mb-1">Situation Client</span>
            {balanceToShow < 0 ? 'Votre Solde Créditeur (Avoir) : ' : 'Reste à payer (Dette Totale) : '}
            <span className="font-bold text-lg">{formatCurrency(Math.abs(balanceToShow))} F</span>
          </div>
        )}

        {/* FOOTER & SIGNATURES ELEGANT */}
        <div className="mt-auto px-4 md:px-12 pb-8 pt-6">
          <div className="flex justify-between items-end mb-8 text-xs font-serif italic text-gray-500">
            <div>
              <p className="mb-8">Pour accord,</p>
              <div className="w-32 h-px bg-gray-300"></div>
            </div>

            <div className="text-right flex items-end gap-6">
              {/* QR Code Elegant Footer */}
              {!isDraft && (
                <div className="opacity-70 mb-1">
                  <QRCode value={verifyUrl} size={48} />
                </div>
              )}
              <div>
                <p className="mb-8">La Direction,</p>
                {data.business.signatureUrl ? (
                  <div className="w-32 h-16 ml-auto flex justify-end mb-[-10px]"><img src={data.business.signatureUrl} alt="Signature" className="h-full object-contain" /></div>
                ) : (
                  <div className="w-32 h-px bg-gray-300 ml-auto"></div>
                )}
              </div>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-4 text-center">
            <div className="text-[10px] text-gray-400 uppercase tracking-[0.2em] font-medium opacity-60">
              Généré par FactureMan
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <div className="p-8 bg-white border">Template inconnu : {data.templateId}</div>;
};

export default InvoicePreview;
