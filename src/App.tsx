import React, { useState, useEffect, useRef } from 'react';
import { InvoiceData, AppStep, DocumentType, Product, BusinessInfo, CreditRecord, Reminder, UserProfile, CreditHistoryItem } from './types';
import { DEFAULT_BUSINESS, PRODUCT_CATALOG } from './constants';
import { generateInvoiceNumber, formatCurrency, generateUUID } from './utils/format';
import InvoiceForm from './components/InvoiceForm';
import InvoicePreview from './components/InvoicePreview';
import StockManager from './components/StockManager';
import HistoryManager from './components/HistoryManager';
import ProfileSettings from './components/ProfileSettings';
import CreditManager from './components/CreditManager';
import { extractItemsFromImage } from './services/ocrService';
import {
  FileText, Eye, Printer, ArrowLeft, Loader2, Package,
  LayoutDashboard, CheckCircle2, Clock, Share2,
  Plus, Check, UserCircle, Wallet, AlertTriangle,
  CopyPlus, X, Download, FileDown, Bell
} from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { notificationService } from './services/notificationService';
import { supabase } from './services/supabaseClient';
import AuthScreen from './components/AuthScreen';
import LandingPage from './components/LandingPage';
import { dataSyncService } from './services/dataSyncService';
import { storageService } from './services/storageService';
import { Session } from '@supabase/supabase-js';
import { LogOut } from 'lucide-react';
import { useWallet } from './hooks/useWallet';
import { useScanner } from './hooks/useScanner';
import { useOfflineActivity } from './hooks/useOfflineActivity';
import OnboardingTour from './components/OnboardingTour';
import ChangePasswordModal from './components/ChangePasswordModal';
import NotificationCenter, { AppNotification } from './components/NotificationCenter';
import { VerifyDocument } from './components/VerifyDocument';

