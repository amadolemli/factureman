import { describe, it, expect } from 'vitest';
import { formatCurrency, numberToWords } from './format';

describe('formatCurrency', () => {
    it('formats numbers correctly', () => {
        expect(formatCurrency(1000)).toBe('1 000');
        // Note: The space in '1 000' might be a non-breaking space depending on the locale implementation in Node/Jsdom vs Browser.
        // We might need to adjust expectation to match the exact character or use a regex.
    });
});

describe('numberToWords', () => {
    it('converts 0 to words', () => {
        expect(numberToWords(0)).toBe('Zéro Franc CFA');
    });

    it('converts simple numbers', () => {
        expect(numberToWords(5)).toBe('Cinq Francs CFA');
    });

    it('converts complex numbers', () => {
        expect(numberToWords(123)).toBe('Cent vingt-trois Francs CFA');
    });

    it('converts large numbers', () => {
        expect(numberToWords(1000000)).toBe('Un million Francs CFA');
    });
});
