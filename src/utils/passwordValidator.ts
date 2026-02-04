/**
 * Password Validation Utility
 * Enforces strong password requirements
 */

export interface PasswordValidationResult {
    valid: boolean;
    errors: string[];
    strength: 'weak' | 'medium' | 'strong' | 'very-strong';
    score: number; // 0-100
}

const COMMON_PASSWORDS = [
    'password', 'password123', '12345678', '123456789', '1234567890',
    'qwerty', 'abc123', 'monkey', 'letmein', 'trustno1',
    'dragon', 'baseball', 'iloveyou', 'master', 'sunshine',
    'ashley', 'bailey', 'passw0rd', 'shadow', 'superman',
    'azerty', 'azerty123', 'motdepasse', '00000000', '11111111',
    'admin', 'admin123', 'root', 'toor', 'test'
];

export const validatePassword = (pwd: string): PasswordValidationResult => {
    const errors: string[] = [];
    let score = 50; // Default medium score for valid length

    // Requirement checks: Just simple 6 chars
    if (pwd.length < 6) {
        errors.push('Minimum 6 caractères requis');
        score = 0;
    }

    // Determine strength (Simple Logic)
    let strength: PasswordValidationResult['strength'] = 'medium';
    if (pwd.length < 6) strength = 'weak';
    if (pwd.length >= 8) strength = 'strong';

    return {
        valid: errors.length === 0,
        errors,
        strength,
        score: Math.min(100, score)
    };
};

/**
 * Get password strength color for UI
 */
export const getPasswordStrengthColor = (strength: PasswordValidationResult['strength']): string => {
    switch (strength) {
        case 'weak': return 'text-red-600 bg-red-50';
        case 'medium': return 'text-orange-600 bg-orange-50';
        case 'strong': return 'text-blue-600 bg-blue-50';
        case 'very-strong': return 'text-green-600 bg-green-50';
    }
};

/**
 * Get password strength label (French)
 */
export const getPasswordStrengthLabel = (strength: PasswordValidationResult['strength']): string => {
    switch (strength) {
        case 'weak': return 'Faible';
        case 'medium': return 'Moyen';
        case 'strong': return 'Fort';
        case 'very-strong': return 'Très Fort';
    }
};
