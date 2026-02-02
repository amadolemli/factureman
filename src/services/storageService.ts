import { supabase } from './supabaseClient';
import { InvoiceData } from '../types';

export const storageService = {

    /**
     * Uploads a PDF blob to Supabase Storage
     * @param blob The PDF file/blob
     * @param fileName The desired filename (e.g. "invoice_123.pdf")
     * @returns The public URL of the uploaded file
     */
    async uploadInvoicePDF(blob: Blob, fileName: string): Promise<string | null> {
        try {
            const user = (await supabase.auth.getUser()).data.user;
            if (!user) return null;

            const filePath = `${user.id}/${fileName}`;

            const { data, error } = await supabase.storage
                .from('invoices')
                .upload(filePath, blob, {
                    contentType: 'application/pdf',
                    upsert: true
                });

            if (error) {
                console.error('Error uploading PDF:', error);
                return null;
            }

            const { data: { publicUrl } } = supabase.storage
                .from('invoices')
                .getPublicUrl(filePath);

            return publicUrl;
        } catch (err) {
            console.error('Upload exception:', err);
            return null;
        }
    },

    /**
     * Saves the Invoice Metadata (JSON) and PDF URL to the Database
     */
    async saveInvoiceToCloud(invoice: InvoiceData, pdfUrl?: string) {
        try {
            const user = (await supabase.auth.getUser()).data.user;
            if (!user) return false;

            // Prepare the payload for the 'invoices' table
            const payload = {
                id: invoice.id,
                user_id: user.id,
                number: invoice.number,
                type: invoice.type,
                date: invoice.date, // Ensure YYYY-MM-DD or ISO
                customer_name: invoice.customerName,
                customer_phone: invoice.customerPhone,
                total_amount: invoice.items.reduce((acc, item) => acc + (item.quantity * item.unitPrice), 0),
                amount_paid: invoice.amountPaid || 0,
                status: invoice.isFinalized ? 'PAID' : 'DRAFT',
                content: invoice, // Store full JSON
                pdf_url: pdfUrl || null
            };

            const { error } = await supabase
                .from('invoices')
                .upsert(payload);

            if (error) {
                console.error('Error saving invoice metadata:', error);
                return false;
            }

            return true;
        } catch (err) {
            console.error('Save Metadata exception:', err);
            return false;
        }
    }
};
