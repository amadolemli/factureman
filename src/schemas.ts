import { z } from 'zod';

export const BusinessInfoSchema = z.object({
    name: z.string().min(1, "Le nom de l'entreprise est requis"),
    specialty: z.string().min(1, "La spécialité est requise"),
    address: z.string().min(1, "L'adresse est requise"),
    phone: z.string().min(8, "Le numéro de téléphone est invalide"),
    city: z.string().min(1, "La ville est requise"),
    logo: z.string().optional(),
    customHeaderImage: z.string().optional(),
    nif: z.string().optional(),
    rccm: z.string().optional(),
});

export const ProductSchema = z.object({
    id: z.string(),
    name: z.string().min(1, "Le nom du produit est requis"),
    defaultPrice: z.number().min(0, "Le prix ne peut pas être négatif"),
    stock: z.number().int(),
    category: z.string().optional(),
});

export const InvoiceItemSchema = z.object({
    id: z.string(),
    quantity: z.number().min(0.01, "La quantité doit être supérieure à 0"),
    description: z.string().min(1, "La description est requise"),
    unitPrice: z.number().min(0, "Le prix ne peut pas être négatif"),
});

export const InvoiceDataSchema = z.object({
    id: z.string(),
    type: z.enum(['Facture', 'Bon de Livraison', 'Bon de Commande', 'Facture Proforma', 'Devis', 'Reçu de Versement']),
    number: z.string(),
    date: z.string(),
    customerName: z.string().min(1, "Le nom du client est requis"),
    customerPhone: z.string().optional(),
    items: z.array(InvoiceItemSchema).min(1, "Ajoutez au moins un article"),
    business: BusinessInfoSchema,
    templateId: z.enum(['classic', 'modern', 'elegant']),
    amountPaid: z.number().min(0),
    isFinalized: z.boolean().optional(),
    creditConfirmed: z.boolean().optional(),
    clientBalanceSnapshot: z.number().optional(),
});

export const CreditRecordSchema = z.object({
    id: z.string(),
    customerName: z.string().min(1),
    customerPhone: z.string().optional(),
    totalDebt: z.number(),
    remainingBalance: z.number(),
    history: z.array(z.object({
        type: z.enum(['INVOICE', 'PAYMENT']),
        id: z.string(),
        date: z.string(),
        amount: z.number(),
        description: z.string(),
        status: z.enum(['CANCELLED']).optional(),
    })),
    appointments: z.array(z.object({
        id: z.string(),
        date: z.string(),
        note: z.string(),
        completed: z.boolean(),
    })).optional(),
});
