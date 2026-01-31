
import { extractItemsFromImage as extractWithGemini, testGeminiConnection } from './geminiService';
import { extractItemsWithAnthropic } from './anthropicService';
import { extractItemsWithOpenAI } from './openaiService';
import { extractItemsWithOpenRouter } from './openRouterService';
import { extractItemsWithMistral } from './mistralService';

export type OCRProvider = 'gemini' | 'anthropic' | 'openai' | 'openrouter' | 'mistral' | 'openrouter_mistral';

export const extractItemsFromImage = async (base64Data: string, mimeType: string = "image/jpeg", context: string = ""): Promise<any> => {
    // 1. Get Preferred Provider
    const provider = (localStorage.getItem('preferred_ocr_provider') as OCRProvider) || 'gemini';
    console.log(`Using OCR Provider: ${provider}`);

    try {
        switch (provider) {
            case 'openrouter_mistral':
                return await extractItemsWithOpenRouter(base64Data, mimeType, "mistralai/pixtral-12b", context);
            case 'mistral':
                return await extractItemsWithMistral(base64Data, mimeType, context);
            case 'openrouter':
                return await extractItemsWithOpenRouter(base64Data, mimeType, "anthropic/claude-3.5-sonnet", context);
            case 'anthropic':
                return await extractItemsWithAnthropic(base64Data, mimeType, context);
            case 'openai':
                return await extractItemsWithOpenAI(base64Data, mimeType, context);
            case 'gemini':
            default:
                return await extractWithGemini(base64Data, mimeType, context);
        }
    } catch (error) {
        console.error(`Error with provider ${provider}:`, error);
        throw error;
    }
};

export const getActiveProviderName = (): string => {
    const provider = localStorage.getItem('preferred_ocr_provider');
    switch (provider) {
        case 'mistral': return 'Mistral Pixtral (France)';
        case 'openrouter': return 'Claude 3.5 (via OpenRouter)';
        case 'anthropic': return 'Claude 3.5 Sonnet (Direct)';
        case 'openai': return 'GPT-4o (OpenAI)';
        case 'gemini': default: return 'Gemini 2.0 Flash (Google)';
    }
};
