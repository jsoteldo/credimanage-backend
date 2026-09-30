export declare const WHATSAPP_COLLECTION_REMINDER_KEY = "WHATSAPP_COLLECTION_REMINDER_TEMPLATE";
export declare const DEFAULT_WHATSAPP_REMINDER_TEMPLATE = "Hola {cliente}, te recordamos que actualmente tienes un saldo pendiente de {saldoPendiente}.\n\nTu pr\u00F3xima fecha de pago es {proximaFechaPago}.\n\nSi tienes alguna consulta sobre tu estado de cuenta, puedes comunicarte con nosotros.\n\nGracias.";
export declare const ALLOWED_WHATSAPP_REMINDER_VARIABLES: string[];
export interface ValidationResult {
    isValid: boolean;
    invalidVariables: string[];
}
export declare function extractTemplateVariables(template: string): string[];
export declare function validateTemplateVariables(template: string, allowedVariables?: string[]): ValidationResult;
