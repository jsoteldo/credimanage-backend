import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { InventoryService } from './inventory.service';
import {
  AddInventoryDto,
  AdjustInventoryDto,
  TransferInventoryDto,
  SetMinimumStockDto,
  GetStockQueryDto,
  GetMovementsQueryDto,
} from './inventory.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('crediApi/inventory')
export class InventoryController {
  constructor(private inventoryService: InventoryService) {}

  @Get('stock')
  @RequirePermissions('inventory.view')
  async getStock(@Query() query: GetStockQueryDto) {
    return this.inventoryService.getStock(query);
  }

  @Get('kpis')
  @RequirePermissions('inventory.view')
  async getKpis(@Query('locationId') locationId?: string) {
    return this.inventoryService.getKpis(locationId);
  }

  @Get('movements')
  @RequirePermissions('inventory.view')
  async getMovements(@Query() query: GetMovementsQueryDto) {
    return this.inventoryService.getMovements(query);
  }

  @Get('product/:productId')
  @RequirePermissions('inventory.view')
  async getProductStockDetails(@Param('productId') productId: string) {
    return this.inventoryService.getProductStockDetails(productId);
  }

  @Get('kit/:kitProductId/explode')
  @RequirePermissions('inventory.view')
  async explodeKitComponents(
    @Param('kitProductId') kitProductId: string,
    @Query('quantity') quantity?: string,
  ) {
    const qty = quantity ? parseFloat(quantity) : 1;
    return this.inventoryService.explodeKitComponents(kitProductId, qty);
  }

  @Post('entry')
  @RequirePermissions('inventory.entry')
  async addInventory(@Body() dto: AddInventoryDto, @Req() req: any) {
    return this.inventoryService.addInventory(dto, req.user);
  }

  @Post('adjust')
  @RequirePermissions('inventory.adjust')
  async adjustInventory(@Body() dto: AdjustInventoryDto, @Req() req: any) {
    return this.inventoryService.adjustInventory(dto, req.user);
  }

  @Post('transfer')
  @RequirePermissions('inventory.transfer')
  async transferInventory(@Body() dto: TransferInventoryDto, @Req() req: any) {
    return this.inventoryService.transferInventory(dto, req.user);
  }

  @Patch('minimum-stock')
  @RequirePermissions('inventory.min_stock')
  async setMinimumStock(@Body() dto: SetMinimumStockDto, @Req() req: any) {
    return this.inventoryService.setMinimumStock(dto, req.user);
  }
}
