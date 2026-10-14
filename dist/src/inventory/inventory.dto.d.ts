import { InventoryMovementType } from '@prisma/client';
export declare class AddInventoryDto {
    locationId: string;
    productId: string;
    quantity: number;
    notes?: string;
}
export declare class AdjustInventoryDto {
    locationId: string;
    productId: string;
    adjustmentQuantity: number;
    reason: string;
    notes?: string;
}
export declare class TransferInventoryDto {
    fromLocationId: string;
    toLocationId: string;
    productId: string;
    quantity: number;
    notes?: string;
}
export declare class SetMinimumStockDto {
    locationId: string;
    productId: string;
    minimumStock: number;
}
export declare class GetStockQueryDto {
    locationId?: string;
    departmentId?: string;
    q?: string;
    stockState?: 'all' | 'normal' | 'low' | 'out' | 'negative';
}
export declare class GetMovementsQueryDto {
    locationId?: string;
    productId?: string;
    type?: InventoryMovementType;
    startDate?: string;
    endDate?: string;
    page?: number | string;
    limit?: number | string;
}
