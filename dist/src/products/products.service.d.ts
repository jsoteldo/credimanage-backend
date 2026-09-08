import { PrismaService } from '../prisma/prisma.service';
import { ExcelImporterService, RawImportRow } from './excel-importer.service';
import { ProductSaleType } from '@prisma/client';
import { ProductResponseDto } from './product.dto';
export interface CreateComponentInput {
    componentProductId: string;
    quantity: number | string;
}
export interface CreateProductInput {
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
    components?: CreateComponentInput[];
    businessId?: string;
}
export interface UpdateProductInput extends Partial<CreateProductInput> {
    active?: boolean;
}
export declare class ProductsService {
    private prisma;
    private excelImporter;
    constructor(prisma: PrismaService, excelImporter: ExcelImporterService);
    getProducts(query?: {
        q?: string;
        departmentId?: string;
        saleType?: ProductSaleType;
        active?: boolean | string;
        businessId?: string;
    }): Promise<ProductResponseDto[]>;
    getProductById(id: string, businessId?: string): Promise<ProductResponseDto>;
    createProduct(data: CreateProductInput): Promise<ProductResponseDto>;
    updateProduct(id: string, data: UpdateProductInput): Promise<ProductResponseDto>;
    deactivateProduct(id: string, businessId?: string): Promise<ProductResponseDto>;
    reactivateProduct(id: string, businessId?: string): Promise<ProductResponseDto>;
    private validateComponents;
    calculateKitAvailability(components: {
        quantity: number;
        availableStock: number;
    }[]): number;
    importProductsFile(buffer: Buffer, businessId?: string): Promise<import("./excel-importer.service").ImportResult>;
    importProductsRows(rows: RawImportRow[], businessId?: string): Promise<import("./excel-importer.service").ImportResult>;
}
