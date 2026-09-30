import { Injectable, BadRequestException } from '@nestjs/common';
import { UserRole, SystemSetting } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  WHATSAPP_COLLECTION_REMINDER_KEY,
  DEFAULT_WHATSAPP_REMINDER_TEMPLATE,
  ALLOWED_WHATSAPP_REMINDER_VARIABLES,
  validateTemplateVariables,
} from './settings.constants';

export interface AuthenticatedUser {
  id: string;
  name: string;
  role: UserRole;
  email?: string;
  permissions?: string[];
}

@Injectable()
export class SettingsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async getSetting(key: string): Promise<string | null> {
    const setting = await this.prisma.systemSetting.findUnique({
      where: { key },
    });
    return setting?.value ?? null;
  }

  async setSetting(
    key: string,
    value: string,
    user?: AuthenticatedUser,
    description?: string,
  ): Promise<SystemSetting> {
    const setting = await this.prisma.systemSetting.upsert({
      where: { key },
      update: {
        value,
        ...(description ? { description } : {}),
      },
      create: {
        key,
        value,
        description: description || 'Configuración general del sistema',
      },
    });

    if (user) {
      await this.auditService.logAudit(
        user.id,
        user.name,
        user.role,
        'ACTUALIZAR_CONFIGURACION',
        `Configuración ${key} actualizada por ${user.name}`,
        setting.id,
      );
    }

    return setting;
  }

  async getWhatsAppReminderTemplate(): Promise<{
    key: string;
    template: string;
    isDefault: boolean;
    allowedVariables: string[];
    defaultTemplate: string;
  }> {
    const setting = await this.prisma.systemSetting.findUnique({
      where: { key: WHATSAPP_COLLECTION_REMINDER_KEY },
    });

    if (setting && setting.value && setting.value.trim() !== '') {
      return {
        key: WHATSAPP_COLLECTION_REMINDER_KEY,
        template: setting.value,
        isDefault: false,
        allowedVariables: ALLOWED_WHATSAPP_REMINDER_VARIABLES,
        defaultTemplate: DEFAULT_WHATSAPP_REMINDER_TEMPLATE,
      };
    }

    return {
      key: WHATSAPP_COLLECTION_REMINDER_KEY,
      template: DEFAULT_WHATSAPP_REMINDER_TEMPLATE,
      isDefault: true,
      allowedVariables: ALLOWED_WHATSAPP_REMINDER_VARIABLES,
      defaultTemplate: DEFAULT_WHATSAPP_REMINDER_TEMPLATE,
    };
  }

  async updateWhatsAppReminderTemplate(
    template: string,
    user?: AuthenticatedUser,
  ): Promise<{
    key: string;
    template: string;
    isDefault: boolean;
    allowedVariables: string[];
    defaultTemplate: string;
  }> {
    if (typeof template !== 'string' || template.trim() === '') {
      throw new BadRequestException('La plantilla no puede estar vacía');
    }

    const validation = validateTemplateVariables(template);
    if (!validation.isValid) {
      if (validation.invalidVariables.length === 1) {
        throw new BadRequestException(
          `Variable no reconocida: ${validation.invalidVariables[0]}`,
        );
      }
      throw new BadRequestException(
        `Variables no reconocidas: ${validation.invalidVariables.join(', ')}`,
      );
    }

    const setting = await this.prisma.systemSetting.upsert({
      where: { key: WHATSAPP_COLLECTION_REMINDER_KEY },
      update: {
        value: template,
        description: 'Plantilla de recordatorio de cobranza por WhatsApp',
      },
      create: {
        key: WHATSAPP_COLLECTION_REMINDER_KEY,
        value: template,
        description: 'Plantilla de recordatorio de cobranza por WhatsApp',
      },
    });

    if (user) {
      await this.auditService.logAudit(
        user.id,
        user.name,
        user.role,
        'MODIFICAR_PLANTILLA_WHATSAPP',
        `Plantilla de cobranza WhatsApp actualizada por ${user.name}`,
        setting.id,
      );
    }

    return {
      key: WHATSAPP_COLLECTION_REMINDER_KEY,
      template: setting.value,
      isDefault: false,
      allowedVariables: ALLOWED_WHATSAPP_REMINDER_VARIABLES,
      defaultTemplate: DEFAULT_WHATSAPP_REMINDER_TEMPLATE,
    };
  }

  async resetWhatsAppReminderTemplate(user?: AuthenticatedUser): Promise<{
    key: string;
    template: string;
    isDefault: boolean;
    allowedVariables: string[];
    defaultTemplate: string;
  }> {
    await this.prisma.systemSetting.deleteMany({
      where: { key: WHATSAPP_COLLECTION_REMINDER_KEY },
    });

    if (user) {
      await this.auditService.logAudit(
        user.id,
        user.name,
        user.role,
        'RESTAURAR_PLANTILLA_WHATSAPP',
        `Plantilla de cobranza WhatsApp restaurada a valor predeterminado por ${user.name}`,
      );
    }

    return {
      key: WHATSAPP_COLLECTION_REMINDER_KEY,
      template: DEFAULT_WHATSAPP_REMINDER_TEMPLATE,
      isDefault: true,
      allowedVariables: ALLOWED_WHATSAPP_REMINDER_VARIABLES,
      defaultTemplate: DEFAULT_WHATSAPP_REMINDER_TEMPLATE,
    };
  }
}
