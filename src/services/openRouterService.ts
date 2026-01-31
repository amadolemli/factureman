
export const extractItemsWithOpenRouter = async (base64Data: string, mimeType: string = "image/jpeg", model: string = "anthropic/claude-3.5-sonnet", context: string = ""): Promise<any> => {
    const apiKey = localStorage.getItem('user_openrouter_api_key') || "";
    if (!apiKey) throw new Error("Clé API OpenRouter manquante");

    let prompt = `
      ROLE: You are an expert Data Entry Clerk.
      Your task is to transcribe handwritten or printed invoices/lists with high accuracy.
      
      INPUT: Image of a document (Invoice, Receipt, Note).
      OUTPUT: JSON Object.
    `;

    if (context) {
        prompt += `
      BUSINESS CONTEXT (Important):
      The user operates in this domain with these known products:
      ${context}
      
      INSTRUCTION based on Context:
      - Use this list to guess illegible words or abbreviations (e.g. 'pqt' -> 'paquet' in Hardware).
      - If a word looks like 'vis', and 'vis' is in the context, favor 'vis'.
      `;
    }

    prompt += `
      INSTRUCTIONS:
      1. EXTRACT: customerName, date, items.
      2. HANDWRITING STRATEGY: Read text WORD-BY-WORD. Do not skip unclear words. If a word is messy, analyze it letter-by-letter to guess the best match. Infer missing letters if obvious from context.
      3. NUMBERS: Distinguish carefully between '1', '7', '4', '0', '6'.

      JSON STRUCTURE:
      {
        "customerName": "String (or empty)",
        "date": "YYYY-MM-DD",
        "items": [
          { "description": "String (Corrected Name)", "quantity": Number, "unitPrice": Number (0 if missing) }
        ]
      }

      RULES:
      - STRICT JSON OUTPUT. NO BACKTICKS.
      - Do not hallucinate items not present.
  `;

    try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
                // OpenRouter specific headers for app identification
                "HTTP-Referer": window.location.origin,
                "X-Title": "Mali-Facture App"
            },
            body: JSON.stringify({
                model: model, // Using dynamic model (Claude or Mistral)
                messages: [
                    {
                        role: "user",
                        content: [
                            { type: "text", text: prompt + "\n\nRETURN ONLY JSON." },
                            {
                                type: "image_url",
                                image_url: {
                                    url: `data:${mimeType};base64,${base64Data}`
                                }
                            }
                        ]
                    }
                ],
                // response_format: { type: "json_object" } // Sometimes causes issues with some models if prompt isn't perfect
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || "Erreur OpenRouter API");
        }

        const data = await response.json();
        let text = data.choices[0].message.content;

        // Clean up text to find JSON
        const firstBrace = text.indexOf('{');
        const lastBrace = text.lastIndexOf('}');

        if (firstBrace !== -1 && lastBrace !== -1) {
            text = text.substring(firstBrace, lastBrace + 1);
        } else {
            // Fallback: strip markdown manually just in case
            text = text.replace(/```json/g, "").replace(/```/g, "").trim();
        }

        return JSON.parse(text);

    } catch (error) {
        console.error("OpenRouter Error:", error);
        throw error;
    }
};
