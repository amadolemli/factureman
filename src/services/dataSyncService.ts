import { supabase } from './supabaseClient';
import { Product, InvoiceData, CreditRecord, BusinessInfo } from '../types';

export const dataSyncService = {

    // --- FETCH ALL DATA ---
    async fetchUserData(userId: string) {
        if (!userId) return null;

        try {
            const [productsRes, invoicesRes, clientsRes, profileRes] = await Promise.all([
                supabase.from('products').select('*').eq('user_id', userId),
                supabase.from('invoices').select('*').eq('user_id', userId),
                supabase.from('clients').select('*').eq('user_id', userId),
                supabase.from('profiles').select('*').eq('id', userId).single()
            ]);

            if (productsRes.error) console.error('Error fetching products:', productsRes.error);
            if (invoicesRes.error) console.error('Error fetching invoices:', invoicesRes.error);
            if (clientsRes.error) console.error('Error fetching clients:', clientsRes.error);

            // --- MAP DB TO APP TYPES ---

            // Products
            const products: Product[] = (productsRes.data || []).map(p => ({
                id: p.id,
                name: p.name,
                defaultPrice: p.price,
                stock: p.stock,
                category: p.category
            }));

            // Invoices
            const history: InvoiceData[] = (invoicesRes.data || []).map(inv => ({
                id: inv.id,
                type: inv.type as any,
                number: inv.number,
                date: inv.date,
                customerName: inv.customer_name,
                customerPhone: inv.customer_phone,
                business: { name: '', specialty: '', address: '', phone: '', city: '' }, // Placeholder, will rely on profile or snapshot if stored
                items: inv.content?.items || [],
                templateId: inv.content?.templateId || 'classic',
                amountPaid: inv.amount_paid,
                isFinalized: true, // History items are always finalized
                creditConfirmed: inv.status === 'CONFIRMED'
            }));

            // Credits (Clients)
            const credits: CreditRecord[] = (clientsRes.data || []).map(c => ({
                id: c.id,
                customerName: c.name,
                customerPhone: c.phone || '',
                totalDebt: c.total_debt,
                remainingBalance: c.total_debt, // Simplified for now
                history: c.history || []
            }));

            // Business Info
            let businessInfo: BusinessInfo | null = null;
            if (profileRes.data && profileRes.data.business_info) {
                businessInfo = profileRes.data.business_info;
            }

            return { products, history, credits, businessInfo };

        } catch (error) {
            console.error("Sync Error:", error);
            return null;
        }
    },

    // --- SYNC INDIVIDUAL ITEMS (PUSH) ---

    // --- BULK SYNC (PUSH ARRAYS) ---

    async saveProducts(products: Product[], userId: string) {
        if (!userId || products.length === 0) return;
        const dbProducts = products.map(p => ({
            id: p.id,
            user_id: userId,
            name: p.name,
            price: p.defaultPrice,
            stock: p.stock,
            category: p.category
        }));
        const { error } = await supabase.from('products').upsert(dbProducts);
        if (error) console.error('Error saving products:', error);
    },

    async saveInvoices(invoices: InvoiceData[], userId: string) {
        if (!userId || invoices.length === 0) return;
        const dbInvoices = invoices.map(inv => ({
            id: inv.id,
            user_id: userId,
            number: inv.number,
            type: inv.type,
            date: inv.date,
            customer_name: inv.customerName,
            customer_phone: inv.customerPhone,
            total_amount: inv.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0),
            amount_paid: inv.amountPaid,
            status: inv.creditConfirmed ? 'CONFIRMED' : 'PENDING',
            content: { items: inv.items, templateId: inv.templateId }
        }));
        const { error } = await supabase.from('invoices').upsert(dbInvoices);
        if (error) console.error('Error saving invoices:', error);
    },

    async saveCreditRecords(credits: CreditRecord[], userId: string) {
        if (!userId || credits.length === 0) return;
        const dbClients = credits.map(c => ({
            id: c.id,
            user_id: userId,
            name: c.customerName,
            phone: c.customerPhone,
            total_debt: c.totalDebt,
            history: c.history
        }));
        const { error } = await supabase.from('clients').upsert(dbClients);
        if (error) console.error('Error saving clients:', error);
    },

    async saveBusinessInfo(info: BusinessInfo, userId: string) {
        if (!userId) return;
        const { error } = await supabase.from('profiles').upsert({
            id: userId,
            business_name: info.name,
            business_info: info
        });
        if (error) console.error('Error saving profile:', error);
    },

    // --- AUTO SYNC ---
    async syncAll(userId: string, data: {
        products: Product[],
        invoices: InvoiceData[],
        credits: CreditRecord[],
        businessInfo: BusinessInfo
    }) {
        if (!navigator.onLine) {
            return { success: false, reason: 'offline' };
        }

        if (!userId) return { success: false, reason: 'no-user' };

        try {
            console.log("Starting Auto-Sync...");
            await Promise.all([
                this.saveProducts(data.products, userId),
                this.saveInvoices(data.invoices, userId),
                this.saveCreditRecords(data.credits, userId),
                this.saveBusinessInfo(data.businessInfo, userId)
            ]);
            console.log("Auto-Sync Completed.");
            return { success: true, timestamp: Date.now() };
        } catch (error) {
            console.error("Auto-Sync Failed:", error);
            return { success: false, reason: 'error' };
        }
    }
};
