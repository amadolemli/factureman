import { useState } from 'react';
import { extractItemsFromImage } from '../services/ocrService';
import { Product } from '../types';

interface UseScannerProps {
    products: Product[];
    onScanSuccess: (items: any[], customerName?: string, date?: string) => void;
    onError: (msg: string) => void;
}

export const useScanner = ({ products, onScanSuccess, onError }: UseScannerProps) => {
    const [isScanning, setIsScanning] = useState(false);

    const compressImage = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target?.result as string;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 1024;
                    const MAX_HEIGHT = 1024;
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > MAX_WIDTH) {
                            height *= MAX_WIDTH / width;
                            width = MAX_WIDTH;
                        }
                    } else {
                        if (height > MAX_HEIGHT) {
                            width *= MAX_HEIGHT / height;
                            height = MAX_HEIGHT;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx?.drawImage(img, 0, 0, width, height);

                    // Compress to JPEG 0.7
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                    resolve(dataUrl.split(',')[1]); // Return base64 only
                };
                img.onerror = (err) => reject(new Error("Erreur de chargement de l'image"));
            };
            reader.onerror = (error) => reject(error);
        });
    };

    const scanFile = async (file: File) => {
        setIsScanning(true);
        try {
            // 1. Compress Image (Fixes Payload Too Large)
            console.log("Compressing image...");
            const base64 = await compressImage(file);
            const mimeType = "image/jpeg"; // Always convert to JPEG

            // 2. Generate Context
            const productNames = products.map(p => p.name).slice(0, 100).join(", ");
            const scanContext = `Known Items: ${productNames}. Domain: General Business.`;

            console.log("Starting Scan...");
            const result = await extractItemsFromImage(base64, mimeType, scanContext);

            if (result) {
                const newItems = (result.items || []).map((item: any) => {
                    let finalDesc = item.description || '';
                    let finalPrice = 0; // Default to 0 (Blank) as requested if no match

                    // Simple Levenshtein Implementation
                    const getSimilarity = (s1: string, s2: string): number => {
                        const longer = s1.length > s2.length ? s1 : s2;
                        const shorter = s1.length > s2.length ? s2 : s1;
                        if (longer.length === 0) return 1.0;
                        const costs = new Array();
                        for (let i = 0; i <= longer.length; i++) {
                            let lastValue = i;
                            for (let j = 0; j <= shorter.length; j++) {
                                if (i == 0) costs[j] = j;
                                else {
                                    if (j > 0) {
                                        let newValue = costs[j - 1];
                                        if (longer.charAt(i - 1) != shorter.charAt(j - 1)) newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
                                        costs[j - 1] = lastValue;
                                        lastValue = newValue;
                                    }
                                }
                            }
                            if (i > 0) costs[shorter.length] = lastValue;
                        }
                        return (longer.length - costs[shorter.length]) / longer.length;
                    };

                    if (finalDesc) {
                        const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
                        const scanName = normalize(finalDesc);

                        let bestMatch: Product | null = null;
                        let bestScore = 0;

                        for (const p of products) {
                            const prodName = normalize(p.name);
                            // 1. Priority: Exact or Substring
                            if (prodName === scanName) {
                                bestScore = 1.0;
                                bestMatch = p;
                            } else if (prodName.includes(scanName) || scanName.includes(prodName)) {
                                const lenRatio = Math.min(prodName.length, scanName.length) / Math.max(prodName.length, scanName.length);
                                const score = 0.8 + (lenRatio * 0.2);
                                if (score > bestScore) {
                                    bestScore = score;
                                    bestMatch = p;
                                }
                            } else {
                                // 2. Fuzzy
                                const score = getSimilarity(scanName, prodName);
                                if (score > bestScore) {
                                    bestScore = score;
                                    bestMatch = p;
                                }
                            }
                        }


                        if (bestMatch && bestScore > 0.6) {
                            finalDesc = bestMatch.name;
                            finalPrice = bestMatch.defaultPrice; // Use Catalog Price
                            console.log(`Matched '${item.description}' to '${bestMatch.name}' (Score: ${bestScore.toFixed(2)})`);
                        }
                    }

                    return {
                        id: Math.random().toString(36).substr(2, 9),
                        quantity: item.quantity || 1,
                        description: finalDesc,
                        unitPrice: finalPrice
                    };
                });

                // Only now call success (which triggers client logic)
                onScanSuccess(newItems, result.customerName, result.date);
            } else {
                onError("Le scan n'a rien renvoyé.");
            }

        } catch (error: any) {
            console.error("Scan error:", error);
            let msg = error.message || "Erreur lors de l'analyse.";
            if (msg.includes('402')) msg = "Solde Crédits Serveur insuffisant. Veuillez recharger votre compte en ligne.";
            if (msg.includes('429')) msg = "Limite de vitesse atteinte. Veuillez attendre 10 secondes.";
            if (msg.includes('Too Large')) msg = "Image trop lourde, compression échouée.";
            onError(msg);
        } finally {
            setIsScanning(false);
        }
    };

    return { isScanning, scanFile };
};
