import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
export interface SyncBalancesResult {
    dailyDebtBalance: number;
    bankDebtBalance: number;
    currentBalance: number;
    creditExposure: number;
    availableCredit: number | 'Sin límite';
    dailyDebtBalanceDecimal: Prisma.Decimal;
    bankDebtBalanceDecimal: Prisma.Decimal;
    currentBalanceDecimal: Prisma.Decimal;
    creditExposureDecimal: Prisma.Decimal;
    subsequentChargesSum: Prisma.Decimal;
    subsequentDailyPaymentsSum: Prisma.Decimal;
    subsequentAdjustmentsSum: Prisma.Decimal;
}
export declare function validatePaymentAllocations(paymentAmount: number | Prisma.Decimal, targetType: string | null | undefined, allocations: any[], loanIdReceived?: string, validClientLoanIds?: string[]): void;
export declare class BalanceSyncService {
    private prisma;
    constructor(prisma: PrismaService);
    syncClientBalances(clientId: string, tx?: Prisma.TransactionClient | any): Promise<SyncBalancesResult>;
}
