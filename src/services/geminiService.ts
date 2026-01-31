
import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize the API with the key from environment variables
// Initialize lazily

import { supabase } from "./supabaseClient";

export const extractItemsFromImage = async (base64Data: string, mimeType: string = "image/jpeg", context: string = ""): Promise<any> => {
  try {
    console.log("Using Secure Global Key (Server Proxy)...");

    // Get Auth Token
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Authentification requise pour le scan.");

    // --- PRIMARY PATH: SECURE BACKEND CALL ---
    try {
      const response = await fetch('/api/scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ base64Data, mimeType, context })
      });

      if (response.ok) {
        return await response.json();
      } else {
        // If server returns error, we might fallback if in DEV, otherwise throw.
        const errorText = await response.text();
        console.warn("Backend Scan Failed:", errorText);
        throw new Error(errorText);
      }
    } catch (serverError: any) {
      // --- FALLBACK FOR LOCAL DEV (When /api/ does not exist) ---
      // Only if we are in dev mode and have a local key
      const envKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (envKey) {
        console.warn("Server Proxy failed (likely local dev). Falling back to Local VITE Key.");
        const genAI = new GoogleGenerativeAI(envKey);

        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        let prompt = `RÔLE : Assistant OCR simple et précis. TÂCHE : Transcrire le document (Facture, Devis, Liste) en JSON.
         SORTIE JSON ATTENDUE : { "customerName": "Nom", "date": "YYYY-MM-DD", "items": [{ "description": "Texte", "quantity": 1, "unitPrice": 0 }] }`;

        if (context) prompt += ` CONTEXTE: ${context}`;

        const result = await model.generateContent([
          prompt,
          { inlineData: { data: base64Data, mimeType: mimeType } }
        ]);

        const text = (await result.response).text();
        const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
        return JSON.parse(cleaned);
      }

      throw serverError; // Re-throw the original server error if no fallback
    }

  } catch (error) {
    console.error("OCR Error:", error);
    throw error;
  }
};

export const testGeminiConnection = async (): Promise<{ success: boolean; message: string }> => {
  const storedKey = localStorage.getItem('user_gemini_api_key');
  const envKey = import.meta.env.VITE_GEMINI_API_KEY;
  const API_KEY = (storedKey || envKey || "").trim();

  if (!API_KEY) return { success: false, message: "Aucune clé API trouvée. Veuillez en saisir une." };

  try {
    const genAI = new GoogleGenerativeAI(API_KEY);

    // 1. SDK Test with multiple models
    const candidateModels = [
      "gemini-2.0-flash",
      "gemini-2.0-flash-exp",
      "gemini-2.5-flash-test", // Fallback for 2.5 if needed
      "gemini-1.5-flash",
      "gemini-1.5-flash-001",
      "gemini-1.5-pro",
      "gemini-pro"
    ];
    let errorLog = [];
    let successModel = "";
    let result = null;

    for (const modelName of candidateModels) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        result = await model.generateContent("Réponds juste 'OK' pour tester.");
        successModel = modelName;
        break;
      } catch (e: any) {
        const msg = e.message || String(e);
        const code = msg.includes('404') ? '404' : (msg.includes('403') ? '403' : 'Err');
        errorLog.push(`${modelName}: ${code} (${msg.slice(0, 40)}...)`);
      }
    }

    if (result) {
      const response = await result.response;
      return { success: true, message: `Succès SDK (${successModel}) : ` + response.text() };
    }

    // 2. Fallback: Raw REST API Check (Diagnotic Deep Dive)
    // If SDK fails, we check if the API Key itself is valid and what models are actually visible.
    try {
      const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`);
      const data = await resp.json();

      if (!resp.ok) {
        // We got a specific API error (e.g., API not enabled)
        const apiErrorMsg = data.error?.message || JSON.stringify(data);
        return {
          success: false,
          message: `ÉCHEC SDK & API REST.\nCode: ${resp.status}\nErreur Google: ${apiErrorMsg}`
        };
      }

      // If REST works but SDK failed, list available models
      const availableModels = (data.models || []).map((m: any) => m.name).join(", ");
      return {
        success: false, // Still fail because SDK failed, but give a clue
        message: `SDK Échoué mais Clé Valide !\nModèles disponibles pour cette clé :\n${availableModels}\n\nEssayez de mettre à jour l'app.`
      };

    } catch (fetchErr: any) {
      return { success: false, message: "Échec Total (Pas d'internet ?) :\n" + fetchErr.message };
    }

  } catch (error: any) {
    return { success: false, message: "Erreur Globale: " + (error.message || String(error)) };
  }
};
