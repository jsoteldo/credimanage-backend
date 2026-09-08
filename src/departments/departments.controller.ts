import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { DepartmentsService } from './departments.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('crediApi/departments')
export class DepartmentsController {
  constructor(private departmentsService: DepartmentsService) {}

  @Get()
  @RequirePermissions('department.view')
  async getDepartments(
    @Query('active') active?: string,
    @Query('q') q?: string,
  ) {
    return this.departmentsService.getDepartments({ active, q });
  }

  @Get(':id')
  @RequirePermissions('department.view')
  async getDepartmentById(@Param('id') id: string) {
    return this.departmentsService.getDepartmentById(id);
  }

  @Post()
  @RequirePermissions('department.manage')
  async createDepartment(@Body() body: any) {
    return this.departmentsService.createDepartment(body);
  }

  @Put(':id')
  @RequirePermissions('department.manage')
  async updateDepartment(@Param('id') id: string, @Body() body: any) {
    return this.departmentsService.updateDepartment(id, body);
  }

  @Patch(':id/deactivate')
  @RequirePermissions('department.manage')
  async deactivateDepartment(@Param('id') id: string) {
    return this.departmentsService.deactivateDepartment(id);
  }

  @Patch(':id/reactivate')
  @RequirePermissions('department.manage')
  async reactivateDepartment(@Param('id') id: string) {
    return this.departmentsService.reactivateDepartment(id);
  }

  @Delete(':id')
  @RequirePermissions('department.manage')
  async deleteDepartment(@Param('id') id: string) {
    return this.departmentsService.deleteDepartment(id);
  }
}
