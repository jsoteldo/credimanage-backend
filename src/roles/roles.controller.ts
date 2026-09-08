import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { RolesService } from './roles.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('crediApi')
export class RolesController {
  constructor(private rolesService: RolesService) {}

  @Get('roles')
  @Roles('Administrador')
  async getRoles() {
    return this.rolesService.getRoles();
  }

  @Get('roles/:id')
  @Roles('Administrador')
  async getRoleById(@Param('id') id: string) {
    return this.rolesService.getRoleById(id);
  }

  @Post('roles')
  @Roles('Administrador')
  async createRole(@Body() body: any) {
    return this.rolesService.createRole(body);
  }

  @Put('roles/:id/permissions')
  @Roles('Administrador')
  async updateRolePermissions(
    @Param('id') id: string,
    @Body('permissions') permissions: string[],
  ) {
    return this.rolesService.updateRolePermissions(id, permissions || []);
  }

  @Get('permissions')
  @Roles('Administrador')
  async getAllPermissions() {
    return this.rolesService.getAllPermissions();
  }
}
