import { UserRole, SystemSetting } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
export interface AuthenticatedUser {
    id: string;
    name: string;
    role: UserRole;
    email?: string;
    permissions?: string[];
}
export declare class SettingsService {
    private prisma;
    private auditService;
    constructor(prisma: PrismaService, auditService: AuditService);
    getSetting(key: string): Promise<string | null>;
    setSetting(key: string, value: string, user?: AuthenticatedUser, description?: string): Promise<SystemSetting>;
    getWhatsAppReminderTemplate(): Promise<{
        key: string;
        template: string;
        isDefault: boolean;
        allowedVariables: string[];
        defaultTemplate: string;
    }>;
    updateWhatsAppReminderTemplate(template: string, user?: AuthenticatedUser): Promise<{
        key: string;
        template: string;
        isDefault: boolean;
        allowedVariables: string[];
        defaultTemplate: string;
    }>;
    resetWhatsAppReminderTemplate(user?: AuthenticatedUser): Promise<{
        key: string;
        template: string;
        isDefault: boolean;
        allowedVariables: string[];
        defaultTemplate: string;
    }>;
}
