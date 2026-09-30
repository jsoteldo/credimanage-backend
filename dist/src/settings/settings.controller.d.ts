import { SettingsService, AuthenticatedUser } from './settings.service';
interface RequestWithUser {
    user?: AuthenticatedUser;
}
interface UpdateTemplateDto {
    template: string;
}
export declare class SettingsController {
    private settingsService;
    constructor(settingsService: SettingsService);
    getWhatsAppReminderTemplate(): Promise<{
        key: string;
        template: string;
        isDefault: boolean;
        allowedVariables: string[];
        defaultTemplate: string;
    }>;
    updateWhatsAppReminderTemplate(body: UpdateTemplateDto, req: RequestWithUser): Promise<{
        key: string;
        template: string;
        isDefault: boolean;
        allowedVariables: string[];
        defaultTemplate: string;
    }>;
    resetWhatsAppReminderTemplate(req: RequestWithUser): Promise<{
        key: string;
        template: string;
        isDefault: boolean;
        allowedVariables: string[];
        defaultTemplate: string;
    }>;
}
export {};
