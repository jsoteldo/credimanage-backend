import { PrismaService } from '../prisma/prisma.service';
export declare class ReportsService {
    private prisma;
    constructor(prisma: PrismaService);
    getBalanceReport(filter?: string, query?: string): Promise<{
        report: any[];
        summary: {
            totalClientsDebt: number;
            totalPortfolioAmount: number;
        };
    }>;
    getDashboardKPIs(): Promise<{
        totalClients: number;
        clientsWithDebt: number;
        totalPendingDebt: number;
        clientsWithBalanceInFavor: number;
        todayPaymentsTotal: number;
        todayPaymentsCount: number;
        clientsAtLimitCount: number;
        clientsAtLimitNames: string[];
    }>;
}
