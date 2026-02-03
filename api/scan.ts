
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

        // 3. SECURITY: Payment (Deduct Credits)
        // DISABLED BY DEFAULT: Credits are managed locally in the "Smart Wallet".
        // Server balance might be 0 while user has local credits.
        // We rely on the Client App to deduct local credits (handled in useScanner.ts).

        /* 
        const SCAN_COST = 40;
        const { data: canAfford, error: paymentError } = await supabase.rpc('deduct_credits', { amount: SCAN_COST });

        if (paymentError) {
             console.error("Payment Error:", paymentError);
             return new Response(JSON.stringify({ error: 'Payment Processing Failed' }), { status: 500 });
        }

        if (!canAfford) {
            return new Response(JSON.stringify({ error: 'Insufficent Server Credits. Please recharge your account.' }), { status: 402 });
        }
        */

        // 4. CONTINUE: Configuration Check
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return new Response(JSON.stringify({ error: 'Server Configuration Error: API Key missing' }), { status: 500 });
        }

        const { base64Data, mimeType, context } = await request.json();

        if (!base64Data) {
            return new Response(JSON.stringify({ error: 'Missing image data' }), { status: 400 });
        }

        const genAI = new GoogleGenerativeAI(apiKey);

        try {
            // Unified Prompt (Strict Word-for-Word)
            let prompt = `
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
            console.log("Sending to Gemini...");
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
            const data = JSON.parse(cleanedText); // This might throw if AI fails

            return new Response(JSON.stringify(data), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });

        } catch (aiError: any) {
            console.error("AI/Parsing Error - Refunding Credits:", aiError);

            // REFUND LOGIC (DISABLED)
            // const { error: refundError } = await supabase.rpc('deduct_credits', { amount: -SCAN_COST });
            // if (refundError) console.error("CRITICAL: Refund Failed:", refundError);

            // Continue to return error to client
            throw aiError;
        }

    } catch (error: any) {
        console.error("API Scan Error:", error);
        return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), { status: 500 });
    }
}