const App: React.FC = () => {
  // ROUTING HACK: Simple manual routing for Verification Page
  if (window.location.pathname.startsWith('/verify')) {
    return <VerifyDocument />;
  }

  const [step, setStep] = useState<AppStep>(AppStep.FORM);
  const [previousStep, setPreviousStep] = useState<AppStep>(AppStep.FORM);

  const goToStep = (newStep: AppStep) => {
    if (newStep === AppStep.PREVIEW) {
      setPreviousStep(step);
    }
    setStep(newStep);
    window.scrollTo(0, 0);
    // Sync history so we stay on 'app' level but update content info
    window.history.replaceState({ step: newStep, level: 'app' }, '');
  };

  const [showOnboarding, setShowOnboarding] = useState(false);

  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [showExitToast, setShowExitToast] = useState(false); // New State for Exit Toast
  const [showConvertMenu, setShowConvertMenu] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Ref to track current step for event listeners
  const stepRef = useRef<AppStep>(AppStep.FORM);
  useEffect(() => { stepRef.current = step; }, [step]);

  // AUTHENTICATION STATE
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showPasswordResetModal, setShowPasswordResetModal] = useState(false);
  const [isDataLoaded, setIsDataLoaded] = useState(false); // Guard against overwriting data before load

  // NOTIFICATION & SYNC STATE
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'error' | 'success' | 'offline'>('idle');

  // --- CHECKERS ---
  const addNotification = (notif: Omit<AppNotification, 'id' | 'date' | 'read'>) => {
    setNotifications(prev => {
      // Avoid duplicate titles (simple dedup)
      if (prev.some(n => n.title === notif.title && n.read === false)) return prev;
      return [{
        ...notif,
        id: generateUUID(),
        date: new Date(),
        read: false
      }, ...prev];
    });
  };

  const checkAlerts = (currentProducts: Product[], currentCredits: number) => {
    // 1. Stock Alert
    const lowStock = currentProducts.filter(p => p.stock > 0 && p.stock <= 5);
    if (lowStock.length > 0) {
      addNotification({
        type: 'warning',
        title: 'Stock Faible',
        message: `${lowStock.length} produit(s) sont presque épuisés (stock <= 5). Vérifiez votre inventaire.`
      });
    }

    // 2. Credits Alert
    if (currentCredits < 200 && currentCredits > 0) {
      addNotification({
        type: 'alert',
        title: 'Crédits Bas',
        message: `Il ne vous reste que ${currentCredits} crédits. Les scans et sauvegardes cloud risquent d'échouer.`
      });
    }
  };

  useEffect(() => {
    const handleOnline = () => setSyncStatus('idle');
    const handleOffline = () => {
      setSyncStatus('offline');
      addNotification({
        type: 'warning',
        title: 'Mode Hors-Ligne',
        message: 'Vous êtes déconnecté. Vos données sont sauvegardées localement et seront synchronisées au retour de la connexion.'
      });
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check
    if (!navigator.onLine) handleOffline();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    // 1. Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });

    // 2. Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Check for Password Reset Mode
  useEffect(() => {
    if (session && localStorage.getItem('reset_mode') === 'true') {
      setShowPasswordResetModal(true);
    }
  }, [session]);

  // PROFILE & CREDITS MANAGEMENT
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  // SECURE OFFLINE WALLET (Cash on Device)
  const { walletCredits, setWalletCredits } = useWallet(session, userProfile, setUserProfile);

  useEffect(() => {
    if (session?.user) {
      // 0. LOAD LOCAL DATA
      try {
        const userId = session.user.id;

        // Profile (Bank Info)
        const localKey = `factureman_${userId}_profile`;
        const localProfile = localStorage.getItem(localKey);
        if (localProfile) setUserProfile(JSON.parse(localProfile));

      } catch (e) { console.error("Error loading local data", e); }

      // 1. Fetch Cloud Profile (Bank Balance)
      supabase.from('profiles').select('*').eq('id', session.user.id).single()
        .then(({ data, error }) => {
          if (data) {
            setUserProfile(data);
            localStorage.setItem(`factureman_${session.user.id}_profile`, JSON.stringify(data));
          }
        });

      // 2. Realtime Updates (Bank Deposits)
      const channel = supabase.channel('realtime-profile')
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${session.user.id}` },
          (payload) => {
            const newProfile = payload.new as UserProfile;
            setUserProfile(newProfile);
            localStorage.setItem(`factureman_${session.user.id}_profile`, JSON.stringify(newProfile));
            // Removed sticky toast for background update
            addNotification({
              type: 'success',
              title: 'Crédits Reçus',
              message: `Votre solde a été mis à jour : ${newProfile.app_credits} crédits disponibles.`
            });
          }
        )
        .subscribe();

      // Check onboarding status
      const hasSeen = localStorage.getItem('has_seen_onboarding');
      if (!hasSeen) setShowOnboarding(true);

    } else {
      // Logic for handling implicit logout or checks
    }
  }, [session]);

  // PERSIST PROFILE CHANGES (Optimistic updates included)
  useEffect(() => {
    if (session?.user?.id && userProfile) {
      localStorage.setItem(`factureman_${session.user.id}_profile`, JSON.stringify(userProfile));
    }
  }, [userProfile, session]);

  // SMART WALLET REFILL (Auto-Withdrawal)

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallApp = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  // --- NAVIGATION LOGIC ---
  // const goToStep = (newStep: AppStep, saveHistory = true) => {
  //   setPreviousStep(step);
  //   setStep(newStep);
  //   if (saveHistory) {
  //     window.history.pushState({ step: newStep }, '');
  //   }
  // };

  // --- DOUBLE BACK TO EXIT LOGIC ---
  const exitAttemptRef = useRef(false);

  useEffect(() => {
    // 1. Establish History Guard on Mount
    // We push a state so that the user is at index+1 (App Level). 
    // Pressing back takes them to index (Root Level), which we intercept.
    window.history.pushState({ step: AppStep.FORM, level: 'app' }, '');

    const handlePopState = (event: PopStateEvent) => {
      // Check if we popped out of the app level
      const state = event.state;
      const isExitAttempt = !state || state.level !== 'app';

      if (isExitAttempt) {
        if (exitAttemptRef.current) {
          // Double click confirmed -> Exit (Allow the pop to stand, which is effectively exit/back)
          return;
        } else {
          // First click -> Trap
          // Restore 'app' state immediately to prevent closing
          window.history.pushState({ step: stepRef.current, level: 'app' }, '');

          // Show Toast & Set Flag
          setShowExitToast(true);
          exitAttemptRef.current = true;

          setTimeout(() => {
            setShowExitToast(false);
            exitAttemptRef.current = false;
          }, 2000);
          return;
        }
      }

      // Handle normal history navigation if applicable
      if (state && state.step) {
        setStep(state.step);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);
  // ------------------------

  // --- DATA PERSISTENCE (USER ISOLATED) ---
  const getStorageKey = (key: string) => {
    if (!session?.user?.id) return null;
    return `factureman_${session.user.id}_${key}`;
  };

  // --- STATE DECLARATIONS ---
  const [products, setProducts] = useState<Product[]>([]);
  const [history, setHistory] = useState<InvoiceData[]>([]);
  const [credits, setCredits] = useState<CreditRecord[]>([]);

  /* REMOVED FROM HERE, SEE BELOW */

  const [businessInfo, setBusinessInfo] = useState<BusinessInfo>({
    name: 'VOTRE ENTREPRISE',
    specialty: 'Votre spécialité',
    address: 'Adresse...',
    phone: 'Tél...',
    city: 'Ville'
  });

  const [templatePreference, setTemplatePreference] = useState<'classic' | 'modern' | 'elegant'>('classic');

  // Load User Data on Session Change
  useEffect(() => {
    if (session?.user?.id) {
      // Expose supabase for debugging
      if (typeof window !== 'undefined') {
        (window as any).supabase = supabase;
        (window as any).userId = session.user.id;
      }

      const loadData = async () => {
        console.log('🔄 Loading user data from cloud and localStorage...');
        console.log('👤 User ID:', session.user.id);

        // 1. PRIORITIZE CLOUD DATA (Source of Truth)
        // This ensures users get their data back even after clearing browser
        const cloudData = await dataSyncService.fetchUserData(session.user.id);

        if (cloudData) {
          console.log('✅ Cloud data loaded:', {
            products: cloudData.products?.length || 0,
            history: cloudData.history?.length || 0,
            credits: cloudData.credits?.length || 0,
            businessInfo: cloudData.businessInfo ? 'YES' : 'NO'
          });

          // CRITICAL FIX: Only set cloud data if it has content
          // Don't overwrite with empty arrays
          if (cloudData.products && cloudData.products.length > 0) {
            setProducts(cloudData.products);
            console.log('✅ Products from cloud:', cloudData.products.length);
          } else {
            console.log('⚠️ No products in cloud, keeping current state');
          }

          if (cloudData.history && cloudData.history.length > 0) {
            setHistory(cloudData.history);
          }

          if (cloudData.credits && cloudData.credits.length > 0) {
            setCredits(cloudData.credits);
          }

          if (cloudData.businessInfo) {
            setBusinessInfo(cloudData.businessInfo);
          }

          console.log('✅ Cloud data applied to state');
        } else {
          console.warn('⚠️ No cloud data - possible connection issue');
        }

        // 2. Load Local Storage (For offline changes not yet synced)
        const invKey = getStorageKey('inventory');
        const histKey = getStorageKey('history');
        const credKey = getStorageKey('credits');
        const busKey = getStorageKey('business');
        const tplKey = getStorageKey('template');

        // Helper: Merge prioritizing CLOUD data but keeping local unsynced items
        const mergeArrays = <T extends { id: string }>(cloud: T[], local: T[]): T[] => {
          const map = new Map<string, T>();
          // Cloud items first (source of truth)
          cloud.forEach(item => map.set(item.id, item));
          // Add local items that don't exist in cloud (new offline items)
          local.forEach(item => {
            if (!map.has(item.id)) {
              map.set(item.id, item);
            }
          });
          return Array.from(map.values());
        };

        if (invKey) {
          const savedInv = localStorage.getItem(invKey);
          if (savedInv) {
            const localProducts = JSON.parse(savedInv);
            setProducts(prev => mergeArrays(prev, localProducts));
          }
        }
        if (histKey) {
          const savedHist = localStorage.getItem(histKey);
          if (savedHist) {
            const localHistory = JSON.parse(savedHist);
            setHistory(prev => mergeArrays(prev, localHistory));
          }
        }
        if (credKey) {
          const savedCred = localStorage.getItem(credKey);
          if (savedCred) {
            const localCredits = JSON.parse(savedCred);
            setCredits(prev => mergeArrays(prev, localCredits));
          }
        }
        if (busKey) {
          const savedBus = localStorage.getItem(busKey);
          if (savedBus) {
            const localBusiness = JSON.parse(savedBus);
            // Only use local business if cloud doesn't have it or local is more recent
            setBusinessInfo(prev => {
              if (!prev || prev.name === 'VOTRE ENTREPRISE') return localBusiness;
              return prev;
            });
          }
        }
        if (tplKey) {
          setTemplatePreference((localStorage.getItem(tplKey) as any) || 'classic');
        }

        console.log('✅ Data loading complete');
        setIsDataLoaded(true);
      };
      loadData();
    }
  }, [session]);

  // Save Data on Change (Local + Cloud)
  useEffect(() => {
    const key = getStorageKey('inventory');
    if (key) {
      localStorage.setItem(key, JSON.stringify(products));
      console.log('💾 Products saved to localStorage:', products.length);
    }
    if (session?.user?.id && products.length > 0) {
      console.log('📤 Saving products to cloud...', products.length);
      dataSyncService.saveProducts(products, session.user.id)
        .then(() => console.log('✅ Products saved to cloud'))
        .catch(err => console.error('❌ Error saving products:', err));
    } else if (session?.user?.id && products.length === 0) {
      console.warn('⚠️ Skipped cloud save: products is empty');
    }
  }, [products, session]);

  useEffect(() => {
    const key = getStorageKey('history');
    if (key) localStorage.setItem(key, JSON.stringify(history));
    if (session?.user?.id) dataSyncService.saveInvoices(history, session.user.id);
  }, [history, session]);

  useEffect(() => {
    const key = getStorageKey('credits');
    if (key) localStorage.setItem(key, JSON.stringify(credits));
    if (session?.user?.id) dataSyncService.saveCreditRecords(credits, session.user.id);
  }, [credits, session]);

  useEffect(() => {
    const key = getStorageKey('business');
    if (key) localStorage.setItem(key, JSON.stringify(businessInfo));

    // Only save to cloud if we have a valid session AND data is loaded
    // This prevents overwriting cloud data with initial default state on mount
    if (session?.user?.id && isDataLoaded) {
      console.log('📤 Saving business info to cloud...');
      dataSyncService.saveBusinessInfo(businessInfo, session.user.id)
        .then(() => console.log('✅ Business info saved to cloud'))
        .catch(err => console.error('❌ Error saving profile:', err));
    }

    // Update current draft invoice business info if it's not finalized
    setInvoiceData(prev => {
      if (!prev.isFinalized) {
        return { ...prev, business: businessInfo };
      }
      return prev;
    });
  }, [businessInfo, session, isDataLoaded]);

  // Persist Template Preference & Update Draft
  useEffect(() => {
    if (!isDataLoaded) return; // Wait for initial load
    const key = getStorageKey('template');
    if (key) localStorage.setItem(key, templatePreference);

    // Update current draft invoice template if it's not finalized
    setInvoiceData(prev => {
      if (!prev.isFinalized) {
        return { ...prev, templateId: templatePreference };
      }
      return prev;
    });
  }, [templatePreference, session, isDataLoaded]);

  // AUTO SYNC & ALERTS CHECK LOOP
  useEffect(() => {
    const interval = setInterval(async () => {
      if (!session?.user?.id || !navigator.onLine) return;

      setSyncStatus('syncing');
      const result = await dataSyncService.syncAll(session.user.id, {
        products,
        invoices: history,
        credits,
        businessInfo
      });

      if (result.success) {
        setSyncStatus('success');
        setTimeout(() => setSyncStatus('idle'), 3000);

        // --- PULL: Fetch latest changes from other devices ---
        try {
          const cloudData = await dataSyncService.fetchUserData(session.user.id);
          if (cloudData) {
            const mergeArrays = <T extends { id: string }>(local: T[], cloud: T[]): T[] => {
              const map = new Map<string, T>();
              cloud.forEach(item => map.set(item.id, item));
              local.forEach(item => map.set(item.id, item));
              return Array.from(map.values());
            };

            setProducts(prev => mergeArrays(prev, cloudData.products));
            setHistory(prev => mergeArrays(prev, cloudData.history));
            setCredits(prev => mergeArrays(prev, cloudData.credits));
            // Note: We don't overwrite Business Info automatically to avoid annoying resets while editing
          }
        } catch (e) {
          console.warn("Auto-Pull Failed", e);
        }

      } else {
        setSyncStatus('error');
      }

      // Check alerts every cycle
      checkAlerts(products, walletCredits);

    }, 2 * 60 * 1000); // Every 2 minutes
    return () => clearInterval(interval);
  }, [session, products, history, credits, businessInfo, walletCredits]);



  const [invoiceData, setInvoiceData] = useState<InvoiceData>(() => ({
    id: Math.random().toString(36).substr(2, 9),
    type: DocumentType.INVOICE,
    number: generateInvoiceNumber(),
    date: new Date().toISOString().split('T')[0],
    customerName: '',
    customerPhone: '',
    items: [{ id: Math.random().toString(36).substr(2, 9), quantity: 1, description: '', unitPrice: 0 }],
    business: businessInfo,
    templateId: templatePreference,
    amountPaid: 0,
    isFinalized: false,
    creditConfirmed: false
  }));

  // --- AUTO PDF GENERATION (SILENT) ---
  useEffect(() => {
    // Trigger ONLY if:
    // 1. We are in PREVIEW mode
    // 2. The document is FINALIZED
    // 3. It doesn't have a PDF URL yet
    // 4. We are ONLINE and logged in
    if (step === AppStep.PREVIEW && invoiceData.isFinalized && !invoiceData.pdfUrl && session?.user?.id && navigator.onLine) {

      const generateAndUpload = async () => {
        // Wait for DOM render
        await new Promise(r => setTimeout(r, 1500));

        const element = document.getElementById('invoice-preview-container');
        if (!element) {
          console.warn("PDF Gen: Element not reserved or found");
          return;
        }

        try {
          console.log("📄 Auto-Generating PDF for Cloud...");
          // @ts-ignore
          const html2pdf = (await import('html2pdf.js')).default;

          const opt = {
            margin: 0,
            filename: `DOC_${invoiceData.number}.pdf`,
            image: { type: 'jpeg' as const, quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const }
          };

          const pdfBlob = await html2pdf().set(opt).from(element).output('blob');
          if (!pdfBlob) return;

          const fileName = `FAC_${invoiceData.number}_${Date.now()}.pdf`;
          const publicUrl = await storageService.uploadInvoicePDF(pdfBlob, fileName, session.user.id!);

          if (publicUrl) {
            console.log("☁️ PDF Uploaded Successfully:", publicUrl);

            // Update State & DB
            const updatedDoc = { ...invoiceData, pdfUrl: publicUrl };

            // 1. Update Current View State
            setInvoiceData(updatedDoc);

            // 2. Update History State
            setHistory(prev => prev.map(h => h.id === updatedDoc.id ? updatedDoc : h));

            // 3. Update Cloud Metadata (Clean & Sync)
            await storageService.saveInvoiceToCloud(updatedDoc, publicUrl);

            // Removed sticky toast for background PDF upload
          }
        } catch (e) {
          console.error("Auto PDF Error:", e);
        }
      };

      generateAndUpload();
    }
  }, [step, invoiceData.isFinalized, invoiceData.pdfUrl, session]);

  // Reminder Logic
  // Calculate ALL clients from History and Credits for autocomplete
  const allUniqueClients = React.useMemo(() => {
    const clientMap = new Map<string, string>();

    // 1. From History (older sources first)
    history.forEach(inv => {
      const name = inv.customerName.trim().toUpperCase();
      if (name && name !== "CLIENT COMPTANT") {
        // If we don't have this client yet, add them
        if (!clientMap.has(name)) {
          clientMap.set(name, inv.customerPhone || "");
        } else if (inv.customerPhone) {
          // If we have them but this invoice has a phone and stored doesn't, update it
          // Or just trust the latest invoice? History is usually chronological?
          // "slice().reverse()" in ProfileSettings suggested invoices are ordered?
          // Actually let's just ensure we capture a phone if we have one.
          if (!clientMap.get(name)) {
            clientMap.set(name, inv.customerPhone);
          }
        }
      }
    });

    // 2. From Credits (Profile/Wallet) - Source of truth overrides
    credits.forEach(c => {
      const name = c.customerName.trim().toUpperCase();
      if (name && name !== "CLIENT COMPTANT") {
        if (c.customerPhone) {
          clientMap.set(name, c.customerPhone);
        } else if (!clientMap.has(name)) {
          clientMap.set(name, "");
        }
      }
    });

    return Array.from(clientMap.entries()).map(([name, phone]) => ({ name, phone }));
  }, [history, credits]);
  const [dueReminders, setDueReminders] = useState<Reminder[]>([]);
  const [showReminderModal, setShowReminderModal] = useState(false);

  useEffect(() => {
    // Initialize Notification Service
    notificationService.requestPermission();
    notificationService.restoreSchedules();
  }, []);

  const handleDismissReminder = (apptId: string, customerName: string) => {
    setCredits(prev => prev.map(c => {
      if (c.customerName === customerName && c.appointments) {
        return {
          ...c,
          appointments: c.appointments.map(a => a.id === apptId ? { ...a, completed: true } : a)
        };
      }
      return c;
    }));
  };

  const currentTotal = invoiceData.items.reduce((acc, item) => acc + (item.quantity * item.unitPrice), 0);
  const currentBalance = currentTotal - (invoiceData.amountPaid || 0);
  const isCreditPending = currentBalance > 0 && !invoiceData.creditConfirmed && invoiceData.type !== DocumentType.RECEIPT;

  const getHeaderTitle = () => {
    switch (step) {
      case AppStep.FORM: return "Saisie Document";
      case AppStep.PREVIEW: return "Aperçu & Impression";
      case AppStep.STOCK: return "Gestion du Stock";
      case AppStep.HISTORY: return "Historique des Ventes";
      case AppStep.PROFILE: return "Profil & Annuaire";
      case AppStep.CREDIT: return "Portefeuille Client";
      default: return "FactureMan";
    }
  };

  // Old Effects Removed - now handled in the grouped useEffects above


  // Old Effects Removed


  // Old Effects Removed


  const handleQuickSaveProduct = (name: string, price: number) => {
    const newProd: Product = {
      id: generateUUID(),
      name: name.toUpperCase(),
      defaultPrice: price,
      stock: 0,
      category: 'Divers'
    };
    setProducts(prev => [newProd, ...prev]);
    setShowSuccessToast(true);
    setTimeout(() => setShowSuccessToast(false), 2000);
  };

  const handleConvertDocument = (source: InvoiceData, newType: DocumentType) => {
    const prefix = newType === DocumentType.INVOICE ? 'F' :
      newType === DocumentType.DELIVERY_NOTE ? 'BL' :
        newType === DocumentType.QUOTE ? 'D' :
          newType === DocumentType.PURCHASE_ORDER ? 'BC' :
            newType === DocumentType.RECEIPT ? 'R' : 'PF';

    // Pour la conversion, on garde les items mais on génère un nouveau numéro
    const parts = generateInvoiceNumber().split('-'); // FYYMMDD-RAND
    const newDoc: InvoiceData = {
      ...source,
      id: generateUUID(),
      type: newType,
      number: `${prefix}${parts[0].substring(1)}-${parts[1]}`, // Reconstruit le numéro avec le bon préfixe
      date: new Date().toISOString().split('T')[0], // Date d'aujourd'hui pour la conversion
      isFinalized: false,
      creditConfirmed: newType === DocumentType.RECEIPT ? true : false,
      amountPaid: 0,
      createdAt: new Date().toISOString()
    };

    setInvoiceData(newDoc);
    setInvoiceData(newDoc);
    goToStep(AppStep.FORM); // Converting sends back to form
    setShowConvertMenu(false);
    setShowSuccessToast(true);
    setTimeout(() => setShowSuccessToast(false), 2000);
  };

  // --- OFFLINE ACTIVITY LIMITS & DEFERRED BILLING ---
  const { canPerformAction, incrementOfflineCount, offlineCount, maxOfflineDocs, hasUnpaidDebt, attemptToPayDebt } = useOfflineActivity();

  // If debt exists blocking the user, we can auto-prompt or just rely on the button clicks
  useEffect(() => {
    if (hasUnpaidDebt && navigator.onLine) {
      // Optionally prompt user: "Sync successful payment required"
    }
  }, [hasUnpaidDebt]);

  // --- SCANNER LOGIC (Refactored to Hook) ---
  const { isScanning, scanFile } = useScanner({
    products,
    onScanSuccess: (newItems, customerName, date) => {
      setInvoiceData(prev => ({
        ...prev,
        customerName: customerName || prev.customerName,
        date: date || prev.date,
        items: newItems.length > 0 ? newItems : prev.items,
        creditConfirmed: false
      }));

      if (newItems.length > 0) {
        const matchCount = newItems.filter((i: any) => products.some(p => p.name === i.description)).length;
        if (matchCount > 0) alert(`${matchCount} article(s) reconnu(s) dans le catalogue !`);
      }

      // DEDUCT SCAN COST (Server Side - Online Feature)
      const PROCESSING_FEE = 40;

      // Optimistic update of UI profile to reflect change immediately
      setUserProfile(prev => prev ? ({ ...prev, app_credits: Math.max(0, prev.app_credits - PROCESSING_FEE) }) : null);

      // Server update happens in background or via subsequent sync/refresh.
      // Note: Formal deduction is ideally handled by the API call in useScanner if we were rigorous, 
      // but here we do it via RPC for consistency with other actions if needed, OR we trust the Scanner Hook to have verified it.
      // Actually, let's explicit call the deduction here to be safe and authoritative.
      supabase.rpc('deduct_credits', { amount: PROCESSING_FEE }).then(({ data, error }) => {
        if (error) {
          console.error("Scan deduction failed", error);
          alert("Erreur de débit. Veuillez vérifier votre solde.");
        }
      });

      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 2000);
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    onError: (msg) => {
      alert(msg);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  });

  const handleScan = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check Server Balance for Processing Fee (Online Feature)
    if (!navigator.onLine) {
      alert("Le scan intelligent nécessite une connexion internet pou fonctionner.");
      return;
    }

    if ((userProfile?.app_credits || 0) < 40) {
      alert("Solde Serveur insuffisant (> 40) pour traiter le résultat.\nVeuillez recharger votre compte en ligne.");
      return;
    }

    // Note: Server-side credit check happens inside scanFile -> API
    scanFile(file);
  };

  // --- FINALIZE DOCUMENT ---
  const finalizeDocument = async (overrideDoc?: InvoiceData) => {
    // Determine which data to use
    const docToProcess = overrideDoc || invoiceData;
    if (!docToProcess) return;

    // 0. CHECK DEBT LOCK
    if (hasUnpaidDebt) {
      if (confirm("Action Bloquée : Paiement en attente pour les documents hors-ligne.\nVoulez-vous régler maintenant ?")) {
        attemptToPayDebt();
      }
      return;
    }

    const DOC_COST = 10;

    // A. ONLINE: Deduct
    if (navigator.onLine) {
      if ((userProfile?.app_credits || 0) < DOC_COST) {
        alert("Solde insuffisant (10 Crédits requis).\nVeuillez recharger votre compte.");
        return;
      }
      const { data: success, error } = await supabase.rpc('deduct_credits', { amount: DOC_COST });
      if (error || !success) {
        alert("Erreur de paiement. Vérifiez votre solde.");
        return;
      }
      // Optimistic
      setUserProfile(prev => prev ? ({ ...prev, app_credits: prev.app_credits - DOC_COST }) : null);
    }
    // B. OFFLINE: Limit & Track
    else {
      // 1. Check Offline Limits (Instead of Credits)
      if (!canPerformAction()) {
        alert(`Limite hors ligne atteinte (${offlineCount}/${maxOfflineDocs}).\n\nVeuillez vous connecter à internet pour sauvegarder votre travail et réinitialiser le compteur.`);
        return;
      }
      incrementOfflineCount();
    }

    const finalName = docToProcess.customerName.trim().toUpperCase() || "CLIENT COMPTANT";
    const finalDoc = {
      ...docToProcess,
      customerName: finalName,
      isFinalized: true,
      creditConfirmed: true,
      createdAt: new Date().toISOString()
    };

    const currentTotalVal = finalDoc.items.reduce((acc, i) => acc + (i.unitPrice * i.quantity), 0);
    const paymentAmount = finalDoc.amountPaid || 0;
    const normalizedName = finalName.toUpperCase();

    if (finalDoc.type === DocumentType.INVOICE || finalDoc.type === DocumentType.RECEIPT) {
      setCredits(prevCredits => {
        const existingIdx = prevCredits.findIndex(c => c.customerName.toUpperCase() === normalizedName);

        let amountToAddToBalance = 0;
        let moves: CreditHistoryItem[] = [];

        if (finalDoc.type === DocumentType.RECEIPT) {
          amountToAddToBalance = -paymentAmount;
        } else {
          amountToAddToBalance = currentTotalVal - paymentAmount;
          moves.push({
            type: 'INVOICE' as const,
            id: finalDoc.id,
            date: finalDoc.date,
            createdAt: finalDoc.createdAt,
            amount: currentTotalVal,
            description: `${finalDoc.type} N°${finalDoc.number}`
          });
        }

        if (paymentAmount > 0) {
          moves.push({
            type: 'PAYMENT' as const,
            id: `pay-${finalDoc.id}`,
            date: finalDoc.date,
            createdAt: finalDoc.createdAt,
            amount: paymentAmount,
            description: finalDoc.type === DocumentType.RECEIPT ? `Versement (Reçu N°${finalDoc.number})` : `Versement sur ${finalDoc.number}`
          });
        }

        if (existingIdx !== -1) {
          const existing = prevCredits[existingIdx];
          const updatedList = [...prevCredits];
          updatedList[existingIdx] = {
            ...existing,
            customerPhone: finalDoc.customerPhone || existing.customerPhone,
            totalDebt: existing.totalDebt + (finalDoc.type === DocumentType.INVOICE ? currentTotalVal : 0),
            remainingBalance: existing.remainingBalance + amountToAddToBalance,
            history: [...moves, ...existing.history]
          };
          return updatedList;
        } else {
          // NEW CLIENT
          return [{
            id: Math.random().toString(36).substr(2, 9),
            customerName: normalizedName,
            customerPhone: finalDoc.customerPhone,
            totalDebt: finalDoc.type === DocumentType.INVOICE ? currentTotalVal : 0,
            remainingBalance: amountToAddToBalance,
            history: moves
          }, ...prevCredits];
        }
      });
    }

    // 3. Track Activity (Already handled in the top block)
    // incrementOfflineCount(); // REMOVED here, moved to top conditional block

    // 4. Update Stock
    if (finalDoc.type !== DocumentType.RECEIPT && finalDoc.type !== DocumentType.PROFORMA && finalDoc.type !== DocumentType.QUOTE) {
      setProducts(prevProds => {
        const updatedProducts = [...prevProds];
        finalDoc.items.forEach(item => {
          const pIndex = updatedProducts.findIndex(p => p.name.toUpperCase() === item.description.toUpperCase());
          if (pIndex !== -1) {
            updatedProducts[pIndex] = { ...updatedProducts[pIndex], stock: Math.max(0, updatedProducts[pIndex].stock - item.quantity) };
          }
        });
        return updatedProducts;
      });
    }

    // 5. Update History
    setHistory(prev => {
      // Find existing credit using CURRENT state (closure capture might be stale but relative calc handles it)
      // Ideally we would chain this but state is separated.
      const existingCredit = credits.find(c => c.customerName.toUpperCase() === normalizedName);
      const previousBalance = existingCredit ? existingCredit.remainingBalance : 0;

      const balanceChange = (finalDoc.type === DocumentType.RECEIPT) ? -paymentAmount : (currentTotalVal - paymentAmount);
      const finalSnapshotBalance = previousBalance + balanceChange; // Approximate immediate snapshot

      let newHistory = [...prev];

      const finalInvoice = {
        ...finalDoc,
        clientBalanceSnapshot: finalSnapshotBalance
      };
      newHistory = [finalInvoice, ...newHistory];

      if (paymentAmount > 0 && finalDoc.type !== DocumentType.RECEIPT) {
        const parts = generateInvoiceNumber().split('-');
        let desc = paymentAmount === currentTotalVal ? `RÈGLEMENT TOTAL ${finalDoc.type} ${finalDoc.number}` : `ACOMPTE ${finalDoc.type} ${finalDoc.number}`;
        if (paymentAmount > currentTotalVal) desc = `RÈGLEMENT ${finalDoc.type} ${finalDoc.number} + VERS. AVOIR`;

        const receiptDoc: InvoiceData = {
          id: `pay-${finalDoc.id}`,
          type: DocumentType.RECEIPT,
          number: `R-${parts[1]}`,
          date: finalDoc.date,
          customerName: finalName,
          customerPhone: finalDoc.customerPhone,
          items: finalDoc.items,
          business: businessInfo,
          templateId: templatePreference,
          amountPaid: paymentAmount,
          isFinalized: true,
          creditConfirmed: true,
          clientBalanceSnapshot: finalSnapshotBalance,
          createdAt: new Date().toISOString()
        };
        newHistory = [receiptDoc, ...newHistory];
      }

      // Note: Cloud save & PDF generation is now handled by a useEffect hook
      // that waits for the Preview component to be fully mounted.
      if (session?.user?.id && navigator.onLine) {
        // We still save metadata immediately to be safe, but without PDF URL for now
        dataSyncService.saveInvoices(newHistory, session.user.id).catch(console.error);
      }

      return newHistory;
    });

    // Old simple sync removed in favor of the robust one above
    /* if (navigator.onLine) {
      storageService.saveInvoiceToCloud(finalDoc)
        .then(ok => ok && console.log("Cloud Backup: Metadata Saved"))
        .catch(err => console.warn("Cloud Backup Failed", err));
    } */

    setInvoiceData({ ...finalDoc, creditConfirmed: true, isFinalized: true });
    setShowSuccessToast(true);
    setTimeout(() => setShowSuccessToast(false), 3000);
    setTimeout(() => goToStep(AppStep.PREVIEW), 100);
  };

  const handleValidateCredit = (balance: number) => {
    // Just finalize, logic handles balance internally via credits state
    finalizeDocument();
  };

  const handleInstantCash = () => {
    const total = invoiceData.items.reduce((acc, item) => acc + (item.quantity * item.unitPrice), 0);
    // Use the higher value: either the calculated total or what the user manually entered (if overpaying)
    const effectiveAmount = Math.max(total, invoiceData.amountPaid || 0);
    const paidData = { ...invoiceData, amountPaid: effectiveAmount };

    // Validation immédiate
    finalizeDocument(paidData);
  };

  const handleSimpleSave = () => {
    // Pour les documents non-financiers (Devis, Proforma, BL, BC)
    // On valide sans paiement
    const savedData = { ...invoiceData, amountPaid: 0 };
    finalizeDocument(savedData);
  };

  // Helper to process the cost of a document (Online/Offline)
  const processDocumentCost = async (): Promise<boolean> => {
    // 0. CHECK DEBT LOCK
    if (hasUnpaidDebt) {
      if (confirm("Action Bloquée : Paiement en attente pour les documents hors-ligne.\nVoulez-vous régler maintenant ?")) {
        attemptToPayDebt();
      }
      return false;
    }

    const DOC_COST = 10;

    // A. ONLINE
    if (navigator.onLine) {
      if ((userProfile?.app_credits || 0) < DOC_COST) {
        alert("Solde Crédit Insuffisant.\n\nVous avez besoin de 10 crédits pour générer ce document.\nVeuillez recharger votre compte pour continuer.");
        return false;
      }
      const { data: success, error } = await supabase.rpc('deduct_credits', { amount: DOC_COST });
      if (error || !success) {
        alert("Erreur de paiement. Veuillez vérifier votre connexion et votre solde.");
        return false;
      } setUserProfile(prev => prev ? ({ ...prev, app_credits: prev.app_credits - DOC_COST }) : null);
      return true;
    }
    // B. OFFLINE
    else {
      if (!canPerformAction()) {
        alert(`Limite hors ligne atteinte (${offlineCount}/${maxOfflineDocs}).\n\nVeuillez vous connecter.`);
        return false;
      }
      incrementOfflineCount();
      return true;
    }
  };

  const handleAddPayment = async (customerName: string, amount: number) => {
    // 1. PAYMENT / LIMIT CHECK
    const authorized = await processDocumentCost();
    if (!authorized) return;

    const normalizedName = customerName.toUpperCase();
    const date = new Date().toISOString();
    const transactionId = Math.random().toString(36).substr(2, 9);

    // 2. CREATE RECEIPT DOCUMENT (Background)
    const creditRecord = credits.find(c => c.customerName.toUpperCase() === normalizedName);
    const currentSnapshot = creditRecord ? creditRecord.remainingBalance : 0;

    // Description logic
    let desc = 'Versement sur compte client';
    if (creditRecord && creditRecord.remainingBalance < 0) {
      desc = `Versement (Solde: ${formatCurrency(Math.abs(creditRecord.remainingBalance))} F Créditeur)`;
    }

    const receiptDoc: InvoiceData = {
      id: transactionId,
      type: DocumentType.RECEIPT,
      number: `R-${generateInvoiceNumber().split('-')[1]}`,
      date: date,
      customerName: customerName,
      items: [{ id: 'r1', quantity: 1, description: desc, unitPrice: amount }],
      business: businessInfo,
      templateId: templatePreference,
      amountPaid: amount,
      isFinalized: true,
      createdAt: date,
      clientBalanceSnapshot: currentSnapshot - amount // Snapshot AFTER payment
    };

    setHistory(prev => [receiptDoc, ...prev]);

    // 3. UPDATE LEDGER
    setCredits(prev => {
      const existingIdx = prev.findIndex(c => c.customerName.toUpperCase() === normalizedName);

      const moves: CreditHistoryItem[] = [{
        type: 'PAYMENT' as const,
        id: transactionId,
        date: date,
        createdAt: date,
        amount: amount,
        description: desc
      }];

      if (existingIdx !== -1) {
        const existing = prev[existingIdx];
        const updatedList = [...prev];
        updatedList[existingIdx] = {
          ...existing,
          remainingBalance: existing.remainingBalance - amount,
          history: [...moves, ...existing.history]
        };
        return updatedList;
      } else {
        // Safe fallback for new client (rare in this specific path)
        return [{
          id: generateUUID(),
          customerName: normalizedName,
          customerPhone: '',
          totalDebt: 0,
          remainingBalance: -amount, // Negative = Credit
          history: moves
        }, ...prev];
      }
    });

    // 4. FEEDBACK
    setShowSuccessToast(true);
    setTimeout(() => setShowSuccessToast(false), 2000);
  };

  // Modified to just VIEW the receipt (since it's now created at payment time)
  // But strictly speaking, if called with ID, we find it. If not found (legacy?), we creates it? 
  // Let's keep it simple: It tries to find it.
  const handleGenerateReceipt = async (customerName: string, amount: number, date: string, transactionId?: string) => {
    // Try to find by Transaction ID first (best link) or fallback logic
    const existing = history.find(h => h.id === transactionId);

    if (existing) {
      setInvoiceData(existing);
      goToStep(AppStep.PREVIEW);
    } else {
      // Fallback: If for some reason it wasn't created (e.g. legacy data), create it now using the OLD logic?
      // Or just alert? 
      // Let's assume for new flow, it exists.
      alert("Reçu introuvable ou ancien format.");
    }
  };



  const resetInvoice = (navigateToForm = true) => {
    setInvoiceData({
      id: generateUUID(),
      type: DocumentType.INVOICE,
      number: generateInvoiceNumber(),
      date: new Date().toISOString().split('T')[0],
      customerName: '',
      customerPhone: '',
      items: [{ id: generateUUID(), quantity: 1, description: '', unitPrice: 0 }],
      business: businessInfo,
      templateId: templatePreference,
      amountPaid: 0,
      isFinalized: false,
      creditConfirmed: false
    });

    if (navigateToForm) {
      goToStep(AppStep.FORM);
    }
  };

  const handlePrint = async () => {
    if (!invoiceData.isFinalized) {
      await finalizeDocument();
    }
    setTimeout(() => window.print(), 500);
  };

  const handleShareWhatsApp = (targetDoc?: InvoiceData) => {
    const doc = targetDoc || invoiceData;
    const total = doc.items.reduce((acc, item) => acc + (item.quantity * item.unitPrice), 0);
    const amountPaid = doc.amountPaid || 0;

    // Récupérer le solde global actuel du client si dispo
    const customerCredit = credits.find(c => c.customerName.toUpperCase() === doc.customerName.toUpperCase());
    const totalGlobalBalance = customerCredit ? customerCredit.remainingBalance : 0;

    let message = `*✅ ${doc.business.name.toUpperCase()}*\n`;
    message += `*📄 ${doc.type.toUpperCase()} N° :* ${doc.number}\n`;
    message += `*👤 CLIENT :* ${doc.customerName || 'Client Comptant'}\n`;

    if (doc.type === DocumentType.RECEIPT) {
      message += `\n*💰 MONTANT REÇU : ${formatCurrency(amountPaid)} F CFA*\n`;
      message += `_Objet : Versement_\n`;
    } else {
      message += `\n*📦 DÉTAILS :*\n`;
      doc.items.forEach(item => {
        if (item.description) message += `• ${item.quantity}x ${item.description} : ${formatCurrency(item.quantity * item.unitPrice)} F\n`;
      });
      message += `\n*💰 TOTAL : ${formatCurrency(total)} F CFA*`;
      if (amountPaid > 0) message += `\n*💵 PAYÉ : ${formatCurrency(amountPaid)} F*`;
    }

    if (totalGlobalBalance !== 0) {
      if (totalGlobalBalance < 0) {
        message += `\n\n*🟢 SOLDE DISPONIBLE (AVOIR) : ${formatCurrency(Math.abs(totalGlobalBalance))} F CFA*`;
      } else {
        message += `\n\n*🔴 VOTRE DETTE TOTALE : ${formatCurrency(totalGlobalBalance)} F CFA*`;
      }
    }

    message += `\n\n_Merci de votre confiance !_`;
    const encodedMessage = encodeURIComponent(message);
    // Nettoyage basique du numéro
    const phone = doc.customerPhone ? doc.customerPhone.replace(/\s/g, '').replace(/\+/g, '') : '';
    const whatsappUrl = phone ? `https://wa.me/${phone}?text=${encodedMessage}` : `https://wa.me/?text=${encodedMessage}`;

    // PDF Generation
    const invoiceElement = document.getElementById('invoice-preview-container');
    if (invoiceElement) {
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 3000);

      html2canvas(invoiceElement, {
        scale: 1.5,
        useCORS: true,
        windowWidth: 1200,
        backgroundColor: '#ffffff'
      }).then(async canvas => {
        const imgData = canvas.toDataURL('image/jpeg', 0.8);
        const pdf = new jsPDF('p', 'mm', 'a4');

        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();

        const imgProps = pdf.getImageProperties(imgData);
        const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;

        const pageHeight = pdf.internal.pageSize.getHeight();
        let heightLeft = imgHeight;
        let position = 0;

        pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, imgHeight);
        heightLeft -= pageHeight;

        while (heightLeft > 0) {
          position = position - pageHeight;
          pdf.addPage();
          pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, imgHeight);
          heightLeft -= pageHeight;
        }

        const pdfBlob = pdf.output('blob');
        const pdfFile = new File([pdfBlob], `Facture_${doc.number}.pdf`, { type: 'application/pdf' });

        // SYNC: Upload PDF to Cloud Storage
        if (navigator.onLine && session?.user?.id) {
          const safeName = `Facture_${doc.number.replace(/[^a-zA-Z0-9-_]/g, '_')}.pdf`;
          storageService.uploadInvoicePDF(pdfBlob, safeName, session.user.id)
            .then(publicUrl => {
              if (publicUrl) {
                console.log("Cloud Backup: PDF Uploaded", publicUrl);
                return storageService.saveInvoiceToCloud(doc, publicUrl);
              }
            })
            .catch(err => console.warn("PDF Cloud Upload Failed", err));
        }

        if (navigator.share && navigator.canShare({ files: [pdfFile] })) {
          navigator.share({
            files: [pdfFile],
            title: `Facture ${doc.number}`,
            text: message
          }).catch((err) => {
            console.error("Share failed:", err);
            // Fallback if user cancels or error
            pdf.save(`Facture_${doc.number}.pdf`);
            setTimeout(() => window.open(whatsappUrl, '_blank'), 500);
          });
        } else {
          // Fallback for Desktop or unsupported browsers
          pdf.save(`Facture_${doc.number}.pdf`);
          setTimeout(() => {
            window.open(whatsappUrl, '_blank');
            alert("Le PDF a été téléchargé.\n\nVeuillez joindre le fichier 'Facture_" + doc.number + ".pdf' dans la conversation WhatsApp qui va s'ouvrir.");
          }, 1000);
        }
      });
    } else {
      window.open(whatsappUrl, '_blank');
    }
  };


  const handleAddClient = (name: string, phone: string) => {
    const normalizedName = name.trim().toUpperCase();
    setCredits(prev => {
      const exists = prev.find(c => c.customerName.toUpperCase() === normalizedName);
      if (exists) {
        // Optionnel : Mettre à jour le téléphone si vide
        if (!exists.customerPhone && phone) {
          return prev.map(c => c.id === exists.id ? { ...c, customerPhone: phone } : c);
        }
        alert("Ce client existe déjà dans votre répertoire !");
        return prev;
      }
      return [{
        id: Math.random().toString(36).substr(2, 9),
        customerName: normalizedName,
        customerPhone: phone,
        totalDebt: 0,
        remainingBalance: 0,
        history: []
      }, ...prev];
    });
    setShowSuccessToast(true);
    setTimeout(() => setShowSuccessToast(false), 2000);
  };

  const handleUpdateClient = (oldName: string, newName: string, newPhone: string) => {
    // 1. Update History
    setHistory(prev => prev.map(doc => {
      if (doc.customerName.trim().toUpperCase() === oldName.trim().toUpperCase()) {
        return { ...doc, customerName: newName, customerPhone: newPhone };
      }
      return doc;
    }));

    // 2. Update Credits
    setCredits(prev => prev.map(credit => {
      if (credit.customerName.trim().toUpperCase() === oldName.trim().toUpperCase()) {
        return { ...credit, customerName: newName };
      }
      return credit;
    }));

    setShowSuccessToast(true);
    setTimeout(() => setShowSuccessToast(false), 2000);
  };

  const handleAddAppointment = (customerName: string, date: string, note: string, notifyDelay: number) => {
    const newApptId = Math.random().toString(36).substr(2, 9);

    // Schedule Local Notification
    notificationService.scheduleNotification(
      newApptId,
      "Rappel de rendez-vous",
      `Rendez-vous avec ${customerName} dans ${notifyDelay === 60 ? '1 heure' : '15 minutes'}.`,
      date,
      notifyDelay
    );

    setCredits(prev => prev.map(c => {
      if (c.customerName === customerName) {
        return {
          ...c,
          appointments: [
            ...(c.appointments || []),
            {
              id: newApptId,
              date,
              note,
              completed: false
            }
          ]
        };
      }
      return c;
    }));
    setShowSuccessToast(true);
    setTimeout(() => setShowSuccessToast(false), 2000);
  };

  const handleCancelAppointment = (customerName: string, appointmentId: string) => {
    // Cancel Local Notification
    notificationService.cancelNotification(appointmentId);

    // Remove from State
    setCredits(prev => prev.map(c => {
      if (c.customerName === customerName && c.appointments) {
        return {
          ...c,
          appointments: c.appointments.filter(a => a.id !== appointmentId)
        };
      }
      return c;
    }));
    setShowSuccessToast(true);
    setTimeout(() => setShowSuccessToast(false), 2000);
  };


  const handleUpdateAppointment = (customerName: string, appointmentId: string, newDate: string, newNote: string, notifyDelay: number) => {
    // 1. Cancel old notification
    notificationService.cancelNotification(appointmentId);

    // 2. Schedule new notification
    notificationService.scheduleNotification(
      appointmentId,
      "Rappel de rendez-vous (Modifié)",
      `Rendez-vous avec ${customerName} dans ${notifyDelay === 60 ? '1 heure' : '15 minutes'}.`,
      newDate,
      notifyDelay
    );

    // 3. Update State
    setCredits(prev => prev.map(c => {
      if (c.customerName === customerName && c.appointments) {
        return {
          ...c,
          appointments: c.appointments.map(a => a.id === appointmentId ? { ...a, date: newDate, note: newNote } : a)
        };
      }
      return c;
    }));
    setShowSuccessToast(true);
    setTimeout(() => setShowSuccessToast(false), 2000);
  };

  const handleToggleAppointment = (customerName: string, appointmentId: string) => {
    setCredits(prev => prev.map(c => {
      if (c.customerName === customerName && c.appointments) {
        // If marking as completed, cancel notification
        const appt = c.appointments.find(a => a.id === appointmentId);
        if (appt && !appt.completed) {
          notificationService.cancelNotification(appointmentId);
        }

        return {
          ...c,
          appointments: c.appointments.map(a => a.id === appointmentId ? { ...a, completed: !a.completed } : a)
        };
      }
      return c;
    }));
  };

  const handleCancelPayment = (customerName: string, transactionId: string, amount: number) => {
    // 1. Update Credits
    setCredits(prev => prev.map(c => {
      if (c.customerName !== customerName) return c;

      // Check if transaction exists and not already cancelled
      const targetTx = c.history.find(h => h.id === transactionId);
      if (!targetTx || targetTx.status === 'CANCELLED') return c;

      // Mark as cancelled
      const newHistory = c.history.map(h => h.id === transactionId ? { ...h, status: 'CANCELLED' as const } : h);

      // Create Reversal Transaction
      const reversalTx = {
        type: 'PAYMENT' as const,
        id: Math.random().toString(36).substr(2, 9),
        date: new Date().toISOString(),
        amount: -amount, // Negative amount for reversal
        description: `ANNULATION TRANS.`,
        status: undefined
      };

      return {
        ...c,
        remainingBalance: c.remainingBalance + amount, // Add debt back
        history: [reversalTx, ...newHistory]
      };
    }));

    // 2. Generate Cancellation Receipt (Doc)
    const currentCred = credits.find(c => c.customerName === customerName);
    const estimatedNewBalance = (currentCred?.remainingBalance || 0) + amount;

    const reversalDoc: InvoiceData = {
      id: `annul-${transactionId}`,
      type: DocumentType.RECEIPT,
      number: `ANNUL-${generateInvoiceNumber().split('-')[1]}`,
      date: new Date().toISOString(),
      customerName: customerName,
      items: [{
        id: 'rev1',
        quantity: 1,
        description: `ANNULATION VERSEMENT (Ref: ${transactionId.substr(0, 4)}...)`,
        unitPrice: -amount
      }],
      business: businessInfo,
      templateId: templatePreference,
      amountPaid: -amount,
      isFinalized: true,
      clientBalanceSnapshot: estimatedNewBalance
    };

    setHistory(prev => [reversalDoc, ...prev]);
    setInvoiceData(reversalDoc);

    goToStep(AppStep.PREVIEW);
    setShowSuccessToast(true);
    setTimeout(() => setShowSuccessToast(false), 3000);
  };

  const currentCustomerCredit = credits.find(c => c.customerName.toUpperCase() === invoiceData.customerName.toUpperCase());

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        <Loader2 className="animate-spin mr-2" /> Chargement...
      </div>
    );
  }
  if (!session) {
    return <LandingPage onLogin={() => { }} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <input type="file" ref={fileInputRef} onChange={handleScan} accept="image/*,application/pdf" className="hidden" />

      {/* HEADER */}
      <header className="bg-blue-900 text-white px-4 py-3 shadow-xl sticky top-0 z-[60] no-print">
        <div className="max-w-4xl mx-auto flex justify-between items-center">

          {/* LEFT SECTION: NAVIGATION */}
          <div className="flex items-center gap-3">
            {step === AppStep.PREVIEW ? (
              <button
                onClick={() => {
                  if (invoiceData.isFinalized) {
                    // Smart Navigation: Return to origin if possible
                    if (previousStep === AppStep.HISTORY || previousStep === AppStep.CREDIT) {
                      resetInvoice(false); // Don't jump to form
                      goToStep(previousStep);
                    } else {
                      resetInvoice(true); // Default: New Invoice
                    }
                  } else {
                    goToStep(previousStep);
                  }
                }}
                className="bg-red-50 text-red-500 p-2 rounded-xl active:scale-90 font-bold flex items-center gap-2 text-xs border border-red-100"
              >
                <ArrowLeft size={18} /> Fermer
              </button>
            ) : (
              <div className="flex items-center gap-3 w-full overflow-hidden">
                {step !== AppStep.FORM && (
                  <button
                    onClick={() => setStep(previousStep)}
                    className="bg-white/10 p-2 rounded-xl active:scale-90 hover:bg-white/20 transition-all text-white border border-white/20 shrink-0"
                    title="Retour"
                  >
                    <ArrowLeft size={18} />
                  </button>
                )}
                <div className="bg-white/10 p-2 rounded-xl shrink-0"><FileText className="text-blue-300" size={20} /></div>
                <div className="min-w-0 flex-1">
                  <h1 className="text-lg font-black italic leading-none truncate">FactureMan</h1>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-[9px] text-blue-300 font-bold uppercase mt-1 tracking-wider truncate">{getHeaderTitle()}</p>
                    {userProfile && (
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border whitespace-nowrap ${(userProfile.app_credits + walletCredits) > 200 ? 'bg-blue-800 text-blue-200 border-blue-700' : 'bg-red-900 text-red-200 border-red-700 animate-pulse'}`}>
                        {(userProfile.app_credits + walletCredits)} CRÉDITS
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT SECTION: ACTIONS */}
          <div className="flex items-center gap-3">
            {/* SYNC STATUS */}
            <div className={`h-2 w-2 rounded-full transition-all duration-500 ${syncStatus === 'syncing' ? 'bg-blue-400 animate-ping' :
              syncStatus === 'error' ? 'bg-red-500' :
                syncStatus === 'offline' ? 'bg-gray-500' :
                  'bg-green-400'
              }`} title={`Status: ${syncStatus}`} />

            {/* NOTIFICATIONS */}
            <NotificationCenter
              notifications={notifications}
              onMarkAsRead={(id) => setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))}
              onClearAll={() => setNotifications([])}
            />

            <div className="h-6 w-px bg-blue-800 mx-1"></div>

            {step === AppStep.PREVIEW ? (
              <div className="flex gap-2">
                <button onClick={() => setShowConvertMenu(!showConvertMenu)} className={`p-2 rounded-xl transition-all ${showConvertMenu ? 'bg-blue-400 text-white' : 'bg-blue-600/50 text-white active:scale-90'}`} title="Transformer">
                  <CopyPlus size={18} />
                </button>
                {showConvertMenu && (
                  <div className="absolute right-4 top-16 bg-white border border-gray-200 rounded-xl shadow-2xl z-50 p-2 w-48 animate-in zoom-in-95 duration-200 text-left">
                    <div className="flex justify-between items-center px-2 py-1 mb-1 border-b">
                      <span className="text-[8px] font-black uppercase text-gray-400">Transformer en :</span>
                      <button onClick={() => setShowConvertMenu(false)}><X size={12} className="text-black" /></button>
                    </div>
                    {Object.values(DocumentType).filter(t => t !== invoiceData.type).map(type => (
                      <button
                        key={type}
                        onClick={() => handleConvertDocument(invoiceData, type)}
                        className="w-full text-left p-2 hover:bg-blue-50 text-[10px] font-black text-blue-900 rounded-lg flex items-center justify-between border-b border-gray-50 last:border-none"
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                )}
                <button onClick={() => handleShareWhatsApp()} className="bg-[#25D366] p-2 rounded-xl active:scale-90 shadow-lg shadow-green-900/20 text-white"><Share2 size={18} /></button>
                <button onClick={handlePrint} className="bg-white text-blue-900 p-2 rounded-xl active:scale-90 font-bold flex items-center gap-2 text-xs"><Printer size={16} /> <span className="hidden sm:inline">Imprimer</span></button>
              </div>
            ) : (
              /* Default Actions (Install, etc) */
              <>
                {deferredPrompt && (
                  <button onClick={handleInstallApp} className="bg-yellow-400 hover:bg-yellow-300 text-yellow-900 px-3 py-2 rounded-xl font-black flex items-center gap-2 text-[10px] uppercase transition-all active:scale-95 shadow-lg animate-pulse">
                    <Download size={16} /> <span className="hidden sm:inline">Installer</span>
                  </button>
                )}
                {step === AppStep.FORM && (
                  <button onClick={() => goToStep(AppStep.PREVIEW)} className="bg-blue-600 hover:bg-blue-500 px-3 py-2 rounded-xl font-bold flex items-center gap-2 text-[10px] uppercase transition-all active:scale-95 shadow-lg border border-blue-500"><Eye size={16} /> Aperçu</button>
                )}
              </>
            )}
          </div>
        </div>
      </header>



      {/* REMINDER MODAL */}
      {showReminderModal && (
        <div className="fixed inset-0 z-[250] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="bg-gradient-to-br from-red-600 to-orange-600 p-6 text-white flex justify-between items-center">
              <h3 className="text-lg font-black uppercase flex items-center gap-2">
                <Bell size={20} className="animate-bounce" /> Rappels ({dueReminders.length})
              </h3>
              <button onClick={() => setShowReminderModal(false)} className="bg-white/20 p-2 rounded-full hover:bg-white/30"><X size={20} /></button>
            </div>
            <div className="p-4 max-h-[60vh] overflow-y-auto space-y-3 bg-gray-50/50">
              {dueReminders.length > 0 ? (
                dueReminders.map(rem => (
                  <div key={rem.id} className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm relative overflow-hidden">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[10px] font-black uppercase bg-red-100 text-red-600 px-2 py-1 rounded-lg">
                        {new Date(rem.date).toLocaleString()}
                      </span>
                      <button
                        onClick={() => handleDismissReminder(rem.id, rem.clientName)}
                        className="text-gray-400 hover:text-green-600 transition-colors"
                        title="Marquer comme fait"
                      >
                        <CheckCircle2 size={24} />
                      </button>
                    </div>
                    <h4 className="font-black text-gray-900 uppercase text-sm mb-1">{rem.clientName}</h4>
                    {rem.note && <p className="text-xs text-gray-600 italic bg-gray-50 p-2 rounded-lg border border-gray-100">{rem.note}</p>}
                  </div>
                ))
              ) : (
                <div className="text-center py-10 opacity-40">
                  <p className="font-bold text-gray-400 text-xs uppercase">Aucun rappel en attente</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MAIN CONTENT */}
      <main className="flex-grow p-4 md:p-6 max-w-4xl mx-auto w-full pb-24">
        {isScanning && <div className="fixed inset-0 bg-blue-950/80 backdrop-blur-md z-[100] flex flex-col items-center justify-center text-white"><Loader2 size={64} className="animate-spin text-blue-400 mb-6" /><h3 className="text-2xl font-black uppercase tracking-widest">Analyse IA...</h3></div>}
        {showSuccessToast && <div className="fixed top-24 left-1/2 -translate-x-1/2 bg-green-600 text-white px-6 py-3 rounded-2xl shadow-2xl z-[200] flex items-center gap-3 animate-in slide-in-from-top duration-300 pointer-events-none"><CheckCircle2 size={24} /><span className="font-bold">Opération réussie !</span></div>}

        {step === AppStep.FORM && (
          <InvoiceForm
            data={invoiceData}
            products={products}
            customerBalance={currentCustomerCredit?.remainingBalance}
            existingClients={allUniqueClients}
            onChange={setInvoiceData}
            onScanClick={() => fileInputRef.current?.click()}
            onQuickSaveProduct={handleQuickSaveProduct}
            onValidateCredit={handleValidateCredit}
            onPayCash={handleInstantCash}
            onSaveDoc={handleSimpleSave}
            onClearAll={() => resetInvoice()}
          />
        )}

        {step === AppStep.STOCK && <StockManager products={products} onUpdateProducts={setProducts} />}

        {step === AppStep.HISTORY && (
          <HistoryManager
            history={history}
            onView={(doc) => { setInvoiceData(doc); goToStep(AppStep.PREVIEW); }}
            onDelete={(id) => setHistory(h => h.filter(i => i.id !== id))}
            onShare={handleShareWhatsApp}
            onConvert={handleConvertDocument}
          />
        )}

        {/* ... inside render */}
        {step === AppStep.PROFILE && (
          <ProfileSettings
            business={businessInfo}
            templateId={templatePreference}
            history={history}
            credits={credits}
            userProfile={userProfile}
            creditsCount={(userProfile?.app_credits || 0) + walletCredits}
            onUpdateBusiness={setBusinessInfo}
            onUpdateTemplate={setTemplatePreference}
            onUpdateClient={handleUpdateClient}
            onAddClient={handleAddClient}
            onPreviewDoc={(doc) => {
              setInvoiceData(doc);
              goToStep(AppStep.PREVIEW);
            }}
            onLogout={async () => {
              await supabase.auth.signOut();
              setSession(null);
              setUserProfile(null);
            }}
            onSync={async () => {
              if (!session?.user?.id) return;
              setSyncStatus('syncing');

              try {
                const cloudData = await dataSyncService.fetchUserData(session.user.id);
                if (cloudData) {
                  const mergeArrays = <T extends { id: string }>(local: T[], cloud: T[]): T[] => {
                    const map = new Map<string, T>();
                    cloud.forEach(item => map.set(item.id, item));
                    local.forEach(item => map.set(item.id, item)); // Retain local edits if conflict? actually for restore we might want cloud first if local is cleared? 
                    // Wait, if local is empty because user cleared data, map will just be cloud data. Correct.
                    return Array.from(map.values());
                  };

                  setProducts(prev => mergeArrays(prev, cloudData.products));
                  setHistory(prev => mergeArrays(prev, cloudData.history));
                  setCredits(prev => mergeArrays(prev, cloudData.credits));
                  if (cloudData.businessInfo) setBusinessInfo(cloudData.businessInfo);

                  setSyncStatus('success');
                  setShowSuccessToast(true);
                  setTimeout(() => setSyncStatus('idle'), 3000);
                  setTimeout(() => setShowSuccessToast(false), 3000);
                } else {
                  setSyncStatus('error');
                }
              } catch (e) {
                console.error(e);
                setSyncStatus('error');
              }
            }}
          />
        )}

        {step === AppStep.CREDIT && (
          <CreditManager
            credits={credits}
            onAddPayment={handleAddPayment}
            onGenerateReceipt={handleGenerateReceipt}
            onAddAppointment={handleAddAppointment}
            onUpdateAppointment={handleUpdateAppointment}
            onToggleAppointment={handleToggleAppointment}
            onCancelAppointment={handleCancelAppointment}
            onCancelPayment={handleCancelPayment}
            onUpdateBalance={(customerName, newBalance, reason) => {
              setCredits(prev => {
                const updated = [...prev];
                const index = updated.findIndex(c => c.customerName.toUpperCase() === customerName.toUpperCase());
                if (index !== -1) {
                  const oldBalance = updated[index].remainingBalance;
                  const diff = newBalance - oldBalance;
                  const isDebtIncrease = diff > 0;

                  updated[index] = {
                    ...updated[index],
                    remainingBalance: newBalance,
                    history: [{
                      type: isDebtIncrease ? 'INVOICE' : 'PAYMENT',
                      id: generateUUID(),
                      date: new Date().toISOString(),
                      amount: Math.abs(diff),
                      description: reason // Reason already contains "Nouvelle Dette" or "Nouvel Avoir"
                    }, ...updated[index].history]
                  };
                } else {
                  // Create new client record (Import/Archive)
                  updated.unshift({
                    id: generateUUID(),
                    customerName: customerName,
                    customerPhone: '',
                    totalDebt: newBalance > 0 ? newBalance : 0,
                    remainingBalance: newBalance,
                    history: [{
                      type: newBalance > 0 ? 'INVOICE' : 'PAYMENT',
                      id: generateUUID(),
                      date: new Date().toISOString(),
                      amount: Math.abs(newBalance),
                      description: `SOLDE INITIAL: ${reason}`
                    }]
                  });
                }
                return updated;
              });
            }}
          />
        )}

        {step === AppStep.PREVIEW && (
          <div className="animate-in zoom-in-95 duration-300">
            <div id="invoice-preview-container">
              <InvoicePreview
                data={invoiceData}
                remainingBalance={!invoiceData.isFinalized ? currentCustomerCredit?.remainingBalance : undefined}
              />
            </div>

            <div className="mt-8 no-print max-w-2xl mx-auto space-y-4 mb-8">
              {!invoiceData.isFinalized ? (
                <>
                  {isCreditPending && (
                    <div className="bg-orange-50 border-2 border-orange-200 p-4 rounded-2xl flex items-center gap-3 text-orange-800 animate-pulse">
                      <AlertTriangle size={24} className="text-orange-500 shrink-0" />
                      <p className="text-xs font-bold leading-tight uppercase">Attention : Le crédit de {formatCurrency(currentBalance)} F doit être validé pour le suivi. <button onClick={() => goToStep(AppStep.FORM)} className="underline font-black">Retourner valider</button></p>
                    </div>
                  )}
                  <button
                    disabled={isCreditPending}
                    onClick={() => finalizeDocument()}
                    className={`w-full py-5 rounded-2xl font-black uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 active:scale-95 transition-all ${isCreditPending ? 'bg-gray-300 text-gray-500 cursor-not-allowed shadow-none' : (invoiceData.type === DocumentType.RECEIPT ? 'bg-emerald-600 text-white' : 'bg-blue-600 text-white shadow-blue-200')}`}
                  >
                    <Check size={28} strokeWidth={3} /> {invoiceData.type === DocumentType.RECEIPT ? 'Valider le Versement' : 'Valider & Enregistrer'}
                  </button>
                </>
              ) : (
                <button onClick={() => resetInvoice()} className="w-full bg-white text-gray-900 py-4 rounded-2xl font-black uppercase border-2 border-gray-200 shadow-sm flex items-center justify-center gap-3 active:scale-95 hover:bg-gray-50 transition-colors">
                  <Plus size={24} /> Nouvelle Facture / Opération
                </button>
              )}
            </div>
          </div>
        )}
      </main>

      {/* PASSWORD RESET MODAL */}
      {showPasswordResetModal && (
        <ChangePasswordModal onClose={() => setShowPasswordResetModal(false)} />
      )}

      {/* HIDDEN FILE INPUT FOR SCANNER */}
      <input
        type="file"
        ref={fileInputRef}
        hidden
        className="hidden"
        accept="image/*,application/pdf"
        onChange={handleScan}
      />

      {/* EXIT CONFIRMATION TOAST */}
      {showExitToast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-6 py-3 rounded-full shadow-2xl z-[60] text-sm font-bold animate-in fade-in slide-in-from-bottom-4 pointer-events-none">
          Appuyez encore pour quitter
        </div>
      )}

      {/* BOTTOM NAV (Masqué en mode Preview pour focus) */}
      {step !== AppStep.PREVIEW && (
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-center z-50 no-print shadow-[0_-4px_20px_rgba(0,0,0,0.05)] safe-area-pb">
          <div className="w-full max-w-4xl px-6 py-2 flex justify-between items-center">
            <button onClick={() => goToStep(AppStep.CREDIT)} className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${step === AppStep.CREDIT ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}><Wallet size={20} /><span className="text-[8px] font-black uppercase tracking-widest">GESTION</span></button>
            <button onClick={() => goToStep(AppStep.HISTORY)} className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${step === AppStep.HISTORY ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}><Clock size={20} /><span className="text-[8px] font-black uppercase tracking-widest">Historique</span></button>
            <button onClick={() => goToStep(AppStep.FORM)} onDoubleClick={() => resetInvoice()} className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${step === AppStep.FORM ? 'bg-blue-600 text-white shadow-lg -translate-y-2 scale-110' : 'text-gray-400 hover:text-gray-600'}`}><LayoutDashboard size={20} /><span className="text-[8px] font-black uppercase tracking-widest">Saisie</span></button>
            <button onClick={() => goToStep(AppStep.STOCK)} className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${step === AppStep.STOCK ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}><Package size={20} /><span className="text-[8px] font-black uppercase tracking-widest">Stock</span></button>
            <button onClick={() => goToStep(AppStep.PROFILE)} className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${step === AppStep.PROFILE ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}><UserCircle size={20} /><span className="text-[8px] font-black uppercase tracking-widest">Profil</span></button>
          </div>
        </nav>
      )}
    </div>
  );
};

export default App;
