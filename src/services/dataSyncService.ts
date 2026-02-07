import { supabase } from './supabaseClient';
import { storageService } from './storageService';
import { Product, InvoiceData, CreditRecord, BusinessInfo } from '../types';

export const dataSyncService = {

    // --- FETCH ALL DATA ---
    async fetchUserData(userId: string) {
        if (!userId) return null;

        try {
            // 1. Fetch Profile First (Needed for fallbacks)
            const { data: profileData, error: profileError } = await supabase.from('profiles').select('*').eq('id', userId).single();
            if (profileError) console.warn('Profile fetch warning:', profileError);

            const businessFallback = profileData?.business_info || { name: 'VOTRE ENTREPRISE', specialty: '', address: '', phone: '', city: '' };

            // 2. Fetch Lists in Parallel (Settled = don't fail all if one fails)
            const results = await Promise.allSettled([
                supabase.from('products').select('*').eq('user_id', userId),
                supabase.from('invoices').select('*').eq('user_id', userId), // Order might matter if relying heavily on sorting, but usually ok
                supabase.from('clients').select('*').eq('user_id', userId)
            ]);

            const productsRes = results[0].status === 'fulfilled' ? results[0].value : { data: [], error: results[0].reason };
            const invoicesRes = results[1].status === 'fulfilled' ? results[1].value : { data: [], error: results[1].reason };
            const clientsRes = results[2].status === 'fulfilled' ? results[2].value : { data: [], error: results[2].reason };

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
            const history: InvoiceData[] = (invoicesRes.data || []).map(inv => {
                const content = inv.content || {}; // Safety check

                // HYBRID RECOVERY STRATEGY:
                // 1. Try to get Business Snapshot from 'content' (New Data)
                // 2. If missing, use current User Profile Business Info (Legacy Data Fallback)
                const businessInfo = (content.business && content.business.name)
                    ? content.business
                    : businessFallback;

                return {
                    id: inv.id,
                    type: inv.type as any,
                    number: inv.number,
                    date: inv.date,
                    customerName: inv.customer_name,
                    customerPhone: inv.customer_phone,
                    business: businessInfo,
                    items: content.items || [], // Items were always saved in content
                    templateId: content.templateId || 'classic',
                    amountPaid: inv.amount_paid,
                    isFinalized: true,
                    creditConfirmed: inv.status === 'CONFIRMED',
                    clientBalanceSnapshot: content.clientBalanceSnapshot,
                    createdAt: content.createdAt || inv.created_at, // Fallback to DB timestamp if avail
                    pdfUrl: inv.pdf_url // MAP FROM DB COLUMN
                };
            });

            // Credits (Clients)
            const credits: CreditRecord[] = (clientsRes.data || []).map(c => ({
                id: c.id,
                customerName: c.name,
                customerPhone: c.phone || '',
                totalDebt: c.total_debt,
                remainingBalance: c.remaining_balance ?? c.total_debt,
                history: c.history || [],
                appointments: c.appointments || []
            }));

            return { products, history, credits, businessInfo: profileData?.business_info || null };

        } catch (error) {
            console.error("Sync Critical Failure:", error);
            // Even if critical fail, return empty structure to avoid app crash, 
            // but maybe return null to indicate 'Sync Failed' to UI?
            // Returning null allows the caller to know it failed.
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
        const dbInvoices = invoices.map(inv => this.mapInvoiceToDb(inv, userId));
        const { error } = await supabase.from('invoices').upsert(dbInvoices);
        if (error) console.error('Error saving invoices:', error);
    },

    async saveSingleInvoice(invoice: InvoiceData, userId: string) {
        if (!userId) return;
        const dbInvoice = this.mapInvoiceToDb(invoice, userId);
        const { error } = await supabase.from('invoices').upsert(dbInvoice);
        if (error) console.error('Error saving single invoice:', error);
        return !error;
    },

    mapInvoiceToDb(inv: InvoiceData, userId: string) {
        // Clean content to remove base64 heavy strings
        const cleanContent = { ...inv };
        if (cleanContent.business) {
            cleanContent.business = storageService.cleanBusinessData(cleanContent.business);
        }
        return {
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
            content: cleanContent, // SAVE Cleaned OBJECT
            pdf_url: inv.pdfUrl || null // Sync the PDF URL column
        };
    },

    async saveCreditRecords(credits: CreditRecord[], userId: string) {
        if (!userId || credits.length === 0) return;
        const dbClients = credits.map(c => this.mapClientToDb(c, userId));
        const { error } = await supabase.from('clients').upsert(dbClients);
        if (error) console.error('Error saving clients:', error);
    },

    async saveSingleClient(client: CreditRecord, userId: string) {
        if (!userId) return;
        const dbClient = this.mapClientToDb(client, userId);
        const { error } = await supabase.from('clients').upsert(dbClient);
        if (error) console.error('Error saving single client:', error);
        return !error;
    },

    mapClientToDb(c: CreditRecord, userId: string) {
        return {
            id: c.id,
            user_id: userId,
            name: c.customerName,
            phone: c.customerPhone,
            total_debt: c.totalDebt,
            remaining_balance: c.remainingBalance,
            history: c.history,
            appointments: c.appointments
        };
    },

    async saveBusinessInfo(info: BusinessInfo, userId: string) {
        if (!userId) return;

        // Clean business info (remove base64)
        const cleanInfo = storageService.cleanBusinessData(info);

        const { error } = await supabase.from('profiles').upsert({
            id: userId,
            business_name: cleanInfo.name,
            business_info: cleanInfo,
            // Sync specific columns for easier access/backup
            header_image_url: cleanInfo.customHeaderImage,
            signature_url: cleanInfo.signatureUrl
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
