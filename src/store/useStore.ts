import { create } from 'zustand';
import { UserProfile, InvoiceData, Product, CreditRecord } from '../types';

interface AppState {
    user: UserProfile | null;
    credits: number;
    products: Product[];
    invoices: InvoiceData[];
    clients: CreditRecord[];

    // Actions
    setCredits: (amount: number | ((prev: number) => number)) => void;
    setUser: (user: UserProfile | null) => void;
    setProducts: (products: Product[]) => void;
    addProduct: (product: Product) => void;
    updateProduct: (id: string, updates: Partial<Product>) => void;
    setInvoices: (invoices: InvoiceData[]) => void;
    addInvoice: (invoice: InvoiceData) => void;
    setClients: (clients: CreditRecord[]) => void;
    updateClient: (id: string, updates: Partial<CreditRecord>) => void;
}

export const useStore = create<AppState>((set) => ({
    user: null,
    credits: 0,
    products: [],
    invoices: [],
    clients: [],

    setCredits: (amount) => set((state) => {
        const newAmount = typeof amount === 'function' ? amount(state.credits) : amount;
        return { credits: newAmount };
    }),
    setUser: (user) => set({ user }),
    setProducts: (products) => set({ products }),
    addProduct: (product) => set((state) => ({ products: [...state.products, product] })),
    updateProduct: (id, updates) => set((state) => ({
        products: state.products.map(p => p.id === id ? { ...p, ...updates } : p)
    })),
    setInvoices: (invoices) => set({ invoices }),
    addInvoice: (invoice) => set((state) => ({ invoices: [...state.invoices, invoice] })),
    setClients: (clients) => set({ clients }),
    updateClient: (id, updates) => set((state) => ({
        clients: state.clients.map(c => c.id === id ? { ...c, ...updates } : c)
    })),
}));
