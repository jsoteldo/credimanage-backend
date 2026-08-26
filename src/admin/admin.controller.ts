import { Controller, Get, Post, Put, Patch, Body, Param, UseGuards, Req } from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Administrador')
@Controller('crediApi/admin')
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Get('users')
  async getUsers() {
    return this.adminService.getUsers();
  }

  @Post('users')
  async createUser(@Body() body: any, @Req() req: any) {
    return this.adminService.createUser(body, req.user);
  }

  @Put('users/:id/role')
  async updateUserPermissions(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.adminService.updateUserPermissions(id, body, req.user);
  }

  @Patch('users/:id')
  async updateUser(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.adminService.updateUser(id, body, req.user);
  }

  @Patch('users/:id/approve')
  async approveUser(@Param('id') id: string, @Req() req: any) {
    return this.adminService.approveUser(id, req.user);
  }

  @Patch('users/:id/enable')
  async enableUser(@Param('id') id: string, @Req() req: any) {
    return this.adminService.enableUser(id, req.user);
  }

  @Patch('users/:id/disable')
  async disableUser(@Param('id') id: string, @Req() req: any) {
    return this.adminService.disableUser(id, req.user);
  }

  @Get('audit-logs')
  async getAuditLogs() {
    return this.adminService.getAuditLogs();
  }

  @Get('annulled-operations')
  async getAnnulledOperations() {
    return this.adminService.getAnnulledOperations();
  }
}
