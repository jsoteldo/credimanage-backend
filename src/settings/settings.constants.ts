export const WHATSAPP_COLLECTION_REMINDER_KEY =
  'WHATSAPP_COLLECTION_REMINDER_TEMPLATE';

export const DEFAULT_WHATSAPP_REMINDER_TEMPLATE = `Hola {cliente}, te recordamos que actualmente tienes un saldo pendiente de {saldoPendiente}.

Tu próxima fecha de pago es {proximaFechaPago}.

Si tienes alguna consulta sobre tu estado de cuenta, puedes comunicarte con nosotros.

Gracias.`;

export const ALLOWED_WHATSAPP_REMINDER_VARIABLES = [
  '{cliente}',
  '{codigoCliente}',
  '{saldoPendiente}',
  '{deudaCorriente}',
  '{deudaBancaria}',
  '{saldoConsolidado}',
  '{proximaFechaPago}',
];

export interface ValidationResult {
  isValid: boolean;
  invalidVariables: string[];
}

export function extractTemplateVariables(template: string): string[] {
  const matches = template.match(/\{[^{}]+\}/g);
  if (!matches) return [];
  // Return unique matches
  return Array.from(new Set(matches));
}

export function validateTemplateVariables(
  template: string,
  allowedVariables: string[] = ALLOWED_WHATSAPP_REMINDER_VARIABLES,
): ValidationResult {
  if (typeof template !== 'string') {
    return { isValid: false, invalidVariables: ['[plantilla inválida]'] };
  }
  const variables = extractTemplateVariables(template);
  const invalidVariables = variables.filter(
    (v) => !allowedVariables.includes(v),
  );
  return {
    isValid: invalidVariables.length === 0,
    invalidVariables,
  };
}
