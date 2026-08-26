import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async getBalanceReport(filter = 'Todos', query = '') {
    const where: any = {};

    if (query) {
      const q = query.toLowerCase().trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } },
        { clientNumber: { contains: q, mode: 'insensitive' } },
      ];
    }

    const normFilter = filter.toLowerCase().trim();
    if (normFilter === 'con deuda') {
      where.currentBalance = { gt: 0 };
    } else if (normFilter === 'sin deuda' || normFilter === 'pagado') {
      where.currentBalance = { lte: 0 };
    } else if (normFilter === 'saldo a favor') {
      where.currentBalance = { lt: 0 };
    }

    let list = await this.prisma.client.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    list = list.map((c) => ({
      ...c,
      paymentPeriod: c.paymentPeriod === 'DiaFijo' ? 'Día Fijo' : c.paymentPeriod,
    })) as any;

    if (normFilter === 'al límite') {
      list = list.filter(
        (c) => c.creditLimit > 0 && c.currentBalance >= c.creditLimit * 0.9 && c.currentBalance > 0
      );
    }

    const allClients = await this.prisma.client.findMany();
    const clientsWithDebt = allClients.filter((c) => c.currentBalance > 0);
    const totalClientsDebt = clientsWithDebt.length;
    const totalPortfolioAmount = clientsWithDebt.reduce((sum, c) => sum + c.currentBalance, 0);

    return {
      report: list,
      summary: {
        totalClientsDebt,
        totalPortfolioAmount,
      },
    };
  }

  async getDashboardKPIs() {
    const totalClients = await this.prisma.client.count();

    const activeClients = await this.prisma.client.findMany({
      where: { status: 'Activo' },
    });

    const clientsWithDebt = activeClients.filter((c) => c.currentBalance > 0).length;
    const totalPendingDebt = activeClients
      .filter((c) => c.currentBalance > 0)
      .reduce((sum, c) => sum + c.currentBalance, 0);
    const clientsWithBalanceInFavor = activeClients.filter((c) => c.currentBalance < 0).length;

    // Today's payments (Active)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const todayPayments = await this.prisma.payment.findMany({
      where: {
        status: 'Activo',
        date: {
          gte: today,
          lt: tomorrow,
        },
      },
    });

    const todayPaymentsTotal = todayPayments.reduce((sum, p) => sum + p.amount, 0);

    const clientsAtLimit = activeClients.filter(
      (c) => c.creditLimit > 0 && c.currentBalance >= c.creditLimit * 0.9 && c.currentBalance > 0
    );
    const clientsAtLimitCount = clientsAtLimit.length;
    const clientsAtLimitNames = clientsAtLimit.map((c) => c.name);

    return {
      totalClients,
      clientsWithDebt,
      totalPendingDebt,
      clientsWithBalanceInFavor,
      todayPaymentsTotal,
      todayPaymentsCount: todayPayments.length,
      clientsAtLimitCount,
      clientsAtLimitNames,
    };
  }
}
