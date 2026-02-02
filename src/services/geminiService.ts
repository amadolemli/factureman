
import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize the API with the key from environment variables
// Initialize lazily

import { supabase } from "./supabaseClient";

export const extractItemsFromImage = async (base64Data: string, mimeType: string = "image/jpeg", context: string = ""): Promise<any> => {
  try {
    console.log("Attempting Secure Server Scan...");

    // Get Auth Session for Server Call
    const { data: { session } } = await supabase.auth.getSession();

    // 1. Try SERVER-SIDE Scan (Preferred for security/credits)
    if (session) {
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
        console.warn(`Server Scan Failed (${response.status}). Switching to Client Fallback.`);
      }
    } else {
      console.warn("No Session. Switching to Client Fallback (Demo/Local Mode).");
    }
    throw new Error("Trigger Fallback"); // Trigger catch block for fallback

  } catch (serverError) {
    // 2. CLIENT-SIDE FALLBACK (Localhost / Offline / Server Error)
    // ONLY ALLOWED IN DEV MODE
    if (import.meta.env.DEV) {
      console.log("DEV MODE DETECTED: Executing Client-Side Fallback Scan...");

      const storedKey = localStorage.getItem('user_gemini_api_key');
      const envKey = import.meta.env.VITE_GEMINI_API_KEY;
      const API_KEY = (storedKey || envKey || "").trim();

      if (!API_KEY) {
        throw new Error("DEV MODE: Le scan serveur a échoué et aucune Clé API locale (VITE_GEMINI_API_KEY) n'est configurée.");
      }

      try {
        const genAI = new GoogleGenerativeAI(API_KEY);
        // Use flash model for speed and efficiency
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        const prompt = `
            RÔLE : Machine de transcription OCR stricte.
            TÂCHE : Transcrire le document EXACTEMENT mot pour mot.
            
            RÈGLES CRITIQUES :
            1. STRICTEMENT MOT POUR MOT : Transcris uniquement ce qui est visible. N'invente AUCUN mot. N'ajoute AUCUN article ou adjectif qui n'est pas sur l'image.
            2. PAS D'INTERPRÉTATION : Si écrit "Pain", écris "Pain". N'écris pas "Pain de mie" si ce n'est pas écrit.
            3. PAS DE CORRECTION : Ne corrige pas les fautes d'orthographe. Transcris ce que tu vois.
            4. ECRIS 'INCONNU' si une valeur (prix/quantité) est illisible. NE DEVINE PAS.
            5. FORMAT JSON VALIDE : Les nombres doivent être valides (Pas de "05", mais 5. Pas de "17.500", mais 17500).

            ${context ? `CONTEXTE (Uniquement pour désambiguïser des lettres floues, PAS pour compléter) : L'utilisateur vend : ${context}.` : ""}

            SORTIE JSON ATTENDUE :
            {
                "customerName": "Nom tel qu'écrit (ou vide)",
                "date": "Date telle qu'écrite (ou vide)",
                "items": [
                { "description": "TRANSCRIPTION EXACTE", "quantity": Nombre, "unitPrice": Nombre }
                ]
            }
            `;

        const result = await model.generateContent([
          prompt,
          {
            inlineData: {
              data: base64Data,
              mimeType: mimeType
            }
          }
        ]);

        const response = await result.response;
        const text = response.text();
        const cleanedText = text.replace(/```json/g, "").replace(/```/g, "").trim();

        return JSON.parse(cleanedText);

      } catch (clientError: any) {
        console.error("Client Scan Error:", clientError);
        throw new Error("Échec du scan DEV : " + (clientError.message || String(clientError)));
      }
    } else {
      // PRODUCTION: Re-throw server error (No fallback allowed)
      console.error("Server Scan Failed in Production. Fallback blocked for security.");
      throw serverError;
    }
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
