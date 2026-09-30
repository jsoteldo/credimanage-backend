import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { SettingsService, AuthenticatedUser } from './settings.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  DEFAULT_WHATSAPP_REMINDER_TEMPLATE,
  WHATSAPP_COLLECTION_REMINDER_KEY,
  validateTemplateVariables,
} from './settings.constants';

interface MockPrismaService {
  systemSetting: {
    findUnique: jest.Mock;
    upsert: jest.Mock;
    deleteMany: jest.Mock;
  };
}

interface MockAuditService {
  logAudit: jest.Mock;
}

describe('SettingsService & WhatsApp Collection Reminder Template', () => {
  let service: SettingsService;
  let prisma: MockPrismaService;
  let audit: MockAuditService;

  const mockAdminUser: AuthenticatedUser = {
    id: 'usr-admin-1',
    name: 'Admin Test',
    role: UserRole.Administrador,
  };

  beforeEach(async () => {
    prisma = {
      systemSetting: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
        deleteMany: jest.fn(),
      },
    };

    audit = {
      logAudit: jest.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettingsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = module.get<SettingsService>(SettingsService);
  });

  describe('Validation: validateTemplateVariables', () => {
    it('accepts template with all valid variables', () => {
      const template =
        'Hola {cliente} ({codigoCliente}), saldo {saldoPendiente}, diaria {deudaCorriente}, banco {deudaBancaria}, total {saldoConsolidado}, fecha {proximaFechaPago}.';
      const result = validateTemplateVariables(template);
      expect(result.isValid).toBe(true);
      expect(result.invalidVariables).toEqual([]);
    });

    it('rejects template with unknown variable such as {saldo}', () => {
      const template = 'Hola {cliente}, su saldo es {saldo}.';
      const result = validateTemplateVariables(template);
      expect(result.isValid).toBe(false);
      expect(result.invalidVariables).toEqual(['{saldo}']);
    });

    it('rejects template with multiple unknown variables', () => {
      const template =
        'Hola {cliente}, cuenta {numeroCuenta} y monto {montoTotal}.';
      const result = validateTemplateVariables(template);
      expect(result.isValid).toBe(false);
      expect(result.invalidVariables).toEqual([
        '{numeroCuenta}',
        '{montoTotal}',
      ]);
    });
  });

  describe('getWhatsAppReminderTemplate', () => {
    it('D. returns default template if no setting exists in DB', async () => {
      prisma.systemSetting.findUnique.mockResolvedValue(null);

      const result = await service.getWhatsAppReminderTemplate();
      expect(result.isDefault).toBe(true);
      expect(result.template).toBe(DEFAULT_WHATSAPP_REMINDER_TEMPLATE);
      expect(result.key).toBe(WHATSAPP_COLLECTION_REMINDER_KEY);
      expect(result.allowedVariables).toBeDefined();
    });

    it('A. returns persisted template when record exists in DB', async () => {
      const customTemplate =
        'Recordatorio especial: {cliente}, debe {saldoPendiente}.';
      prisma.systemSetting.findUnique.mockResolvedValue({
        id: 'set-1',
        key: WHATSAPP_COLLECTION_REMINDER_KEY,
        value: customTemplate,
      });

      const result = await service.getWhatsAppReminderTemplate();
      expect(result.isDefault).toBe(false);
      expect(result.template).toBe(customTemplate);
    });
  });

  describe('updateWhatsAppReminderTemplate', () => {
    it('B. allows Admin to update template with valid variables and logs audit', async () => {
      const customTemplate =
        'Estimado/a {cliente}, recordamos su pago de {saldoPendiente} para {proximaFechaPago}.';
      prisma.systemSetting.upsert.mockResolvedValue({
        id: 'set-1',
        key: WHATSAPP_COLLECTION_REMINDER_KEY,
        value: customTemplate,
      });

      const result = await service.updateWhatsAppReminderTemplate(
        customTemplate,
        mockAdminUser,
      );

      expect(result.template).toBe(customTemplate);
      expect(result.isDefault).toBe(false);
      expect(prisma.systemSetting.upsert).toHaveBeenCalledWith({
        where: { key: WHATSAPP_COLLECTION_REMINDER_KEY },
        update: {
          value: customTemplate,
          description: 'Plantilla de recordatorio de cobranza por WhatsApp',
        },
        create: {
          key: WHATSAPP_COLLECTION_REMINDER_KEY,
          value: customTemplate,
          description: 'Plantilla de recordatorio de cobranza por WhatsApp',
        },
      });
      expect(audit.logAudit).toHaveBeenCalledWith(
        mockAdminUser.id,
        mockAdminUser.name,
        mockAdminUser.role,
        'MODIFICAR_PLANTILLA_WHATSAPP',
        expect.any(String),
        'set-1',
      );
    });

    it('I. throws BadRequestException when template has unrecognized variable like {saldo}', async () => {
      const invalidTemplate = 'Hola {cliente}, su saldo es {saldo}.';

      await expect(
        service.updateWhatsAppReminderTemplate(invalidTemplate, mockAdminUser),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.updateWhatsAppReminderTemplate(invalidTemplate, mockAdminUser),
      ).rejects.toThrow('Variable no reconocida: {saldo}');

      expect(prisma.systemSetting.upsert).not.toHaveBeenCalled();
    });

    it('rejects empty or whitespace-only template', async () => {
      await expect(
        service.updateWhatsAppReminderTemplate('   ', mockAdminUser),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('K. resetWhatsAppReminderTemplate', () => {
    it('deletes custom setting and returns default template', async () => {
      prisma.systemSetting.deleteMany.mockResolvedValue({ count: 1 });

      const result = await service.resetWhatsAppReminderTemplate(mockAdminUser);
      expect(result.isDefault).toBe(true);
      expect(result.template).toBe(DEFAULT_WHATSAPP_REMINDER_TEMPLATE);
      expect(prisma.systemSetting.deleteMany).toHaveBeenCalledWith({
        where: { key: WHATSAPP_COLLECTION_REMINDER_KEY },
      });
      expect(audit.logAudit).toHaveBeenCalledWith(
        mockAdminUser.id,
        mockAdminUser.name,
        mockAdminUser.role,
        'RESTAURAR_PLANTILLA_WHATSAPP',
        expect.any(String),
      );
    });
  });
});
