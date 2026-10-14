import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CashRegisterStatus } from '@prisma/client';
import { CashService } from './cash.service';
import {
  CreateCashRegisterDto,
  UpdateCashRegisterDto,
  OpenCashSessionDto,
  CloseCashSessionDto,
  CreateCashMovementDto,
  ReceiptConfigDto,
  GetCashSessionsQueryDto,
  GetCashMovementsQueryDto,
} from './cash.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller(['crediApi/cash', 'api/cash'])
export class CashController {
  constructor(private readonly cashService: CashService) {}

  // -------------------------------------------------------------------------
  // CAJAS (CASH REGISTERS)
  // -------------------------------------------------------------------------

  @Post('registers')
  @Roles('Administrador')
  @RequirePermissions('cash.manage')
  async createRegister(
    @Body() dto: CreateCashRegisterDto,
    @Req() req: any,
  ) {
    return this.cashService.createCashRegister(dto, req.user);
  }

  @Get('registers')
  async getRegisters(@Query('storeId') storeId?: string) {
    return this.cashService.getCashRegisters(storeId);
  }

  @Put('registers/:id')
  @Roles('Administrador')
  @RequirePermissions('cash.manage')
  async updateRegister(
    @Param('id') id: string,
    @Body() dto: UpdateCashRegisterDto,
    @Req() req: any,
  ) {
    return this.cashService.updateCashRegister(id, dto, req.user);
  }

  @Patch('registers/:id/status')
  @Roles('Administrador')
  @RequirePermissions('cash.manage')
  async updateRegisterStatus(
    @Param('id') id: string,
    @Body('status') status: CashRegisterStatus,
    @Req() req: any,
  ) {
    return this.cashService.updateCashRegister(id, { status }, req.user);
  }

  // -------------------------------------------------------------------------
  // SESIONES / TURNOS (CASH SESSIONS)
  // -------------------------------------------------------------------------

  @Get('sessions/current')
  async getCurrentSession(
    @Query('storeId') storeId: string,
    @Req() req: any,
  ) {
    return this.cashService.getCurrentSession(req.user, storeId);
  }

  @Post('sessions/open')
  async openSession(@Body() dto: OpenCashSessionDto, @Req() req: any) {
    return this.cashService.openSession(dto, req.user);
  }

  @Post('sessions/:id/close')
  async closeSession(
    @Param('id') id: string,
    @Body() dto: CloseCashSessionDto,
    @Req() req: any,
  ) {
    return this.cashService.closeSession(id, dto, req.user);
  }

  @Get('sessions')
  async getSessionsHistory(@Query() query: GetCashSessionsQueryDto) {
    return this.cashService.getSessionsHistory(query);
  }

  @Get('sessions/:id')
  async getSessionById(@Param('id') id: string) {
    return this.cashService.getSessionById(id);
  }

  @Get('sessions/:id/summary')
  async getSessionSummary(@Param('id') id: string) {
    return this.cashService.calculateSessionSummary(id);
  }

  // -------------------------------------------------------------------------
  // MOVIMIENTOS DE CAJA (CASH MOVEMENTS)
  // -------------------------------------------------------------------------

  @Post('sessions/:id/movements')
  async addManualMovement(
    @Param('id') id: string,
    @Body() dto: CreateCashMovementDto,
    @Req() req: any,
  ) {
    return this.cashService.addManualMovement(id, dto, req.user);
  }

  @Get('movements')
  async getMovements(@Query() query: GetCashMovementsQueryDto) {
    return this.cashService.getMovements(query);
  }

  // -------------------------------------------------------------------------
  // CONFIGURACIÓN DE COMPROBANTE
  // -------------------------------------------------------------------------

  @Get('receipt-config')
  async getReceiptConfig(@Query('storeId') storeId?: string) {
    return this.cashService.getReceiptConfig(storeId);
  }

  @Put('receipt-config')
  @UseGuards(RolesGuard)
  @Roles('Administrador')
  async updateReceiptConfig(
    @Body() dto: ReceiptConfigDto,
    @Query('storeId') storeId: string,
    @Req() req: any,
  ) {
    return this.cashService.updateReceiptConfig(dto, req.user, storeId);
  }
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller(['crediApi/sales', 'api/sales'])
export class ReceiptSalesController {
  constructor(private readonly cashService: CashService) {}

  @Get(':saleId/receipt')
  async getSaleReceipt(@Param('saleId') saleId: string) {
    return this.cashService.getReceiptBySaleId(saleId);
  }

  @Post(':saleId/receipt/reprint')
  async reprintSaleReceipt(
    @Param('saleId') saleId: string,
    @Req() req: any,
  ) {
    return this.cashService.reprintReceipt(saleId, req.user);
  }
}

@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller(['crediApi/stores/:storeId/cash-registers', 'api/stores/:storeId/cash-registers'])
export class StoreCashRegistersController {
  constructor(private readonly cashService: CashService) {}

  @Get()
  async getRegisters(@Param('storeId') storeId: string) {
    return this.cashService.getCashRegisters(storeId);
  }

  @Post()
  @Roles('Administrador')
  @RequirePermissions('cash.manage')
  async createRegister(
    @Param('storeId') storeId: string,
    @Body() dto: CreateCashRegisterDto,
    @Req() req: any,
  ) {
    return this.cashService.createCashRegister({ ...dto, storeId }, req.user);
  }
}

@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller(['crediApi/cash-registers', 'api/cash-registers'])
export class CashRegistersDirectController {
  constructor(private readonly cashService: CashService) {}

  @Get()
  async getRegisters(@Query('storeId') storeId?: string) {
    return this.cashService.getCashRegisters(storeId);
  }

  @Put(':id')
  @Roles('Administrador')
  @RequirePermissions('cash.manage')
  async updateRegister(
    @Param('id') id: string,
    @Body() dto: UpdateCashRegisterDto,
    @Req() req: any,
  ) {
    return this.cashService.updateCashRegister(id, dto, req.user);
  }

  @Patch(':id/status')
  @Roles('Administrador')
  @RequirePermissions('cash.manage')
  async updateRegisterStatus(
    @Param('id') id: string,
    @Body('status') status: CashRegisterStatus,
    @Req() req: any,
  ) {
    return this.cashService.updateCashRegister(id, { status }, req.user);
  }
}

