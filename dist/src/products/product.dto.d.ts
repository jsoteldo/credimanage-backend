import { ProductSaleType } from '@prisma/client';
export declare class CreateProductDto {
    sku: string;
    barcode?: string | null;
    name: string;
    description?: string | null;
    departmentId?: string | null;
    saleType?: ProductSaleType;
    costPrice?: number | string;
    salePrice?: number | string;
    wholesalePrice?: number | string;
    tracksInventory?: boolean;
    defaultMinStock?: number | string | null;
    components?: {
        componentProductId: string;
        quantity: number | string;
    }[];
    businessId?: string;
}
export declare class UpdateProductDto {
    sku?: string;
    barcode?: string | null;
    name?: string;
    description?: string | null;
    departmentId?: string | null;
    saleType?: ProductSaleType;
    costPrice?: number | string;
    salePrice?: number | string;
    wholesalePrice?: number | string;
    tracksInventory?: boolean;
    defaultMinStock?: number | string | null;
    components?: {
        componentProductId: string;
        quantity: number | string;
    }[];
    active?: boolean;
    businessId?: string;
}
export interface ProductResponseDto {
    id: string;
    businessId: string;
    sku: string;
    barcode: string | null;
    name: string;
    description: string | null;
    departmentId: string | null;
    departmentName?: string | null;
    saleType: ProductSaleType;
    costPrice: number;
    salePrice: number;
    wholesalePrice: number;
    tracksInventory: boolean;
    defaultMinStock: number;
    active: boolean;
    components?: {
        id: string;
        componentProductId: string;
        componentSku: string;
        componentName: string;
        quantity: number;
        saleType: ProductSaleType;
    }[];
    createdAt: string | Date;
    updatedAt: string | Date;
}
export declare function toProductDto(product: any): ProductResponseDto;
