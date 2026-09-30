"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ALLOWED_WHATSAPP_REMINDER_VARIABLES = exports.DEFAULT_WHATSAPP_REMINDER_TEMPLATE = exports.WHATSAPP_COLLECTION_REMINDER_KEY = void 0;
exports.extractTemplateVariables = extractTemplateVariables;
exports.validateTemplateVariables = validateTemplateVariables;
exports.WHATSAPP_COLLECTION_REMINDER_KEY = 'WHATSAPP_COLLECTION_REMINDER_TEMPLATE';
exports.DEFAULT_WHATSAPP_REMINDER_TEMPLATE = `Hola {cliente}, te recordamos que actualmente tienes un saldo pendiente de {saldoPendiente}.

Tu próxima fecha de pago es {proximaFechaPago}.

Si tienes alguna consulta sobre tu estado de cuenta, puedes comunicarte con nosotros.

Gracias.`;
exports.ALLOWED_WHATSAPP_REMINDER_VARIABLES = [
    '{cliente}',
    '{codigoCliente}',
    '{saldoPendiente}',
    '{deudaCorriente}',
    '{deudaBancaria}',
    '{saldoConsolidado}',
    '{proximaFechaPago}',
];
function extractTemplateVariables(template) {
    const matches = template.match(/\{[^{}]+\}/g);
    if (!matches)
        return [];
    return Array.from(new Set(matches));
}
function validateTemplateVariables(template, allowedVariables = exports.ALLOWED_WHATSAPP_REMINDER_VARIABLES) {
    if (typeof template !== 'string') {
        return { isValid: false, invalidVariables: ['[plantilla inválida]'] };
    }
    const variables = extractTemplateVariables(template);
    const invalidVariables = variables.filter((v) => !allowedVariables.includes(v));
    return {
        isValid: invalidVariables.length === 0,
        invalidVariables,
    };
}
//# sourceMappingURL=settings.constants.js.map