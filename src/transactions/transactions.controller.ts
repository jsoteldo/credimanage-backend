import { Controller, Post, Get, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class TransactionsController {
  constructor(private transactionsService: TransactionsService) {}

  @Post('crediApi/clients/:id/credit-purchase')
  async addCreditPurchase(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.transactionsService.addCreditPurchase(id, body, req.user);
  }

  @Post('crediApi/clients/:id/loans')
  async createLoanCredit(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.transactionsService.createLoanCredit(id, body, req.user);
  }

  @Get('crediApi/clients/:id/loans')
  async getClientLoans(@Param('id') id: string) {
    return this.transactionsService.getClientLoans(id);
  }

  @Get('crediApi/loans/:id')
  async getLoanById(@Param('id') id: string) {
    return this.transactionsService.getLoanById(id);
  }

  @Roles('Administrador')
  @Post('crediApi/loans/:id/annul')
  async annulLoan(@Param('id') id: string, @Body('reason') reason: string, @Req() req: any) {
    return this.transactionsService.annulLoan(id, reason, req.user);
  }

  @Post('crediApi/clients/:id/payment')
  async registerPayment(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.transactionsService.registerPayment(id, body, req.user);
  }

  @Roles('Administrador')
  @Post('crediApi/payments/:id/annul')
  async annulPayment(@Param('id') id: string, @Body('reason') reason: string, @Req() req: any) {
    return this.transactionsService.annulPayment(id, reason, req.user);
  }

  @Roles('Administrador')
  @Get('crediApi/payments/pending')
  async getPendingPayments() {
    return this.transactionsService.getPendingPayments();
  }

  @Roles('Administrador')
  @Post('crediApi/payments/:id/approve')
  async approvePayment(@Param('id') id: string, @Req() req: any) {
    return this.transactionsService.approvePayment(id, req.user);
  }

  @Roles('Administrador')
  @Post('crediApi/payments/:id/reject')
  async rejectPayment(@Param('id') id: string, @Body('reason') reason: string, @Req() req: any) {
    return this.transactionsService.rejectPayment(id, reason, req.user);
  }

  @Get('crediApi/payments/history')
  async getPaymentsHistory(
    @Query('dateFilter') dateFilter?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('q') query?: string
  ) {
    return this.transactionsService.getPaymentsHistory({ dateFilter, startDate, endDate, query });
  }

  @Get('crediApi/purchases/history')
  async getPurchasesHistory(
    @Query('dateFilter') dateFilter?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('q') query?: string
  ) {
    return this.transactionsService.getPurchasesHistory({ dateFilter, startDate, endDate, query });
  }
}
