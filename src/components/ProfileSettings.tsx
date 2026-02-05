import React, { useRef, useState, useMemo } from 'react';
import ReactCrop, { Crop, PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop';
import SignatureCanvas from 'react-signature-canvas';
import 'react-image-crop/dist/ReactCrop.css';
import { BusinessInfo, InvoiceData, CreditRecord } from '../types';
import { Settings, Image as ImageIcon, Palette, Store, MapPin, Phone, Briefcase, User, Search, MessageCircle, Contact2, Shield, Download, Upload, FileText, X, Info, Activity, Edit2, Save, UserPlus, Check, Share2, PenTool, Eraser } from 'lucide-react';
import { testGeminiConnection } from '../services/geminiService';
import { testMistralConnection } from '../services/mistralService';
import AdminPanel from './AdminPanel';
import { UserProfile } from '../types';

interface Props {
  business: BusinessInfo;
  templateId: 'classic' | 'modern' | 'elegant';
  history: InvoiceData[];
  credits: CreditRecord[];
  onUpdateBusiness: (info: BusinessInfo) => void;
  onUpdateTemplate: (templateId: 'classic' | 'modern' | 'elegant') => void;
  onPreviewDoc?: (doc: InvoiceData) => void;
  onUpdateClient: (oldName: string, newName: string, newPhone: string) => void;
  onAddClient: (name: string, phone: string) => void;
  creditsCount?: number;
  userProfile: UserProfile | null;
  onLogout: () => void;
  onSync: () => void;
}

const ProfileSettings: React.FC<Props> = ({ business, templateId, history, credits, onUpdateBusiness, onUpdateTemplate, onPreviewDoc, onUpdateClient, onAddClient, creditsCount, userProfile, onLogout, onSync }) => {
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<{ name: string; phone: string } | null>(null);

  // Client Edit/Add State
  const [clientToEdit, setClientToEdit] = useState<{ name: string; phone: string } | null>(null);
  const [isAddingClient, setIsAddingClient] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');

  // Signature State
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const sigCanvasRef = useRef<SignatureCanvas | null>(null);

  const saveSignature = () => {
    if (sigCanvasRef.current) {
      if (sigCanvasRef.current.isEmpty()) {
        alert("Veuillez signer avant de sauvegarder.");
        return;
      }
      // Save as PNG data URL
      const signatureDataUrl = sigCanvasRef.current.getTrimmedCanvas().toDataURL('image/png');
      onUpdateBusiness({ ...business, signatureUrl: signatureDataUrl });
      setShowSignatureModal(false);
    }
  };

  const clearSignature = () => {
    sigCanvasRef.current?.clear();
  };


  // Cropping State
  const [upImg, setUpImg] = useState<string | ArrayBuffer | null>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  const onSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const reader = new FileReader();
      reader.addEventListener('load', () => setUpImg(reader.result));
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    const crop = centerCrop(
      makeAspectCrop(
        {
          unit: '%',
          width: 90,
        },
        16 / 5, // Default aspect ratio for header
        width,
        height
      ),
      width,
      height
    );
    setCrop(crop);
    imgRef.current = e.currentTarget;
  };

  const generateCroppedImage = () => {
    if (!completedCrop || !previewCanvasRef.current || !imgRef.current) return;

    const image = imgRef.current;
    const canvas = previewCanvasRef.current;
    const crop = completedCrop;

    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size to the exact size of the cropped area in the original image
    // This avoids using window.devicePixelRatio which can create huge canvases on mobile that crash
    canvas.width = crop.width * scaleX;
    canvas.height = crop.height * scaleY;

    // Draw the cropped area
    ctx.drawImage(
      image,
      crop.x * scaleX,
      crop.y * scaleY,
      crop.width * scaleX,
      crop.height * scaleY,
      0,
      0,
      canvas.width,
      canvas.height
    );

    // Convert to base64 and save
    // Use lower quality (0.8) to save space if needed, but 1.0 is fine for headers usually
    // If string is too long for localStorage, we might need to compress.
    const base64Image = canvas.toDataURL('image/jpeg', 0.8);

    // Check if valid
    if (base64Image && base64Image.length > 100) {
      onUpdateBusiness({ ...business, customHeaderImage: base64Image });
      setUpImg(null); // Close modal
    } else {
      alert("Erreur lors du traitement de l'image. Veuillez réessayer.");
    }
  };

  const templates = [
    { id: 'classic', name: 'Classique', desc: 'Sérieux & Encadré' },
    { id: 'modern', name: 'Moderne', desc: 'Propre & Épuré' },
    { id: 'elegant', name: 'Élégant', desc: 'Barre Latérale' },
  ] as const;



  // Extraire les clients uniques et leur dernier numéro de téléphone connu depuis l'historique ET les crédits
  const clients = useMemo(() => {
    const clientMap = new Map<string, string>();

    // 1. Depuis l'historique (Factures)
    history.slice().reverse().forEach(inv => {
      const name = inv.customerName.trim().toUpperCase();
      if (name && name !== "CLIENT COMPTANT") {
        if (inv.customerPhone) {
          clientMap.set(name, inv.customerPhone);
        } else if (!clientMap.has(name)) {
          clientMap.set(name, "");
        }
      }
    });

    // 2. Depuis la base de crédits (Portefeuille) - SOURCE DE VÉRITÉ PRIORITAIRE SI TÉLÉPHONE PRÉSENT
    if (credits) {
      credits.forEach(c => {
        const name = c.customerName.trim().toUpperCase();
        if (name && name !== "CLIENT COMPTANT") {
          // Si le client du portefeuille a un numéro, on l'utilise (même si l'historique n'en a pas ou en a un vieux)
          if (c.customerPhone) {
            clientMap.set(name, c.customerPhone);
          } else if (!clientMap.has(name)) {
            clientMap.set(name, "");
          }
        }
      });
    }

    return Array.from(clientMap.entries())
      .map(([name, phone]) => ({ name, phone }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [history, credits]);

  const filteredClients = clients.filter(c =>
    c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
    c.phone.includes(clientSearch)
  );

  return (
    <div className="space-y-6 pb-24 animate-in fade-in duration-500">

      {/* ADMIN SECTION */}
      {(userProfile?.is_admin || userProfile?.is_super_admin) && (
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-4 rounded-2xl shadow-lg border border-purple-400 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-lg">
                <Shield size={24} />
              </div>
              <div>
                <h2 className="text-lg font-black uppercase">Administration</h2>
                <p className="text-[10px] font-bold opacity-80 uppercase tracking-widest">Gestion des utilisateurs</p>
              </div>
            </div>
            <button
              onClick={() => setShowAdminPanel(true)}
              className="px-4 py-2 bg-white text-purple-700 rounded-xl font-bold text-xs uppercase hover:bg-purple-100 transition-colors shadow-md"
            >
              Ouvrir Panel
            </button>
          </div>
        </div>
      )}

      {showAdminPanel && userProfile && (
        <AdminPanel currentUser={userProfile} onClose={() => setShowAdminPanel(false)} />
      )}

      {/* SECTION BOUTIQUE */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200">
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-blue-900 p-2 rounded-lg text-white">
            <Settings size={20} />
          </div>
          <div className="flex-grow">
            <h2 className="text-xl font-black text-gray-900">Mon Business</h2>
            <div className="flex justify-between items-center">
              <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Identité de l'entreprise</p>
              {creditsCount !== undefined && (
                <span className={`text-[10px] px-2 py-1 rounded-full font-black border ${creditsCount > 200 ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                  Solde : {creditsCount} Crédits
                </span>
              )}
            </div>
          </div>
        </div>



        {/* Custom Header Image Section with Cropping */}
        <div className="mb-8">
          <label className="text-[10px] font-black text-gray-400 uppercase mb-3 block tracking-widest">En-tête Personnalisé (Scan/Photo)</label>
          <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200">
            <div className="flex flex-col items-center gap-4">
              {business.customHeaderImage ? (
                <div className="w-full relative group">
                  <img src={business.customHeaderImage} alt="En-tête" className="w-full h-32 object-cover object-top rounded-xl border border-gray-300" />
                  <button
                    onClick={() => onUpdateBusiness({ ...business, customHeaderImage: undefined })}
                    className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity text-xs font-bold"
                  >
                    Supprimer
                  </button>
                </div>
              ) : (
                <div className="text-center py-6">
                  <p className="text-xs text-gray-500 font-bold mb-2">Vous avez déjà des factures imprimées ?</p>
                  <p className="text-[10px] text-gray-400 max-w-xs mx-auto mb-4">Prenez une photo du haut de votre carnet et sélectionnez juste la zone de l'entête.</p>
                </div>
              )}

              <label className="cursor-pointer bg-blue-900 text-white px-4 py-2 rounded-xl font-bold text-xs uppercase hover:bg-blue-800 transition-colors flex items-center gap-2">
                <ImageIcon size={16} />
                {business.customHeaderImage ? "Changer la photo" : "Ajouter une photo d'entête"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={onSelectFile}
                />
              </label>
            </div>
          </div>
        </div>

        {/* Cropping Modal */}
        {!!upImg && (
          <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-4 w-full max-w-lg max-h-[90vh] overflow-y-auto flex flex-col">
              <h3 className="text-lg font-black text-blue-900 mb-4 uppercase">Recadrer l'entête</h3>
              <div className="flex-grow overflow-auto bg-gray-900 rounded-xl mb-4 border border-gray-200 flex justify-center items-center relative" style={{ touchAction: 'none' }}>
                <ReactCrop
                  crop={crop}
                  onChange={(c) => setCrop(c)}
                  onComplete={(c) => setCompletedCrop(c)}
                  aspect={undefined} // Free aspect ratio for header
                  className="max-h-[60vh] max-w-full"
                >
                  <img
                    src={upImg as string}
                    onLoad={onImageLoad}
                    style={{ maxHeight: '60vh', maxWidth: '100%', objectFit: 'contain' }}
                    alt="Crop area"
                  />
                </ReactCrop>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setUpImg(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-gray-500 bg-gray-100 hover:bg-gray-200"
                >
                  Annuler
                </button>
                <button
                  onClick={generateCroppedImage}
                  className="px-6 py-2 rounded-xl text-xs font-black text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/30"
                >
                  Valider le recadrage
                </button>
              </div>
            </div>
            {/* Hidden canvas for processing */}
            <canvas ref={previewCanvasRef} style={{ display: 'none' }} />
          </div>
        )}

        {/* Business Info Form */}
        <div className="space-y-4 mb-8">
          <label className="text-[10px] font-black text-gray-400 uppercase block tracking-widest">Coordonnées Business</label>

          <div className="relative">
            <Store size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400" />
            <input
              type="text"
              placeholder="Nom de la boutique"
              className="w-full pl-10 pr-4 py-3 bg-gray-50 border rounded-xl font-bold focus:ring-2 focus:ring-blue-500 outline-none"
              value={business.name}
              onChange={(e) => onUpdateBusiness({ ...business, name: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <Briefcase size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400" />
              <input
                type="text"
                placeholder="Spécialité (ex: Quincaillerie)"
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium"
                value={business.specialty}
                onChange={(e) => onUpdateBusiness({ ...business, specialty: e.target.value })}
              />
            </div>
            <div className="relative">
              <Phone size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400" />
              <input
                type="text"
                placeholder="Téléphone"
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-black"
                value={business.phone}
                onChange={(e) => onUpdateBusiness({ ...business, phone: e.target.value })}
              />
            </div>
          </div>

          <div className="relative">
            <MapPin size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400" />
            <input
              type="text"
              placeholder="Adresse complète"
              className="w-full pl-10 pr-4 py-3 bg-gray-50 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium"
              value={business.address}
              onChange={(e) => onUpdateBusiness({ ...business, address: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <FileText size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400" />
              <input
                type="text"
                placeholder="NIF"
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium"
                value={business.nif || ''}
                onChange={(e) => onUpdateBusiness({ ...business, nif: e.target.value })}
              />
            </div>
            <div className="relative">
              <Shield size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400" />
              <input
                type="text"
                placeholder="RCCM"
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-black"
                value={business.rccm || ''}
                onChange={(e) => onUpdateBusiness({ ...business, rccm: e.target.value })}
              />
            </div>
          </div>


        </div>

        {/* SIGNATURE DIGITALE SECTION */}
        <div className="mb-8 p-4 bg-gray-50 rounded-2xl border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-black text-gray-800 uppercase flex items-center gap-2">
              <PenTool size={16} className="text-blue-600" /> Signature Digitale
            </h3>
            {business.signatureUrl && (
              <button
                onClick={() => {
                  if (confirm("Supprimer votre signature ?")) {
                    onUpdateBusiness({ ...business, signatureUrl: undefined });
                  }
                }}
                className="text-xs font-bold text-red-500 hover:text-red-700"
              >
                Supprimer
              </button>
            )}
          </div>

          <div className="flex flex-col items-center gap-4">
            {business.signatureUrl ? (
              <div className="relative group w-full max-w-xs p-4 border-2 border-dashed border-gray-300 rounded-xl bg-white">
                <img src={business.signatureUrl} alt="Signature" className="w-full h-24 object-contain" />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl">
                  <button
                    onClick={() => setShowSignatureModal(true)}
                    className="bg-white text-black px-4 py-2 rounded-lg text-xs font-bold uppercase"
                  >
                    Modifier
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-4 px-8 border-2 border-dashed border-gray-300 rounded-xl w-full">
                <p className="text-xs text-gray-400 mb-3">Aucune signature enregistrée</p>
                <button
                  onClick={() => setShowSignatureModal(true)}
                  className="bg-blue-600 text-white px-4 py-3 rounded-xl font-bold text-xs uppercase shadow-lg shadow-blue-200 active:scale-95 transition-all"
                >
                  Créer ma signature
                </button>
              </div>
            )}
            <p className="text-[10px] text-gray-400 text-center max-w-sm">
              Cette signature sera apposée automatiquement au bas de vos factures et reçus pour les authentifier visuellement.
            </p>
          </div>
        </div>

        {/* Modal Signature */}
        {showSignatureModal && (
          <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
              <div className="p-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                <h3 className="text-sm font-black uppercase text-gray-800">Dessinez votre signature</h3>
                <button onClick={() => setShowSignatureModal(false)}><X size={20} className="text-gray-400" /></button>
              </div>

              <div className="p-4 bg-gray-100 flex justify-center">
                <div className="border-2 border-gray-300 bg-white rounded-xl overflow-hidden shadow-inner">
                  <SignatureCanvas
                    ref={sigCanvasRef}
                    penColor="black"
                    canvasProps={{
                      width: 320,
                      height: 160,
                      className: 'signature-canvas cursor-crosshair'
                    }}
                    backgroundColor="rgba(255,255,255,1)"
                  />
                </div>
              </div>

              <div className="p-4 flex gap-3 justify-center bg-white border-t border-gray-100">
                <button
                  onClick={clearSignature}
                  className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-gray-500 bg-gray-100 rounded-xl hover:bg-gray-200"
                >
                  <Eraser size={14} /> Effacer
                </button>
                <button
                  onClick={saveSignature}
                  className="flex items-center gap-2 px-6 py-2 text-xs font-black text-white bg-blue-600 rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-200"
                >
                  <Check size={14} /> Valider
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Template Selector */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Palette size={18} className="text-blue-600" />
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Style de Document</label>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {templates.map((t) => (
              <button
                key={t.id}
                onClick={() => onUpdateTemplate(t.id)}
                className={`p-3 rounded-2xl border-2 transition-all text-center flex flex-col items-center gap-2 ${templateId === t.id
                  ? 'border-blue-600 bg-blue-50 scale-105 shadow-md'
                  : 'border-gray-100 bg-gray-50 opacity-60'
                  }`}
              >
                <div className={`w-8 h-10 rounded border ${templateId === t.id ? 'border-blue-400 bg-white' : 'border-gray-300 bg-gray-100'}`}>
                  {t.id === 'elegant' && <div className="w-2 h-full bg-blue-200"></div>}
                </div>
                <div>
                  <p className={`text-[10px] font-black uppercase leading-none mb-1 ${templateId === t.id ? 'text-blue-900' : 'text-gray-500'}`}>{t.name}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>


      {/* SECTION PARRAINAGE */}
      <div className="bg-gradient-to-br from-indigo-900 to-blue-900 p-4 rounded-2xl shadow-lg border border-indigo-700 text-white overflow-hidden relative animate-in slide-in-from-bottom-4 duration-700">
        <div className="absolute top-0 right-0 p-8 opacity-10 transform rotate-12 pointer-events-none">
          <UserPlus size={120} />
        </div>

        <div className="relative z-10 transition-transform hover:scale-[1.01] duration-300">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm shadow-inner">
              <UserPlus size={24} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white uppercase tracking-tight">Gagnez des Crédits</h2>
              <p className="text-[10px] font-bold text-indigo-200 uppercase tracking-widest">Programme de parrainage</p>
            </div>
          </div>

          <div className="bg-white/10 p-4 rounded-xl backdrop-blur-sm border border-white/10 mb-4 shadow-sm">
            <p className="text-xs font-medium text-center text-indigo-100 leading-relaxed">
              Invitez d'autres commerçants et recevez <span className="font-black text-yellow-400 text-sm">500 CRÉDITS</span> pour chaque inscription validée !
            </p>
          </div>

          <div className="bg-white p-1 pl-4 rounded-xl flex items-center justify-between gap-2 shadow-xl ring-4 ring-white/10">
            <div className="flex-grow py-2">
              <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Votre Code Unique</p>
              {userProfile?.referral_code ? (
                <p className="text-xl font-black text-blue-900 tracking-widest font-mono select-all">
                  {userProfile.referral_code}
                </p>
              ) : (
                <p className="text-xs font-bold text-gray-400 italic">Code non disponible</p>
              )}
            </div>
            <button
              onClick={() => {
                const code = userProfile?.referral_code;
                if (!code) return;
                const text = `Rejoins FactureMan avec mon code *${code}* et gère ton business simplement ! 🚀`;
                if (navigator.share) {
                  navigator.share({
                    title: 'Rejoins FactureMan',
                    text: text,
                  }).catch(console.error);
                } else {
                  navigator.clipboard.writeText(text);
                  alert("Code copié dans le presse-papier !");
                }
              }}
              className="bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 active:scale-95 transition-all shadow-lg flex-shrink-0"
            >
              <Share2 size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* SECTION ANNUAIRE CLIENTS */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200">
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-green-600 p-2 rounded-lg text-white">
            <Contact2 size={20} />
          </div>
          <div>
            <h2 className="text-xl font-black text-gray-900">Annuaire Clients</h2>
            <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Base de données contacts</p>
          </div>
        </div>

        <div className="flex gap-2 mb-6">
          <div className="relative flex-grow">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Rechercher un client..."
              className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none font-medium"
              value={clientSearch}
              onChange={(e) => setClientSearch(e.target.value)}
            />
          </div>

          <button
            onClick={async () => {
              // Vérification du support API Contacts
              if ('contacts' in navigator && 'ContactsManager' in window) {
                try {
                  const props = ['name', 'tel'];
                  const opts = { multiple: true };
                  // @ts-ignore
                  const contacts = await navigator.contacts.select(props, opts);

                  let count = 0;
                  // @ts-ignore
                  for (const contact of contacts) {
                    // @ts-ignore
                    const name = contact.name?.[0];
                    // @ts-ignore
                    const phone = contact.tel?.[0];

                    if (name && phone) {
                      // Note: onAddClient gère déjà les doublons dans App.tsx
                      onAddClient(name, phone);
                      count++;
                    }
                  }

                  if (count > 0) {
                    alert(`${count} contact(s) importé(s) avec succès !`);
                  }
                } catch (ex) {
                  console.error(ex);
                  // Annulation utilisateur ou erreur
                }
              } else {
                alert("Désolé, l'importation de contacts n'est pas supportée par ce navigateur.\nEssayez d'utiliser Chrome sur Android.");
              }
            }}
            className="bg-blue-100 text-blue-700 px-3 rounded-xl hover:bg-blue-200 active:scale-95 transition-all flex items-center justify-center border border-blue-200"
            title="Importer depuis le téléphone"
          >
            <Download size={20} />
          </button>

          <button
            onClick={() => {
              setIsAddingClient(true);
              setEditName('');
              setEditPhone('');
            }}
            className="bg-green-600 text-white px-4 rounded-xl shadow-lg shadow-green-200 active:scale-95 transition-all flex items-center justify-center"
            title="Ajouter un nouveau client"
          >
            <UserPlus size={24} />
          </button>
        </div>

        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
          {filteredClients.length > 0 ? (
            filteredClients.map((client, idx) => (
              <div key={idx}
                onClick={() => {
                  setClientSearch(''); // Clear search logic if desired, or keep it.
                  // Logic to view history
                  setSelectedClient(client);
                }}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100 group hover:border-green-200 transition-all cursor-pointer hover:bg-green-50"
              >
                <div className="flex items-center gap-3 pointer-events-none">
                  <div className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-400">
                    <User size={20} />
                  </div>
                  <div>
                    <h4 className="text-[10px] font-black text-gray-900 uppercase truncate max-w-[150px]">{client.name}</h4>
                    <p className="text-[9px] font-bold text-gray-400 tracking-wider">
                      {client.phone ? client.phone : "NUMÉRO NON DISPONIBLE"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[8px] font-bold text-blue-500 uppercase opacity-0 group-hover:opacity-100 transition-opacity">Voir Historique</span>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setClientToEdit(client);
                      setEditName(client.name);
                      setEditPhone(client.phone || '');
                    }}
                    className="p-2 text-blue-400 hover:text-blue-600 hover:bg-blue-100 rounded-lg transition-all"
                    title="Modifier"
                  >
                    <Edit2 size={16} />
                  </button>

                  {client.phone && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(`https://wa.me/${client.phone.replace(/\s/g, '')}`, '_blank');
                      }}
                      className="p-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-600 hover:text-white transition-all active:scale-90"
                      title="Contacter sur WhatsApp"
                    >
                      <MessageCircle size={18} />
                    </button>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-10 opacity-40">
              <Contact2 size={32} className="mx-auto mb-2" />
              <p className="text-[10px] font-black uppercase tracking-widest">Aucun client répertorié</p>
            </div>
          )}
        </div>
      </div>

      {/* ADD CLIENT MODAL */}
      {isAddingClient && (
        <div className="fixed inset-0 z-[120] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl flex flex-col animate-in zoom-in-95 duration-200 p-6 space-y-4">
            <h3 className="text-lg font-black uppercase text-green-700 flex items-center gap-2">
              <UserPlus size={20} /> Nouveau Client
            </h3>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase">Nom du client</label>
                <input
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold text-blue-900 uppercase"
                  placeholder="EX: MOUSSA DIARRA"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  autoFocus
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase">Téléphone (WhatsApp)</label>
                <input
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold text-blue-900"
                  placeholder="EX: 70 00 00 00"
                  value={editPhone}
                  onChange={e => setEditPhone(e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setIsAddingClient(false)}
                className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold uppercase text-xs hover:bg-gray-200"
              >
                Annuler
              </button>
              <button
                onClick={() => {
                  if (editName.trim()) {
                    onAddClient(editName, editPhone);
                    setIsAddingClient(false);
                  }
                }}
                className="flex-1 py-3 bg-green-600 text-white rounded-xl font-bold uppercase text-xs hover:bg-green-700 shadow-lg shadow-green-500/30 flex items-center justify-center gap-2"
              >
                <Save size={16} /> Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT CLIENT MODAL */}
      {clientToEdit && (
        <div className="fixed inset-0 z-[120] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl flex flex-col animate-in zoom-in-95 duration-200 p-6 space-y-4">
            <h3 className="text-lg font-black uppercase text-blue-900 flex items-center gap-2">
              <Edit2 size={20} /> Modifier Client
            </h3>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase">Nom du client</label>
                <input
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold text-blue-900 uppercase"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase">Téléphone (WhatsApp)</label>
                <input
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold text-blue-900"
                  value={editPhone}
                  onChange={e => setEditPhone(e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setClientToEdit(null)}
                className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold uppercase text-xs hover:bg-gray-200"
              >
                Annuler
              </button>
              <button
                onClick={() => {
                  if (editName.trim()) {
                    onUpdateClient(clientToEdit.name, editName, editPhone);
                    setClientToEdit(null);
                  }
                }}
                className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold uppercase text-xs hover:bg-blue-700 shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2"
              >
                <Save size={16} /> Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CLIENT HISTORY MODAL */}
      {selectedClient && (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md max-h-[80vh] rounded-3xl shadow-2xl flex flex-col animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-3xl">
              <div>
                <h3 className="text-lg font-black uppercase text-blue-900">{selectedClient.name}</h3>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  {selectedClient.phone ? `Historique complet (${selectedClient.phone})` : 'Historique complet'}
                </p>
              </div>
              <button onClick={() => setSelectedClient(null)} className="p-2 bg-white rounded-full text-gray-400 hover:text-red-500 transition-colors"><X size={20} /></button>
            </div>
            <div className="p-4 overflow-y-auto space-y-3 custom-scrollbar">
              {history.filter(h => {
                const isNameMatch = h.customerName.toUpperCase() === selectedClient.name.toUpperCase();
                const cleanDocPhone = h.customerPhone?.replace(/\s/g, '') || '';
                const cleanClientPhone = selectedClient.phone?.replace(/\s/g, '') || '';
                const isPhoneMatch = cleanClientPhone && cleanDocPhone && cleanDocPhone === cleanClientPhone;
                return isNameMatch || isPhoneMatch;
              }).length > 0 ? (
                history
                  .filter(h => {
                    const isNameMatch = h.customerName.toUpperCase() === selectedClient.name.toUpperCase();
                    const cleanDocPhone = h.customerPhone?.replace(/\s/g, '') || '';
                    const cleanClientPhone = selectedClient.phone?.replace(/\s/g, '') || '';
                    const isPhoneMatch = cleanClientPhone && cleanDocPhone && cleanDocPhone === cleanClientPhone;
                    return isNameMatch || isPhoneMatch;
                  })
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .map(doc => (
                    <button
                      key={doc.id}
                      onClick={() => onPreviewDoc && onPreviewDoc(doc)}
                      className="w-full p-4 rounded-2xl border border-gray-100 flex items-center justify-between bg-white shadow-sm hover:border-blue-300 hover:bg-blue-50/50 hover:shadow-md transition-all group text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl transition-colors ${doc.type === 'Facture' ? 'bg-blue-50 text-blue-600 group-hover:bg-blue-100' : (doc.type === 'Reçu de Versement' ? 'bg-green-50 text-green-600 group-hover:bg-green-100' : 'bg-gray-50 text-gray-600 group-hover:bg-gray-100')}`}>
                          <FileText size={16} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-[10px] font-black uppercase text-gray-800">{doc.type} N°{doc.number}</p>
                            <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[8px] font-bold text-blue-500 uppercase bg-blue-100 px-1 rounded">Voir</span>
                          </div>
                          <p className="text-[9px] font-bold text-gray-400">{new Date(doc.date).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-black text-gray-900">
                          {doc.type === 'Reçu de Versement'
                            ? new Intl.NumberFormat('fr-FR').format(doc.amountPaid || 0)
                            : new Intl.NumberFormat('fr-FR').format(doc.items.reduce((acc, i) => acc + (i.unitPrice * i.quantity), 0))
                          } F
                        </p>
                        <span className={`text-[8px] font-bold uppercase px-2 py-0.5 rounded-full ${doc.isFinalized ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                          {doc.isFinalized ? 'Validé' : 'Brouillon'}
                        </span>
                      </div>
                    </button>

                  ))
              ) : (
                <div className="text-center py-10 opacity-50">
                  <p>Aucun document trouvé.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* SECTION COMPTE */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200">
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-red-600 p-2 rounded-lg text-white">
            <User size={20} />
          </div>
          <div>
            <h2 className="text-xl font-black text-gray-900">Mon Compte</h2>
            <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Sécurité & Connexion</p>
          </div>
        </div>

        <button
          onClick={() => {
            if (confirm("Êtes-vous sûr de vouloir vous déconnecter ?")) {
              onLogout();
            }
          }}
          className="w-full p-4 bg-red-50 text-red-700 rounded-xl border border-red-100 flex items-center justify-center gap-2 hover:bg-red-100 transition-colors font-black uppercase text-xs"
        >
          <User size={18} /> Se déconnecter
        </button>

        <button
          onClick={onSync}
          className="w-full mt-3 p-4 bg-blue-50 text-blue-700 rounded-xl border border-blue-100 flex items-center justify-center gap-2 hover:bg-blue-100 transition-colors font-black uppercase text-xs"
        >
          <Activity size={18} /> Resynchroniser Données
        </button>

        <button
          onClick={() => {
            const data = {
              userProfile,
              business,
              history,
              credits,
            };
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `factureman_backup_${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
          }}
          className="w-full mt-3 p-4 bg-gray-50 text-gray-700 rounded-xl border border-gray-100 flex items-center justify-center gap-2 hover:bg-gray-100 transition-colors font-black uppercase text-xs"
        >
          <Download size={18} /> Exporter mes données
        </button>
      </div>


      {/* FOOTER INFO */}
      <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100 flex items-start gap-3">
        <div className="bg-orange-100 p-2 rounded-lg text-orange-600">
          <Store size={20} />
        </div>
        <div>
          <h4 className="text-xs font-black text-orange-900 uppercase mb-1">Conseil Pro</h4>
          <p className="text-[10px] text-orange-700 font-bold leading-tight">
            Les clients apparaissent dans l'annuaire dès que vous générez une facture avec leur nom. Pensez à bien saisir leur numéro WhatsApp pour les contacter facilement.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ProfileSettings;
