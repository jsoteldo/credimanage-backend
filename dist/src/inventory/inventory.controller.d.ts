import { InventoryService } from './inventory.service';
import { AddInventoryDto, AdjustInventoryDto, TransferInventoryDto, SetMinimumStockDto, GetStockQueryDto, GetMovementsQueryDto } from './inventory.dto';
export declare class InventoryController {
    private inventoryService;
    constructor(inventoryService: InventoryService);
    getStock(query: GetStockQueryDto): Promise<{
        productId: string;
        productName: string;
        sku: string;
        barcode: string | null;
        saleType: import("@prisma/client").$Enums.ProductSaleType;
        costPrice: number;
        salePrice: number;
        departmentId: string | null;
        departmentName: string | null;
        locationId: string;
        locationName: string;
        locationType: import("@prisma/client").$Enums.LocationType;
        quantity: number;
        minimumStock: number;
        state: import("./inventory.service").StockState;
        lastMovement: {
            type: import("@prisma/client").$Enums.InventoryMovementType;
            quantity: number;
            createdAt: Date;
            notes: string | null;
        } | null;
        updatedAt: Date;
    }[] | {
        productId: string;
        productName: string;
        sku: string;
        barcode: string | null;
        saleType: import("@prisma/client").$Enums.ProductSaleType;
        costPrice: number;
        salePrice: number;
        departmentId: string | null;
        departmentName: string | null;
        locationId: string;
        locationName: string;
        locationType: null;
        quantity: number;
        minimumStock: number;
        state: import("./inventory.service").StockState;
        locationBreakdown: {
            locationId: string;
            locationName: string;
            locationType: import("@prisma/client").$Enums.LocationType;
            quantity: number;
            minimumStock: number;
            state: import("./inventory.service").StockState;
        }[];
        updatedAt: Date;
    }[]>;
    getKpis(locationId?: string): Promise<{
        totalProducts: number;
        inStockCount: number;
        lowStockCount: number;
        outOfStockCount: number;
        negativeStockCount: number;
    }>;
    getMovements(query: GetMovementsQueryDto): Promise<{
        total: number;
        page: number;
        limit: number;
        totalPages: number;
        movements: {
            id: string;
            createdAt: Date;
            productId: string;
            productName: string;
            sku: string;
            barcode: string | null;
            saleType: import("@prisma/client").$Enums.ProductSaleType;
            locationId: string;
            locationName: string;
            locationType: import("@prisma/client").$Enums.LocationType;
            type: import("@prisma/client").$Enums.InventoryMovementType;
            quantity: number;
            previousStock: number;
            newStock: number;
            referenceType: string | null;
            referenceId: string | null;
            reason: string | null;
            notes: string | null;
            createdBy: string;
        }[];
    }>;
    getProductStockDetails(productId: string): Promise<{
        product: {
            id: string;
            name: string;
            sku: string;
            barcode: string | null;
            saleType: "KIT";
            departmentName: string | null;
            salePrice: number;
            isKit: boolean;
            costPrice?: undefined;
            defaultMinStock?: undefined;
        };
        isKit: boolean;
        kitComponents: {
            componentProductId: string;
            sku: string;
            name: string;
            quantity: number;
        }[];
        locationsAvailability: {
            locationId: string;
            locationName: string;
            locationType: any;
            availableKits: number;
            components: {
                componentProductId: string;
                sku: string;
                name: string;
                quantityPerKit: number;
                availableStock: number;
                kitsPossible: number;
            }[];
        }[];
        recentMovements: never[];
        locationStocks?: undefined;
    } | {
        product: {
            id: string;
            name: string;
            sku: string;
            barcode: string | null;
            saleType: "UNIT" | "WEIGHT";
            departmentName: string | null;
            salePrice: number;
            costPrice: number;
            defaultMinStock: number;
            isKit: boolean;
        };
        isKit: boolean;
        locationStocks: {
            locationId: string;
            locationName: string;
            locationType: import("@prisma/client").$Enums.LocationType;
            quantity: number;
            minimumStock: number;
            state: import("./inventory.service").StockState;
            updatedAt: Date | null;
        }[];
        recentMovements: {
            id: string;
            locationId: string;
            locationName: string;
            locationType: import("@prisma/client").$Enums.LocationType;
            type: import("@prisma/client").$Enums.InventoryMovementType;
            quantity: number;
            previousStock: number;
            newStock: number;
            referenceType: string | null;
            referenceId: string | null;
            reason: string | null;
            notes: string | null;
            createdBy: string;
            createdAt: Date;
        }[];
        kitComponents?: undefined;
        locationsAvailability?: undefined;
    }>;
    explodeKitComponents(kitProductId: string, quantity?: string): Promise<{
        componentProductId: string;
        sku: string;
        name: string;
        quantityPerKit: number;
        totalQuantityDeduction: number;
    }[]>;
    addInventory(dto: AddInventoryDto, req: any): Promise<{
        success: boolean;
        productId: string;
        productName: string;
        locationId: string;
        locationName: string;
        previousStock: number;
        quantityAdded: number;
        newStock: number;
        state: import("./inventory.service").StockState;
        movementId: string;
    }>;
    adjustInventory(dto: AdjustInventoryDto, req: any): Promise<{
        success: boolean;
        productId: string;
        productName: string;
        locationId: string;
        locationName: string;
        previousStock: number;
        adjustmentQuantity: number;
        newStock: number;
        state: import("./inventory.service").StockState;
        movementId: string;
    }>;
    transferInventory(dto: TransferInventoryDto, req: any): Promise<{
        success: boolean;
        referenceId: string;
        productId: string;
        productName: string;
        quantityTransferred: number;
        fromLocation: {
            id: string;
            name: string;
            previousStock: number;
            newStock: number;
            state: import("./inventory.service").StockState;
        };
        toLocation: {
            id: string;
            name: string;
            previousStock: number;
            newStock: number;
            state: import("./inventory.service").StockState;
        };
    }>;
    setMinimumStock(dto: SetMinimumStockDto, req: any): Promise<{
        success: boolean;
        productId: string;
        locationId: string;
        minimumStock: number;
        currentQuantity: number;
        state: import("./inventory.service").StockState;
    }>;
}
