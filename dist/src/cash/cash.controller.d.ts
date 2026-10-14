import { CashRegisterStatus } from '@prisma/client';
import { CashService } from './cash.service';
import { CreateCashRegisterDto, UpdateCashRegisterDto, OpenCashSessionDto, CloseCashSessionDto, CreateCashMovementDto, ReceiptConfigDto, GetCashSessionsQueryDto, GetCashMovementsQueryDto } from './cash.dto';
export declare class CashController {
    private readonly cashService;
    constructor(cashService: CashService);
    createRegister(dto: CreateCashRegisterDto, req: any): Promise<{
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
    getRegisters(storeId?: string): Promise<{
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
            openingCashAmount: import("@prisma/client-runtime-utils").Decimal;
            closedAt: Date | null;
            closedByUserId: string | null;
            expectedCashAmount: import("@prisma/client-runtime-utils").Decimal | null;
            countedCashAmount: import("@prisma/client-runtime-utils").Decimal | null;
            differenceAmount: import("@prisma/client-runtime-utils").Decimal | null;
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
            openingCashAmount: import("@prisma/client-runtime-utils").Decimal;
            closedAt: Date | null;
            closedByUserId: string | null;
            expectedCashAmount: import("@prisma/client-runtime-utils").Decimal | null;
            countedCashAmount: import("@prisma/client-runtime-utils").Decimal | null;
            differenceAmount: import("@prisma/client-runtime-utils").Decimal | null;
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
    updateRegister(id: string, dto: UpdateCashRegisterDto, req: any): Promise<{
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
    updateRegisterStatus(id: string, status: CashRegisterStatus, req: any): Promise<{
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
    getCurrentSession(storeId: string, req: any): Promise<any>;
    openSession(dto: OpenCashSessionDto, req: any): Promise<any>;
    closeSession(id: string, dto: CloseCashSessionDto, req: any): Promise<any>;
    getSessionsHistory(query: GetCashSessionsQueryDto): Promise<{
        items: any[];
        pagination: {
            total: number;
            page: number;
            limit: number;
            totalPages: number;
        };
    }>;
    getSessionById(id: string): Promise<any>;
    getSessionSummary(id: string): Promise<{
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
    addManualMovement(id: string, dto: CreateCashMovementDto, req: any): Promise<{
        movement: {
            id: string;
            createdAt: Date;
            description: string | null;
            amount: import("@prisma/client-runtime-utils").Decimal;
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
    getMovements(query: GetCashMovementsQueryDto): Promise<{
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
            amount: import("@prisma/client-runtime-utils").Decimal;
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
    getReceiptConfig(storeId?: string): Promise<any>;
    updateReceiptConfig(dto: ReceiptConfigDto, storeId: string, req: any): Promise<any>;
}
export declare class ReceiptSalesController {
    private readonly cashService;
    constructor(cashService: CashService);
    getSaleReceipt(saleId: string): Promise<{
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
                dailyDebtBalance: import("@prisma/client-runtime-utils").Decimal | null;
                bankDebtBalance: import("@prisma/client-runtime-utils").Decimal | null;
                balanceModelVersion: string | null;
                balanceOrigin: string | null;
                paymentPeriod: import("@prisma/client").$Enums.PaymentPeriod;
                paymentDay: string;
                nextDueDate: string;
            } | null;
            payments: {
                id: string;
                createdAt: Date;
                amount: import("@prisma/client-runtime-utils").Decimal;
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
                unitPrice: import("@prisma/client-runtime-utils").Decimal;
                quantity: number;
                saleId: string;
                productId: string;
                productCodeSnapshot: string;
                productNameSnapshot: string;
                lineTotal: import("@prisma/client-runtime-utils").Decimal;
                productType: import("@prisma/client").$Enums.ProductSaleType;
            }[];
        } & {
            id: string;
            createdAt: Date;
            status: import("@prisma/client").$Enums.SaleStatus;
            clientId: string | null;
            annulledAt: Date | null;
            annulledBy: string | null;
            cardSurcharge: import("@prisma/client-runtime-utils").Decimal | null;
            notes: string | null;
            businessId: string;
            storeId: string;
            cashSessionId: string | null;
            createdBy: string;
            total: import("@prisma/client-runtime-utils").Decimal;
            cashReceived: import("@prisma/client-runtime-utils").Decimal | null;
            saleNumber: string;
            subtotal: import("@prisma/client-runtime-utils").Decimal;
            paymentStatus: string;
            cashChange: import("@prisma/client-runtime-utils").Decimal | null;
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
        configSnapshot: import("@prisma/client/runtime/client").JsonValue;
        reprintedCount: number;
        lastReprintedAt: Date | null;
    }>;
    reprintSaleReceipt(saleId: string, req: any): Promise<{
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
                dailyDebtBalance: import("@prisma/client-runtime-utils").Decimal | null;
                bankDebtBalance: import("@prisma/client-runtime-utils").Decimal | null;
                balanceModelVersion: string | null;
                balanceOrigin: string | null;
                paymentPeriod: import("@prisma/client").$Enums.PaymentPeriod;
                paymentDay: string;
                nextDueDate: string;
            } | null;
            payments: {
                id: string;
                createdAt: Date;
                amount: import("@prisma/client-runtime-utils").Decimal;
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
                unitPrice: import("@prisma/client-runtime-utils").Decimal;
                quantity: number;
                saleId: string;
                productId: string;
                productCodeSnapshot: string;
                productNameSnapshot: string;
                lineTotal: import("@prisma/client-runtime-utils").Decimal;
                productType: import("@prisma/client").$Enums.ProductSaleType;
            }[];
        } & {
            id: string;
            createdAt: Date;
            status: import("@prisma/client").$Enums.SaleStatus;
            clientId: string | null;
            annulledAt: Date | null;
            annulledBy: string | null;
            cardSurcharge: import("@prisma/client-runtime-utils").Decimal | null;
            notes: string | null;
            businessId: string;
            storeId: string;
            cashSessionId: string | null;
            createdBy: string;
            total: import("@prisma/client-runtime-utils").Decimal;
            cashReceived: import("@prisma/client-runtime-utils").Decimal | null;
            saleNumber: string;
            subtotal: import("@prisma/client-runtime-utils").Decimal;
            paymentStatus: string;
            cashChange: import("@prisma/client-runtime-utils").Decimal | null;
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
        configSnapshot: import("@prisma/client/runtime/client").JsonValue;
        reprintedCount: number;
        lastReprintedAt: Date | null;
    }>;
}
export declare class StoreCashRegistersController {
    private readonly cashService;
    constructor(cashService: CashService);
    getRegisters(storeId: string): Promise<{
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
            openingCashAmount: import("@prisma/client-runtime-utils").Decimal;
            closedAt: Date | null;
            closedByUserId: string | null;
            expectedCashAmount: import("@prisma/client-runtime-utils").Decimal | null;
            countedCashAmount: import("@prisma/client-runtime-utils").Decimal | null;
            differenceAmount: import("@prisma/client-runtime-utils").Decimal | null;
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
            openingCashAmount: import("@prisma/client-runtime-utils").Decimal;
            closedAt: Date | null;
            closedByUserId: string | null;
            expectedCashAmount: import("@prisma/client-runtime-utils").Decimal | null;
            countedCashAmount: import("@prisma/client-runtime-utils").Decimal | null;
            differenceAmount: import("@prisma/client-runtime-utils").Decimal | null;
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
    createRegister(storeId: string, dto: CreateCashRegisterDto, req: any): Promise<{
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
}
export declare class CashRegistersDirectController {
    private readonly cashService;
    constructor(cashService: CashService);
    getRegisters(storeId?: string): Promise<{
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
            openingCashAmount: import("@prisma/client-runtime-utils").Decimal;
            closedAt: Date | null;
            closedByUserId: string | null;
            expectedCashAmount: import("@prisma/client-runtime-utils").Decimal | null;
            countedCashAmount: import("@prisma/client-runtime-utils").Decimal | null;
            differenceAmount: import("@prisma/client-runtime-utils").Decimal | null;
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
            openingCashAmount: import("@prisma/client-runtime-utils").Decimal;
            closedAt: Date | null;
            closedByUserId: string | null;
            expectedCashAmount: import("@prisma/client-runtime-utils").Decimal | null;
            countedCashAmount: import("@prisma/client-runtime-utils").Decimal | null;
            differenceAmount: import("@prisma/client-runtime-utils").Decimal | null;
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
    updateRegister(id: string, dto: UpdateCashRegisterDto, req: any): Promise<{
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
    updateRegisterStatus(id: string, status: CashRegisterStatus, req: any): Promise<{
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
}
