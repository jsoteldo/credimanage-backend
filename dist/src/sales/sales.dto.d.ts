import { SalePaymentMethod } from '@prisma/client';
export declare class SalePaymentDto {
    method: SalePaymentMethod;
    amount: number;
    reference?: string;
}
export declare class SaleItemDto {
    productId: string;
    quantity: number;
}
export declare class CreateSaleDto {
    storeId: string;
    clientId?: string | null;
    items: SaleItemDto[];
    payments: SalePaymentDto[];
    cashReceived?: number;
    notes?: string;
    cashSessionId?: string;
}
export declare class UpdateSaleDto extends CreateSaleDto {
}
export declare class AnnulSaleDto {
    reason: string;
}
export declare class GetSalesQueryDto {
    storeId?: string;
    clientId?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    q?: string;
    limit?: number;
    offset?: number;
}
