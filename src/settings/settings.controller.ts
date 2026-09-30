import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { SettingsService, AuthenticatedUser } from './settings.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

interface RequestWithUser {
  user?: AuthenticatedUser;
}

interface UpdateTemplateDto {
  template: string;
}

@UseGuards(JwtAuthGuard)
@Controller('crediApi/settings')
export class SettingsController {
  constructor(private settingsService: SettingsService) {}

  @Get('whatsapp-collection-reminder')
  async getWhatsAppReminderTemplate() {
    return this.settingsService.getWhatsAppReminderTemplate();
  }

  @UseGuards(RolesGuard)
  @Roles('Administrador')
  @Put('whatsapp-collection-reminder')
  async updateWhatsAppReminderTemplate(
    @Body() body: UpdateTemplateDto,
    @Req() req: RequestWithUser,
  ) {
    return this.settingsService.updateWhatsAppReminderTemplate(
      body?.template,
      req.user,
    );
  }

  @UseGuards(RolesGuard)
  @Roles('Administrador')
  @Post('whatsapp-collection-reminder/reset')
  async resetWhatsAppReminderTemplate(@Req() req: RequestWithUser) {
    return this.settingsService.resetWhatsAppReminderTemplate(req.user);
  }
}
