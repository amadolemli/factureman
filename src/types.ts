
export interface UserProfile {
  id: string;
  business_name?: string;
  app_credits: number;
  referral_code?: string;
  is_admin: boolean;
  is_super_admin?: boolean;
  is_banned?: boolean;
}

export enum DocumentType {
  INVOICE = 'Facture',
  DELIVERY_NOTE = 'Bon de Livraison',
  PURCHASE_ORDER = 'Bon de Commande',
  PROFORMA = 'Facture Proforma',
  QUOTE = 'Devis',
  RECEIPT = 'Reçu de Versement'
}

export interface BusinessInfo {
  name: string;
  specialty: string;
  address: string;
  phone: string;
  city: string;
  logo?: string;
  customHeaderImage?: string;
  nif?: string;
  rccm?: string;
  signatureUrl?: string; // Digital Signature URL from Storage
}

export interface Product {
  id: string;
  name: string;
  defaultPrice: number;
  stock: number;
  category?: string;
  deletedAt?: string;
}

export interface InvoiceItem {
  id: string;
  quantity: number;
  description: string;
  unitPrice: number;
}

export interface CreditRecord {
  id: string;
  customerName: string;
  customerPhone?: string;
  totalDebt: number;
  remainingBalance: number;
  history: CreditHistoryItem[];
  appointments?: {
    id: string;
    date: string; // ISO string
    note: string;
    completed: boolean;
  }[];
}

export interface CreditHistoryItem {
  type: 'INVOICE' | 'PAYMENT';
  id: string;
  date: string;
  createdAt?: string;
  amount: number;
  description: string;
  status?: 'CANCELLED';
}

export interface Reminder {
  id: string;
  clientId: string;
  clientName: string;
  date: string;
  note: string;
  completed: boolean;
}

export interface InvoiceData {
  id: string;
  type: DocumentType;
  number: string;
  date: string;
  customerName: string;
  customerPhone?: string;
  items: InvoiceItem[];
  business: BusinessInfo;
  templateId: 'classic' | 'modern' | 'elegant';
  amountPaid: number;
  isFinalized?: boolean;
  creditConfirmed?: boolean;
  clientBalanceSnapshot?: number;
  createdAt?: string; // ISO String timestamp of creation
  pdfUrl?: string; // NEW: Cloud Storage URL for the generated PDF
  deletedAt?: string; // NEW: Soft Delete Timestamp
}

export enum AppStep {
  FORM = 'FORM',
  PREVIEW = 'PREVIEW',
  STOCK = 'STOCK',
  HISTORY = 'HISTORY',
  PROFILE = 'PROFILE',
  CREDIT = 'CREDIT'
}
