import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller()
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @Get('crediApi/reports/balance')
  async getBalanceReport(@Query('filter') filter?: string, @Query('q') q?: string) {
    return this.reportsService.getBalanceReport(filter, q);
  }

  @Get('crediApi/dashboard/kpis')
  async getDashboardKPIs() {
    return this.reportsService.getDashboardKPIs();
  }
}
