
export const testMistralConnection = async (): Promise<{ success: boolean; message: string }> => {
    const apiKey = localStorage.getItem('user_mistral_api_key') || "";
    if (!apiKey) return { success: false, message: "Absence de clé API" };

    try {
        const response = await fetch("https://api.mistral.ai/v1/models", {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Accept": "application/json"
            }
        });

        if (!response.ok) {
            if (response.status === 401) return { success: false, message: "Clé Invalide (401)" };
            return { success: false, message: `Erreur HTTP ${response.status}` };
        }

        const data = await response.json();
        return { success: true, message: `Connexion OK! ${data.data?.length || 0} modèles disponibles.` };

    } catch (error: any) {
        return { success: false, message: error.message };
    }
};

export const extractItemsWithMistral = async (base64Data: string, mimeType: string = "image/jpeg", context: string = ""): Promise<any> => {
    const apiKey = localStorage.getItem('user_mistral_api_key') || "";
    if (!apiKey) throw new Error("Clé API Mistral manquante");

    let prompt = `
      ROLE: You are an expert Data Entry Clerk.
      Your task is to transcribe handwritten or printed invoices/lists.
    `;

    if (context) {
        prompt += `
      BUSINESS CONTEXT:
      The user operates in this domain. Known products:
      ${context}
      
      Use this to guess illegible words (e.g. 'pqt' -> 'paquet').
        `;
    }

    prompt += `
      INPUT: Image of a document.
      OUTPUT: JSON Object { customerName, date, items: [{ description, quantity, unitPrice }] }.
  `;

    // Only use models known to support vision
    const candidateModels = [
        "pixtral-large-latest",
        "pixtral-12b-2409"
    ];

    let lastError: any = null;
    let attemptsLog = [];

    for (const model of candidateModels) {
        try {
            console.log(`Tentative Mistral avec le modèle: ${model}`);

            const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                body: JSON.stringify({
                    model: model,
                    messages: [
                        {
                            role: "user",
                            content: [
                                { type: "text", text: prompt },
                                {
                                    type: "image_url",
                                    image_url: {
                                        url: `data:${mimeType};base64,${base64Data}`
                                    }
                                }
                            ]
                        }
                    ],
                    response_format: { type: "json_object" }
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                const msg = errorData.error?.message || response.statusText || "Erreur Inconnue";

                let log = `Model ${model} failed (${response.status}): ${msg}`;

                if (response.status === 429) {
                    log = `Erreur 429 (Quota/Rate Limit): Votre compte Mistral n'a plus de crédits ou est limité. Vérifiez console.mistral.ai > Billing.`;
                } else if (response.status === 402) {
                    log = `Erreur 402 (Paiement): Crédits épuisés.`;
                }

                console.warn(log);
                attemptsLog.push(log);

                // Start throwing immediately for account-level errors (401, 402, 429)
                if (response.status === 401 || response.status === 402 || response.status === 429) {
                    throw new Error(log);
                }

                lastError = new Error(log);
                continue;
            }

            const data = await response.json();
            const text = data.choices[0].message.content;

            // Clean up markdown if present
            const cleanedText = text.replace(/```json/g, "").replace(/```/g, "").trim();
            return JSON.parse(cleanedText);

        } catch (error: any) {
            lastError = error;
            attemptsLog.push(`${model}: ${error.message}`);
            // Stop on Auth errors
            if (error.message.includes("401") || error.message.includes("Clé")) throw error;
        }
    }

    // If loop finishes without success
    throw new Error(`Echec Mistral. Détails: ${attemptsLog.join(" | ")}`);
};
