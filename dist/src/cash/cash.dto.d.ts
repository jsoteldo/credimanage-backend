import { CashRegisterStatus, CashSessionStatus, CashMovementType, SalePaymentMethod } from '@prisma/client';
export declare class CreateCashRegisterDto {
    storeId: string;
    code: string;
    name: string;
    status?: CashRegisterStatus;
}
export declare class UpdateCashRegisterDto {
    code?: string;
    name?: string;
    status?: CashRegisterStatus;
}
export declare class OpenCashSessionDto {
    cashRegisterId: string;
    storeId: string;
    openingCashAmount: number;
    notes?: string;
}
export declare class CloseCashSessionDto {
    countedCashAmount: number;
    notes?: string;
}
export declare class CreateCashMovementDto {
    type: 'CASH_IN' | 'CASH_OUT';
    amount: number;
    reason: string;
    notes?: string;
}
export declare class ReceiptConfigDto {
    businessName: string;
    secondaryText?: string;
    address?: string;
    phone?: string;
    footerMessage?: string;
    paperWidth?: '58mm' | '80mm' | 'a4';
    showLogo?: boolean;
    showProductCode?: boolean;
    showCustomer?: boolean;
    showCashier?: boolean;
    showStore?: boolean;
    showPaymentMethods?: boolean;
    series?: string;
}
export declare class GetCashSessionsQueryDto {
    storeId?: string;
    cashRegisterId?: string;
    userId?: string;
    status?: CashSessionStatus;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
}
export declare class GetCashMovementsQueryDto {
    cashSessionId?: string;
    storeId?: string;
    type?: CashMovementType;
    paymentMethod?: SalePaymentMethod;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
}
