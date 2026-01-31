
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

export const config = {
    runtime: 'edge', // Optional: Use Edge runtime for speed if compatible, or Node.js
};

export default async function handler(request: Request) {
    if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
    }

    try {
        // 1. SECURITY: Verify Supabase Auth Token
        const authHeader = request.headers.get('Authorization');
        if (!authHeader) {
            return new Response(JSON.stringify({ error: 'Unauthorized: Missing Token' }), { status: 401 });
        }

        const token = authHeader.replace('Bearer ', '');
        const supabase = createClient(
            process.env.VITE_SUPABASE_URL!,
            process.env.VITE_SUPABASE_ANON_KEY!
        );

        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user) {
            return new Response(JSON.stringify({ error: 'Unauthorized: Invalid Token' }), { status: 401 });
        }

        // 2. SECURITY: Rate Limiting (Spam Check)
        // Call the database function to check and update the rate limit
        const { data: allowed, error: rpcError } = await supabase.rpc('check_scan_rate_limit');

        if (rpcError) {
            console.error("Rate Limit Check Error:", rpcError);
            // Start strictly: if we can't check, we block. Or permissive?
            // Since the user must run the SQL, we block to ensure they do it.
            return new Response(JSON.stringify({ error: 'Server Security Configuration Missing (Run SQL)' }), { status: 500 });
        }

        if (allowed === false) {
            return new Response(JSON.stringify({ error: 'Rate Limit Exceeded: Please wait 10 seconds between scans.' }), { status: 429 });
        }

        // 3. CONTINUE: Configuration Check
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return new Response(JSON.stringify({ error: 'Server Configuration Error: API Key missing' }), { status: 500 });
        }

        const { base64Data, mimeType, context } = await request.json();

        if (!base64Data) {
            return new Response(JSON.stringify({ error: 'Missing image data' }), { status: 400 });
        }

        const genAI = new GoogleGenerativeAI(apiKey);

        // Unified Prompt (Same as frontend)
        let prompt = `
      RÔLE : Assistant OCR simple et précis.
      TÂCHE : Transcrire le document (Facture, Devis, Liste) en JSON.

      RÈGLES DE LECTURE :
      1. TEXTE VISIBLE : Lis exactement ce qui est écrit sur l'image.
      2. CORRECTION FRANÇAISE : Si un mot est légèrement mal écrit ou flou, corrige-le UNIQUEMENT s'il correspond clairement à un mot existant en langue Française.
      3. MOTS INCONNUS : Si le mot ne ressemble à aucun mot français connu, transcris-le EXACTEMENT comme tu le vois.
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

        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" }); // Use the fast/cheap model

        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    data: base64Data,
                    mimeType: mimeType || "image/jpeg",
                },
            },
        ]);

        const response = await result.response;
        const text = response.text();

        // Cleanup JSON
        const cleanedText = text.replace(/```json/g, "").replace(/```/g, "").trim();
        const data = JSON.parse(cleanedText);

        return new Response(JSON.stringify(data), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error: any) {
        console.error("API Scan Error:", error);
        return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), { status: 500 });
    }
}
