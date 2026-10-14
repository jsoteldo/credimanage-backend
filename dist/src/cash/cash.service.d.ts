import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SettingsService } from '../settings/settings.service';
import { CreateCashRegisterDto, UpdateCashRegisterDto, OpenCashSessionDto, CloseCashSessionDto, CreateCashMovementDto, ReceiptConfigDto, GetCashSessionsQueryDto, GetCashMovementsQueryDto } from './cash.dto';
import { Prisma } from '@prisma/client';
export declare const DEFAULT_RECEIPT_CONFIG: {
    businessName: string;
    secondaryText: string;
    address: string;
    phone: string;
    footerMessage: string;
    paperWidth: string;
    showLogo: boolean;
    showProductCode: boolean;
    showCustomer: boolean;
    showCashier: boolean;
    showStore: boolean;
    showPaymentMethods: boolean;
    series: string;
};
export declare class CashService {
    private prisma;
    private auditService;
    private settingsService;
    constructor(prisma: PrismaService, auditService: AuditService, settingsService: SettingsService);
    createCashRegister(dto: CreateCashRegisterDto, user: any, businessId?: string): Promise<{
        store: {
            id: string;
            name: string;
            code: string | null;
        };
    } & {
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        code: string;
        status: import("@prisma/client").$Enums.CashRegisterStatus;
        businessId: string;
        storeId: string;
    }>;
    getCashRegisters(storeId?: string, businessId?: string): Promise<{
        activeSession: {
            openedByUser: {
                id: string;
                email: string;
                name: string;
            };
        } & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            status: import("@prisma/client").$Enums.CashSessionStatus;
            notes: string | null;
            businessId: string;
            cashRegisterId: string;
            storeId: string;
            openedByUserId: string;
            openedAt: Date;
            openingCashAmount: Prisma.Decimal;
            closedAt: Date | null;
            closedByUserId: string | null;
            expectedCashAmount: Prisma.Decimal | null;
            countedCashAmount: Prisma.Decimal | null;
            differenceAmount: Prisma.Decimal | null;
        };
        store: {
            id: string;
            name: string;
            code: string | null;
        };
        sessions: ({
            openedByUser: {
                id: string;
                email: string;
                name: string;
            };
        } & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            status: import("@prisma/client").$Enums.CashSessionStatus;
            notes: string | null;
            businessId: string;
            cashRegisterId: string;
            storeId: string;
            openedByUserId: string;
            openedAt: Date;
            openingCashAmount: Prisma.Decimal;
            closedAt: Date | null;
            closedByUserId: string | null;
            expectedCashAmount: Prisma.Decimal | null;
            countedCashAmount: Prisma.Decimal | null;
            differenceAmount: Prisma.Decimal | null;
        })[];
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        code: string;
        status: import("@prisma/client").$Enums.CashRegisterStatus;
        businessId: string;
        storeId: string;
    }[]>;
    updateCashRegister(id: string, dto: UpdateCashRegisterDto, user: any, businessId?: string): Promise<{
        store: {
            id: string;
            name: string;
            code: string | null;
        };
    } & {
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        code: string;
        status: import("@prisma/client").$Enums.CashRegisterStatus;
        businessId: string;
        storeId: string;
    }>;
    getCurrentSession(user: any, storeId?: string, businessId?: string): Promise<any>;
    private sanitizeSession;
    openSession(dto: OpenCashSessionDto, user: any, businessId?: string): Promise<any>;
    calculateSessionSummary(sessionId: string, txClient?: Prisma.TransactionClient): Promise<{
        openingCash: number;
        cashSales: number;
        yapeSales: number;
        plinSales: number;
        cardSales: number;
        transferSales: number;
        creditSales: number;
        cashIn: number;
        cashOut: number;
        cashDebtPayments: number;
        cashLoanPayments: number;
        cashSaleReversals: number;
        expectedCashAmount: number;
        totalSalesAmount: number;
        salesCount: number;
        methodsSummary: {
            CASH: number;
            YAPE: number;
            PLIN: number;
            CARD: number;
            TRANSFER: number;
            CREDIT: number;
        };
    }>;
    checkMovementPermission(user: any, type: 'CASH_IN' | 'CASH_OUT'): Promise<void>;
    addManualMovement(sessionId: string, dto: CreateCashMovementDto, user: any, businessId?: string): Promise<{
        movement: {
            id: string;
            createdAt: Date;
            description: string | null;
            amount: Prisma.Decimal;
            saleId: string | null;
            paymentMethod: import("@prisma/client").$Enums.SalePaymentMethod;
            notes: string | null;
            createdByUserId: string;
            businessId: string;
            cashRegisterId: string;
            storeId: string;
            type: import("@prisma/client").$Enums.CashMovementType;
            referenceType: string | null;
            referenceId: string | null;
            cashSessionId: string;
        };
        summary: {
            openingCash: number;
            cashSales: number;
            yapeSales: number;
            plinSales: number;
            cardSales: number;
            transferSales: number;
            creditSales: number;
            cashIn: number;
            cashOut: number;
            cashDebtPayments: number;
            cashLoanPayments: number;
            cashSaleReversals: number;
            expectedCashAmount: number;
            totalSalesAmount: number;
            salesCount: number;
            methodsSummary: {
                CASH: number;
                YAPE: number;
                PLIN: number;
                CARD: number;
                TRANSFER: number;
                CREDIT: number;
            };
        };
        warning: string | null;
    }>;
    closeSession(sessionId: string, dto: CloseCashSessionDto, user: any, businessId?: string): Promise<any>;
    getSessionById(sessionId: string, businessId?: string): Promise<any>;
    getSessionsHistory(query: GetCashSessionsQueryDto, businessId?: string): Promise<{
        items: any[];
        pagination: {
            total: number;
            page: number;
            limit: number;
            totalPages: number;
        };
    }>;
    getMovements(query: GetCashMovementsQueryDto, businessId?: string): Promise<{
        items: ({
            cashRegister: {
                id: string;
                name: string;
                code: string;
            };
            store: {
                id: string;
                name: string;
            };
            createdByUser: {
                id: string;
                name: string;
            };
        } & {
            id: string;
            createdAt: Date;
            description: string | null;
            amount: Prisma.Decimal;
            saleId: string | null;
            paymentMethod: import("@prisma/client").$Enums.SalePaymentMethod;
            notes: string | null;
            createdByUserId: string;
            businessId: string;
            cashRegisterId: string;
            storeId: string;
            type: import("@prisma/client").$Enums.CashMovementType;
            referenceType: string | null;
            referenceId: string | null;
            cashSessionId: string;
        })[];
        pagination: {
            total: number;
            page: number;
            limit: number;
            totalPages: number;
        };
    }>;
    getReceiptConfig(storeId?: string, businessId?: string): Promise<any>;
    updateReceiptConfig(dto: ReceiptConfigDto, user: any, storeId?: string, businessId?: string): Promise<any>;
    generateNextReceiptNumber(tx: Prisma.TransactionClient, series?: string, businessId?: string): Promise<{
        number: string;
        sequence: number;
        series: string;
    }>;
    getReceiptBySaleId(saleId: string): Promise<{
        sale: {
            client: {
                id: string;
                name: string;
                createdAt: Date;
                updatedAt: Date;
                clientNumber: string;
                status: import("@prisma/client").$Enums.ClientStatus;
                phone: string;
                address: string;
                creditLimit: number;
                currentBalance: number;
                dailyDebtBalance: Prisma.Decimal | null;
                bankDebtBalance: Prisma.Decimal | null;
                balanceModelVersion: string | null;
                balanceOrigin: string | null;
                paymentPeriod: import("@prisma/client").$Enums.PaymentPeriod;
                paymentDay: string;
                nextDueDate: string;
            } | null;
            payments: {
                id: string;
                createdAt: Date;
                amount: Prisma.Decimal;
                saleId: string;
                method: import("@prisma/client").$Enums.SalePaymentMethod;
                reference: string | null;
            }[];
            store: {
                id: string;
                name: string;
                active: boolean;
                createdAt: Date;
                updatedAt: Date;
                code: string | null;
                address: string | null;
                businessId: string;
                type: import("@prisma/client").$Enums.LocationType;
            };
            items: {
                id: string;
                createdAt: Date;
                unitPrice: Prisma.Decimal;
                quantity: number;
                saleId: string;
                productId: string;
                productCodeSnapshot: string;
                productNameSnapshot: string;
                lineTotal: Prisma.Decimal;
                productType: import("@prisma/client").$Enums.ProductSaleType;
            }[];
        } & {
            id: string;
            createdAt: Date;
            status: import("@prisma/client").$Enums.SaleStatus;
            clientId: string | null;
            annulledAt: Date | null;
            annulledBy: string | null;
            cardSurcharge: Prisma.Decimal | null;
            notes: string | null;
            businessId: string;
            storeId: string;
            cashSessionId: string | null;
            createdBy: string;
            total: Prisma.Decimal;
            cashReceived: Prisma.Decimal | null;
            saleNumber: string;
            subtotal: Prisma.Decimal;
            paymentStatus: string;
            cashChange: Prisma.Decimal | null;
            completedAt: Date | null;
            annulReason: string | null;
        };
    } & {
        number: string;
        id: string;
        createdAt: Date;
        saleId: string;
        notes: string | null;
        businessId: string;
        series: string;
        sequence: number;
        configSnapshot: Prisma.JsonValue;
        reprintedCount: number;
        lastReprintedAt: Date | null;
    }>;
    reprintReceipt(saleId: string, user: any): Promise<{
        sale: {
            client: {
                id: string;
                name: string;
                createdAt: Date;
                updatedAt: Date;
                clientNumber: string;
                status: import("@prisma/client").$Enums.ClientStatus;
                phone: string;
                address: string;
                creditLimit: number;
                currentBalance: number;
                dailyDebtBalance: Prisma.Decimal | null;
                bankDebtBalance: Prisma.Decimal | null;
                balanceModelVersion: string | null;
                balanceOrigin: string | null;
                paymentPeriod: import("@prisma/client").$Enums.PaymentPeriod;
                paymentDay: string;
                nextDueDate: string;
            } | null;
            payments: {
                id: string;
                createdAt: Date;
                amount: Prisma.Decimal;
                saleId: string;
                method: import("@prisma/client").$Enums.SalePaymentMethod;
                reference: string | null;
            }[];
            store: {
                id: string;
                name: string;
                active: boolean;
                createdAt: Date;
                updatedAt: Date;
                code: string | null;
                address: string | null;
                businessId: string;
                type: import("@prisma/client").$Enums.LocationType;
            };
            items: {
                id: string;
                createdAt: Date;
                unitPrice: Prisma.Decimal;
                quantity: number;
                saleId: string;
                productId: string;
                productCodeSnapshot: string;
                productNameSnapshot: string;
                lineTotal: Prisma.Decimal;
                productType: import("@prisma/client").$Enums.ProductSaleType;
            }[];
        } & {
            id: string;
            createdAt: Date;
            status: import("@prisma/client").$Enums.SaleStatus;
            clientId: string | null;
            annulledAt: Date | null;
            annulledBy: string | null;
            cardSurcharge: Prisma.Decimal | null;
            notes: string | null;
            businessId: string;
            storeId: string;
            cashSessionId: string | null;
            createdBy: string;
            total: Prisma.Decimal;
            cashReceived: Prisma.Decimal | null;
            saleNumber: string;
            subtotal: Prisma.Decimal;
            paymentStatus: string;
            cashChange: Prisma.Decimal | null;
            completedAt: Date | null;
            annulReason: string | null;
        };
    } & {
        number: string;
        id: string;
        createdAt: Date;
        saleId: string;
        notes: string | null;
        businessId: string;
        series: string;
        sequence: number;
        configSnapshot: Prisma.JsonValue;
        reprintedCount: number;
        lastReprintedAt: Date | null;
    }>;
}
