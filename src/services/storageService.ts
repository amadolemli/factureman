import { supabase } from './supabaseClient';
import { InvoiceData } from '../types';

/**
 * Service de stockage amélioré pour Supabase Storage
 * Gère les uploads d'images, PDFs et autres fichiers
 */
export const storageServiceV2 = {

    /**
     * Upload une image d'entête personnalisé
     * @param file Fichier image ou Blob
     * @param userId ID de l'utilisateur
     * @returns URL publique de l'image ou null
     */
    async uploadHeaderImage(file: File | Blob, userId: string): Promise<string | null> {
        try {
            const timestamp = Date.now();
            const extension = file instanceof File ? file.name.split('.').pop() : 'jpg';
            const fileName = `headers/header_${timestamp}.${extension}`;
            const filePath = `${userId}/${fileName}`;

            // Upload vers le bucket user-assets
            const { error: uploadError } = await supabase.storage
                .from('user-assets')
                .upload(filePath, file, {
                    contentType: file.type || 'image/jpeg',
                    upsert: true,
                    cacheControl: '3600' // Cache 1 heure
                });

            if (uploadError) {
                console.error('Error uploading header image:', uploadError);
                return null;
            }

            // Récupérer l'URL publique
            const { data } = supabase.storage
                .from('user-assets')
                .getPublicUrl(filePath);

            return data.publicUrl;
        } catch (err) {
            console.error('Upload header exception:', err);
            return null;
        }
    },

    /**
     * Upload une signature digitale
     * @param dataUrl Data URL de la signature (canvas.toDataURL)
     * @param userId ID de l'utilisateur
     * @returns URL publique de la signature ou null
     */
    async uploadSignature(dataUrl: string, userId: string): Promise<string | null> {
        console.log('🔍 [SIGNATURE UPLOAD] Starting upload for user:', userId);
        try {
            // Convertir data URL en Blob
            console.log('📦 [SIGNATURE UPLOAD] Converting data URL to blob...');
            const response = await fetch(dataUrl);
            const blob = await response.blob();
            console.log('✅ [SIGNATURE UPLOAD] Blob created:', blob.size, 'bytes, type:', blob.type);

            const timestamp = Date.now();
            const fileName = `signatures/signature_${timestamp}.png`;
            const filePath = `${userId}/${fileName}`;
            console.log('📁 [SIGNATURE UPLOAD] Upload path:', filePath);

            console.log('☁️ [SIGNATURE UPLOAD] Uploading to Supabase storage...');
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('user-assets')
                .upload(filePath, blob, {
                    contentType: 'image/png',
                    upsert: true,
                    cacheControl: '3600'
                });

            if (uploadError) {
                console.error('❌ [SIGNATURE UPLOAD] Error uploading signature:', uploadError);
                console.error('❌ [SIGNATURE UPLOAD] Error details:', {
                    message: uploadError.message,
                    statusCode: uploadError.statusCode,
                    error: uploadError
                });
                return null;
            }

            console.log('✅ [SIGNATURE UPLOAD] Upload successful!', uploadData);

            const { data } = supabase.storage
                .from('user-assets')
                .getPublicUrl(filePath);

            console.log('🔗 [SIGNATURE UPLOAD] Public URL generated:', data.publicUrl);
            return data.publicUrl;
        } catch (err) {
            console.error('💥 [SIGNATURE UPLOAD] Exception:', err);
            if (err instanceof Error) {
                console.error('💥 [SIGNATURE UPLOAD] Error message:', err.message);
                console.error('💥 [SIGNATURE UPLOAD] Error stack:', err.stack);
            }
            return null;
        }
    },

    /**
     * Upload une photo de produit (futur)
     * @param file Fichier image
     * @param userId ID de l'utilisateur
     * @param productId ID du produit
     * @returns URL publique de l'image ou null
     */
    async uploadProductImage(file: File | Blob, userId: string, productId: string): Promise<string | null> {
        try {
            const timestamp = Date.now();
            const extension = file instanceof File ? file.name.split('.').pop() : 'jpg';
            const fileName = `products/product_${productId}_${timestamp}.${extension}`;
            const filePath = `${userId}/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('user-assets')
                .upload(filePath, file, {
                    contentType: file.type || 'image/jpeg',
                    upsert: true,
                    cacheControl: '3600'
                });

            if (uploadError) {
                console.error('Error uploading product image:', uploadError);
                return null;
            }

            const { data } = supabase.storage
                .from('user-assets')
                .getPublicUrl(filePath);

            return data.publicUrl;
        } catch (err) {
            console.error('Upload product image exception:', err);
            return null;
        }
    },

    /**
     * Upload un PDF de facture
     * @param blob PDF blob
     * @param fileName Nom du fichier (ex: "FAC-2024-001.pdf")
     * @param userId ID de l'utilisateur
     * @returns URL publique du PDF ou null
     */
    async uploadInvoicePDF(blob: Blob, fileName: string, userId: string): Promise<string | null> {
        try {
            const filePath = `${userId}/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('invoices')
                .upload(filePath, blob, {
                    contentType: 'application/pdf',
                    upsert: true,
                    cacheControl: '86400' // Cache 24 heures
                });

            if (uploadError) {
                console.error('Error uploading PDF:', uploadError);
                return null;
            }

            const { data } = supabase.storage
                .from('invoices')
                .getPublicUrl(filePath);

            return data.publicUrl;
        } catch (err) {
            console.error('Upload PDF exception:', err);
            return null;
        }
    },

    /**
     * Supprime un fichier du storage
     * @param bucket Nom du bucket ('user-assets' ou 'invoices')
     * @param filePath Chemin du fichier (ex: "user_id/headers/header_123.jpg")
     * @returns True si succès, false sinon
     */
    async deleteFile(bucket: 'user-assets' | 'invoices', filePath: string): Promise<boolean> {
        try {
            const { error } = await supabase.storage
                .from(bucket)
                .remove([filePath]);

            if (error) {
                console.error('Error deleting file:', error);
                return false;
            }

            return true;
        } catch (err) {
            console.error('Delete file exception:', err);
            return false;
        }
    },

    /**
     * Convertit un base64 en Blob
     * @param base64 Data URL en base64
     * @returns Blob
     */
    base64ToBlob(base64: string): Blob | null {
        try {
            const parts = base64.split(';base64,');
            if (parts.length !== 2) return null;

            const contentType = parts[0].split(':')[1];
            const raw = window.atob(parts[1]);
            const rawLength = raw.length;
            const uInt8Array = new Uint8Array(rawLength);

            for (let i = 0; i < rawLength; ++i) {
                uInt8Array[i] = raw.charCodeAt(i);
            }

            return new Blob([uInt8Array], { type: contentType });
        } catch (err) {
            console.error('Error converting base64 to blob:', err);
            return null;
        }
    },

    /**
     * Vérifie si une URL est un data URL (base64)
     * @param url URL à vérifier
     * @returns True si c'est un data URL
     */
    isDataUrl(url: string): boolean {
        return Boolean(url && url.startsWith('data:'));
    },

    /**
     * Vérifie si une URL pointe vers Supabase Storage
     * @param url URL à vérifier
     * @returns True si c'est une URL Supabase Storage
     */
    isStorageUrl(url: string): boolean {
        return Boolean(url && url.includes('supabase.co/storage'));
    },

    /**
     * Nettoie les données business pour éviter de stocker du Base64 lourd
     * @param business Objet BusinessInfo
     * @returns BusinessInfo nettoyé
     */
    cleanBusinessData(business: any): any {
        if (!business) return business;
        const clean = { ...business };

        // Ne garder que les URLs, pas les base64
        if (clean.customHeaderImage && this.isDataUrl(clean.customHeaderImage)) {
            // On supprime le base64 si présent pour alléger la BDD
            // L'image devrait avoir été uploadée au préalable
            delete clean.customHeaderImage;
        }

        if (clean.signatureUrl && this.isDataUrl(clean.signatureUrl)) {
            delete clean.signatureUrl;
        }

        return clean;
    },

    /**
     * Sauvegarde les métadonnées d'une facture dans la DB
     * @param invoice Données de la facture
     * @param pdfUrl URL du PDF (optionnel)
     * @returns True si succès, false sinon
     */
    async saveInvoiceToCloud(invoice: InvoiceData, pdfUrl?: string): Promise<boolean> {
        try {
            const user = (await supabase.auth.getUser()).data.user;
            if (!user) return false;

            // Préparer le contenu en retirant les base64 si présents
            const cleanContent = { ...invoice };

            // Si business contient des images base64, les remplacer par les URLs
            if (cleanContent.business) {
                cleanContent.business = this.cleanBusinessData(cleanContent.business);
            }

            const payload = {
                id: invoice.id,
                user_id: user.id,
                number: invoice.number,
                type: invoice.type,
                date: invoice.date,
                customer_name: invoice.customerName,
                customer_phone: invoice.customerPhone,
                total_amount: invoice.items.reduce((acc, item) => acc + (item.quantity * item.unitPrice), 0),
                amount_paid: invoice.amountPaid || 0,
                status: invoice.isFinalized ? 'PAID' : 'DRAFT',
                content: cleanContent, // Contenu sans base64 encombrant
                pdf_url: pdfUrl || invoice.pdfUrl || null
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
            console.error('Save invoice exception:', err);
            return false;
        }
    }
};

// Export aussi l'ancien service pour compatibilité
export const storageService = storageServiceV2;
