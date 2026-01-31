
export const extractItemsWithAnthropic = async (base64Data: string, mimeType: string = "image/jpeg", context: string = ""): Promise<any> => {
    const apiKey = localStorage.getItem('user_anthropic_api_key') || "";
    if (!apiKey) throw new Error("Clé API Anthropic manquante");

    let prompt = `
      ROLE: You are an expert Data Entry Clerk.
      Your task is to transcribe handwritten or printed invoices/lists with high accuracy.
      
      INPUT: Image of a document (Invoice, Receipt, Note).
      OUTPUT: JSON Object.
    `;

    if (context) {
        prompt += `
      BUSINESS CONTEXT (Important):
      Known products/Domain:
      ${context}
      
      Use this to infer illegible words or abbreviations.
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
        const response = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
                "x-api-key": apiKey,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
                "dangerously-allow-browser": "true" // Needed for client-side usage if not proxied
            },
            body: JSON.stringify({
                model: "claude-3-5-sonnet-20240620",
                max_tokens: 4096,
                messages: [
                    {
                        role: "user",
                        content: [
                            {
                                type: "image",
                                source: {
                                    type: "base64",
                                    media_type: mimeType,
                                    data: base64Data,
                                },
                            },
                            {
                                type: "text",
                                text: prompt + "\n\nIMPORTANT: OUTPUT ONLY JSON. NO CONVERSATION."
                            }
                        ],
                    },
                    {
                        role: "assistant", // Prefill to force JSON start
                        content: "{"
                    }
                ],
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || "Erreur Anthropic API");
        }

        const data = await response.json();
        let text = data.content[0].text;

        // Since we pre-filled "{" to force JSON, the response might start after it
        // Or sometimes it repeats it. We need to reconstruct valid JSON.
        if (!text.trim().startsWith("{")) {
            text = "{" + text;
        }

        // Robust parsing: Find the first '{' and last '}'
        const firstBrace = text.indexOf('{');
        const lastBrace = text.lastIndexOf('}');

        if (firstBrace !== -1 && lastBrace !== -1) {
            text = text.substring(firstBrace, lastBrace + 1);
        }

        return JSON.parse(text);

    } catch (error) {
        console.error("Anthropic Error:", error);
        throw error;
    }
};
