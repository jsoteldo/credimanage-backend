import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SuppliersService } from './suppliers.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('crediApi/suppliers')
export class SuppliersController {
  constructor(private suppliersService: SuppliersService) {}

  @Get()
  @RequirePermissions('supplier.view')
  async getSuppliers(@Query('active') active?: string, @Query('q') q?: string) {
    return this.suppliersService.getSuppliers({ active, q });
  }

  @Get(':id')
  @RequirePermissions('supplier.view')
  async getSupplierById(@Param('id') id: string) {
    return this.suppliersService.getSupplierById(id);
  }

  @Post()
  @RequirePermissions('supplier.manage')
  async createSupplier(@Body() body: any) {
    return this.suppliersService.createSupplier(body);
  }

  @Put(':id')
  @RequirePermissions('supplier.manage')
  async updateSupplier(@Param('id') id: string, @Body() body: any) {
    return this.suppliersService.updateSupplier(id, body);
  }

  @Patch(':id/deactivate')
  @RequirePermissions('supplier.manage')
  async deactivateSupplier(@Param('id') id: string) {
    return this.suppliersService.deactivateSupplier(id);
  }

  @Patch(':id/reactivate')
  @RequirePermissions('supplier.manage')
  async reactivateSupplier(@Param('id') id: string) {
    return this.suppliersService.reactivateSupplier(id);
  }
}
