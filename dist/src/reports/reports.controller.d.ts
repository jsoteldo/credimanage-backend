import { ReportsService } from './reports.service';
export declare class ReportsController {
    private reportsService;
    constructor(reportsService: ReportsService);
    getBalanceReport(filter?: string, q?: string): Promise<{
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
