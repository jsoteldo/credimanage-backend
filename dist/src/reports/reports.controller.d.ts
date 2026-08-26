import { ReportsService } from './reports.service';
export declare class ReportsController {
    private reportsService;
    constructor(reportsService: ReportsService);
    getBalanceReport(filter?: string, q?: string): Promise<{
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
