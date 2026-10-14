import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SalesService } from './sales.service';
import { CreateSaleDto, UpdateSaleDto, AnnulSaleDto, GetSalesQueryDto } from './sales.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller(['crediApi/sales', 'api/sales'])
export class SalesController {
  constructor(private salesService: SalesService) {}

  @Get()
  @RequirePermissions('sales.view')
  async getSales(@Query() query: GetSalesQueryDto) {
    return this.salesService.getSales(query);
  }

  @Get(':id')
  @RequirePermissions('sales.view')
  async getSaleById(@Param('id') id: string) {
    return this.salesService.getSaleById(id);
  }

  @Post()
  @RequirePermissions('sales.create')
  async createSale(@Body() body: CreateSaleDto, @Req() req: any) {
    return this.salesService.createSale(body, req.user);
  }

  @Put(':id')
  @RequirePermissions('sales.create')
  async updateSale(
    @Param('id') id: string,
    @Body() body: UpdateSaleDto,
    @Req() req: any,
  ) {
    return this.salesService.updateSale(id, body, req.user);
  }

  @Post(':id/annul')
  @RequirePermissions('sales.annul')
  async annulSale(
    @Param('id') id: string,
    @Body() body: AnnulSaleDto,
    @Req() req: any,
  ) {
    return this.salesService.annulSale(id, body, req.user);
  }
}
