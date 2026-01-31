
export const extractItemsWithOpenAI = async (base64Data: string, mimeType: string = "image/jpeg", context: string = ""): Promise<any> => {
    const apiKey = localStorage.getItem('user_openai_api_key') || "";
    if (!apiKey) throw new Error("Clé API OpenAI manquante");

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
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "gpt-4o",
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
            const errorData = await response.json();
            throw new Error(errorData.error?.message || "Erreur OpenAI API");
        }

        const data = await response.json();
        const text = data.choices[0].message.content;
        return JSON.parse(text);

    } catch (error) {
        console.error("OpenAI Error:", error);
        throw error;
    }
};
