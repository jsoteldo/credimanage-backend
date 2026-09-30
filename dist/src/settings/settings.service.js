"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettingsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const audit_service_1 = require("../audit/audit.service");
const settings_constants_1 = require("./settings.constants");
let SettingsService = class SettingsService {
    prisma;
    auditService;
    constructor(prisma, auditService) {
        this.prisma = prisma;
        this.auditService = auditService;
    }
    async getSetting(key) {
        const setting = await this.prisma.systemSetting.findUnique({
            where: { key },
        });
        return setting?.value ?? null;
    }
    async setSetting(key, value, user, description) {
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
            await this.auditService.logAudit(user.id, user.name, user.role, 'ACTUALIZAR_CONFIGURACION', `Configuración ${key} actualizada por ${user.name}`, setting.id);
        }
        return setting;
    }
    async getWhatsAppReminderTemplate() {
        const setting = await this.prisma.systemSetting.findUnique({
            where: { key: settings_constants_1.WHATSAPP_COLLECTION_REMINDER_KEY },
        });
        if (setting && setting.value && setting.value.trim() !== '') {
            return {
                key: settings_constants_1.WHATSAPP_COLLECTION_REMINDER_KEY,
                template: setting.value,
                isDefault: false,
                allowedVariables: settings_constants_1.ALLOWED_WHATSAPP_REMINDER_VARIABLES,
                defaultTemplate: settings_constants_1.DEFAULT_WHATSAPP_REMINDER_TEMPLATE,
            };
        }
        return {
            key: settings_constants_1.WHATSAPP_COLLECTION_REMINDER_KEY,
            template: settings_constants_1.DEFAULT_WHATSAPP_REMINDER_TEMPLATE,
            isDefault: true,
            allowedVariables: settings_constants_1.ALLOWED_WHATSAPP_REMINDER_VARIABLES,
            defaultTemplate: settings_constants_1.DEFAULT_WHATSAPP_REMINDER_TEMPLATE,
        };
    }
    async updateWhatsAppReminderTemplate(template, user) {
        if (typeof template !== 'string' || template.trim() === '') {
            throw new common_1.BadRequestException('La plantilla no puede estar vacía');
        }
        const validation = (0, settings_constants_1.validateTemplateVariables)(template);
        if (!validation.isValid) {
            if (validation.invalidVariables.length === 1) {
                throw new common_1.BadRequestException(`Variable no reconocida: ${validation.invalidVariables[0]}`);
            }
            throw new common_1.BadRequestException(`Variables no reconocidas: ${validation.invalidVariables.join(', ')}`);
        }
        const setting = await this.prisma.systemSetting.upsert({
            where: { key: settings_constants_1.WHATSAPP_COLLECTION_REMINDER_KEY },
            update: {
                value: template,
                description: 'Plantilla de recordatorio de cobranza por WhatsApp',
            },
            create: {
                key: settings_constants_1.WHATSAPP_COLLECTION_REMINDER_KEY,
                value: template,
                description: 'Plantilla de recordatorio de cobranza por WhatsApp',
            },
        });
        if (user) {
            await this.auditService.logAudit(user.id, user.name, user.role, 'MODIFICAR_PLANTILLA_WHATSAPP', `Plantilla de cobranza WhatsApp actualizada por ${user.name}`, setting.id);
        }
        return {
            key: settings_constants_1.WHATSAPP_COLLECTION_REMINDER_KEY,
            template: setting.value,
            isDefault: false,
            allowedVariables: settings_constants_1.ALLOWED_WHATSAPP_REMINDER_VARIABLES,
            defaultTemplate: settings_constants_1.DEFAULT_WHATSAPP_REMINDER_TEMPLATE,
        };
    }
    async resetWhatsAppReminderTemplate(user) {
        await this.prisma.systemSetting.deleteMany({
            where: { key: settings_constants_1.WHATSAPP_COLLECTION_REMINDER_KEY },
        });
        if (user) {
            await this.auditService.logAudit(user.id, user.name, user.role, 'RESTAURAR_PLANTILLA_WHATSAPP', `Plantilla de cobranza WhatsApp restaurada a valor predeterminado por ${user.name}`);
        }
        return {
            key: settings_constants_1.WHATSAPP_COLLECTION_REMINDER_KEY,
            template: settings_constants_1.DEFAULT_WHATSAPP_REMINDER_TEMPLATE,
            isDefault: true,
            allowedVariables: settings_constants_1.ALLOWED_WHATSAPP_REMINDER_VARIABLES,
            defaultTemplate: settings_constants_1.DEFAULT_WHATSAPP_REMINDER_TEMPLATE,
        };
    }
};
exports.SettingsService = SettingsService;
exports.SettingsService = SettingsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], SettingsService);
//# sourceMappingURL=settings.service.js.map