import { PrismaService } from '../prisma/prisma.service';
export declare class ReportsService {
    private prisma;
    constructor(prisma: PrismaService);
    getBalanceReport(filter?: string, query?: string): Promise<{
        report: {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            clientNumber: string;
            phone: string;
            address: string;
            creditLimit: number;
            currentBalance: number;
            paymentPeriod: import("@prisma/client").$Enums.PaymentPeriod;
            paymentDay: string;
            nextDueDate: string;
            status: import("@prisma/client").$Enums.ClientStatus;
        }[];
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
