import { ProductsService } from './products.service';
import { CreateProductDto, UpdateProductDto } from './product.dto';
import { ProductSaleType } from '@prisma/client';
export declare class ProductsController {
    private productsService;
    constructor(productsService: ProductsService);
    getProducts(q?: string, departmentId?: string, saleType?: ProductSaleType, active?: string): Promise<import("./product.dto").ProductResponseDto[]>;
    getProductById(id: string): Promise<import("./product.dto").ProductResponseDto>;
    getProductComponents(id: string): Promise<{
        id: string;
        componentProductId: string;
        componentSku: string;
        componentName: string;
        quantity: number;
        saleType: ProductSaleType;
    }[]>;
    createProduct(body: CreateProductDto): Promise<import("./product.dto").ProductResponseDto>;
    updateProduct(id: string, body: UpdateProductDto): Promise<import("./product.dto").ProductResponseDto>;
    deactivateProduct(id: string): Promise<import("./product.dto").ProductResponseDto>;
    reactivateProduct(id: string): Promise<import("./product.dto").ProductResponseDto>;
    importProducts(file?: Express.Multer.File, rows?: any): Promise<import("./excel-importer.service").ImportResult>;
}
