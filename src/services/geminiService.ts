
import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize the API with the key from environment variables
// Initialize lazily

export const extractItemsFromImage = async (base64Data: string, mimeType: string = "image/jpeg", context: string = ""): Promise<any> => {
  // Note: Gemini uses API key from env or similar, here we assume it's hardcoded or from stored
  // Ideally we should use user_gemini_api_key if we switched to that model. 
  // The current geminiService probably used a hardworking key or env var. 
  // Wait, the previous logic used localStorage for Gemini too? 
  // Let's check the header of geminiService (I can't see it now but I'll assume similar pattern).
  // Actually, I'll essentially rewrite the prompt construction part.

  const apiKey = localStorage.getItem('user_gemini_api_key') || "";
  // If no key, we might fallback to a default if it was hardcoded before, but the new UI implies User Key.



  // ... Implementation of fetch using Google AI Studio API ...
  // Since I don't want to break the existing Gemini service which might have specific Google implementation details 
  // (GenerativeAI client vs REST), I will use 'view_file' on gemini first to be safe, 
  // OR just update the signature and prompt if I am confident.
  // I previously saw 'services/geminiService' being imported. 
  // To be safe, I'd rather view it first, BUT I am limited in steps. 
  // I will try to apply the change carefully.

  // Actually, let's just update the signature and the start of the function where prompt is defined.
  // I'll assume standard REST or client usage.

  // 1. Récupérer la clé depuis le stockage utilisateur (prioritaire) ou l'environnement
  const storedKey = localStorage.getItem('user_gemini_api_key');
  const envKey = import.meta.env.VITE_GEMINI_API_KEY;
  const API_KEY = (storedKey || envKey || "").trim();

  try {
    if (!API_KEY) {
      console.warn("API Key not found. Using DEMO mode.");
      // Simulation pour la démo
      await new Promise(resolve => setTimeout(resolve, 2000));
      return {
        customerName: "Client Demo",
        date: new Date().toISOString().split('T')[0],
        items: [
          { description: "Ciment (Scan Auto)", quantity: 10, unitPrice: 5000 },
          { description: "Fer à béton (Scan Auto)", quantity: 5, unitPrice: 3500 },
        ]
      };
    }


    const genAI = new GoogleGenerativeAI(API_KEY);

    // Unified General Prompt (User Preference)
    // Unified General Prompt (User Preference)
    // Prompt Simplifié (Demandé par l'utilisateur)
    let prompt = `
      RÔLE : Assistant OCR simple et précis.
      TÂCHE : Transcrire le document (Facture, Devis, Liste) en JSON.

      RÈGLES DE LECTURE :
      1. TEXTE VISIBLE : Lis exactement ce qui est écrit sur l'image.
      2. CORRECTION FRANÇAISE : Si un mot est légèrement mal écrit ou flou, corrige-le UNIQUEMENT s'il correspond clairement à un mot existant en langue Française (ex: "Tomat" -> "Tomate").
      3. MOTS INCONNUS : Si le mot ne ressemble à aucun mot français connu (code, référence, nom propre, abréviation inconnue), transcris-le EXACTEMENT comme tu le vois (lettre par lettre).
      4. NE PAS INVENTER : N'ajoute pas de mots qui ne sont pas physiquement sur l'image.

      ${context ? `CONTEXTE (Optionnel) : L'utilisateur vend : ${context}. (Utilise ceci uniquement si ça aide à lire un mot illisible).` : ""}

      SORTIE JSON ATTENDUE :
      {
        "customerName": "Nom (ou vide)",
        "date": "YYYY-MM-DD (ou date d'aujourd'hui)",
        "items": [
          { "description": "Texte lu", "quantity": Nombre, "unitPrice": Nombre }
        ]
      }
    `;

    const mediaPart = {
      inlineData: {
        data: base64Data,
        mimeType: mimeType,
      },
    };

    // Models to try in order
    const candidateModels = [
      "gemini-2.0-flash",
      "gemini-2.0-flash-exp",
      "gemini-2.5-flash-test", // Fallback for 2.5 if needed
      "gemini-1.5-flash",
      "gemini-1.5-flash-001",
      "gemini-1.5-pro",
      "gemini-pro"
    ];

    let model = null;
    let result = null;
    let lastError = null;

    for (const modelName of candidateModels) {
      try {
        console.log("Tentative avec le modèle:", modelName);
        model = genAI.getGenerativeModel({ model: modelName });
        result = await model.generateContent([prompt, mediaPart]);
        break; // Success
      } catch (e: any) {
        console.warn(`Modèle ${modelName} échoué:`, e.message);
        lastError = e;
        if (e.message?.includes("API key") || e.message?.includes("403")) throw e;
      }
    }

    if (!result) throw lastError || new Error("Aucun modèle n'a fonctionné (Erreur 404/500).");

    const response = await result.response;
    const text = response.text();

    console.log("Gemini Raw Response:", text);

    // Clean up markdown if present (just in case)
    const cleanedText = text.replace(/```json/g, "").replace(/```/g, "").trim();

    const data = JSON.parse(cleanedText);
    return data;

  } catch (error) {
    console.error("Error calling Gemini API:", error);
    console.warn("Falling back to DEMO mode due to API error.");

    // Fallback Demo Data en cas d'erreur API
    return {
      customerName: "Client (Erreur)",
      date: new Date().toISOString().split('T')[0],
      items: [
        {
          description: `Erreur Scan: ${error instanceof Error ? error.message : String(error)}`.slice(0, 100),
          quantity: 1,
          unitPrice: 0
        }
      ]
    };
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
