import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AddInventoryDto, AdjustInventoryDto, TransferInventoryDto, SetMinimumStockDto, GetStockQueryDto, GetMovementsQueryDto } from './inventory.dto';
export type StockState = 'NORMAL' | 'LOW' | 'OUT_OF_STOCK' | 'NEGATIVE';
export declare class InventoryService {
    private prisma;
    private auditService;
    constructor(prisma: PrismaService, auditService: AuditService);
    computeStockState(quantity: number, minimumStock: number): StockState;
    getStock(query: GetStockQueryDto, businessId?: string): Promise<{
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
        state: StockState;
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
        state: StockState;
        locationBreakdown: {
            locationId: string;
            locationName: string;
            locationType: import("@prisma/client").$Enums.LocationType;
            quantity: number;
            minimumStock: number;
            state: StockState;
        }[];
        updatedAt: Date;
    }[]>;
    getKpis(locationId?: string, businessId?: string): Promise<{
        totalProducts: number;
        inStockCount: number;
        lowStockCount: number;
        outOfStockCount: number;
        negativeStockCount: number;
    }>;
    getProductStockDetails(productId: string, businessId?: string): Promise<{
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
            state: StockState;
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
    private getKitAvailabilityPerLocation;
    explodeKitComponents(kitProductId: string, quantity?: number): Promise<{
        componentProductId: string;
        sku: string;
        name: string;
        quantityPerKit: number;
        totalQuantityDeduction: number;
    }[]>;
    addInventory(dto: AddInventoryDto, user: {
        id: string;
        name?: string;
        email?: string;
        role?: any;
    }, businessId?: string): Promise<{
        success: boolean;
        productId: string;
        productName: string;
        locationId: string;
        locationName: string;
        previousStock: number;
        quantityAdded: number;
        newStock: number;
        state: StockState;
        movementId: string;
    }>;
    adjustInventory(dto: AdjustInventoryDto, user: {
        id: string;
        name?: string;
        email?: string;
        role?: any;
    }, businessId?: string): Promise<{
        success: boolean;
        productId: string;
        productName: string;
        locationId: string;
        locationName: string;
        previousStock: number;
        adjustmentQuantity: number;
        newStock: number;
        state: StockState;
        movementId: string;
    }>;
    transferInventory(dto: TransferInventoryDto, user: {
        id: string;
        name?: string;
        email?: string;
        role?: any;
    }, businessId?: string): Promise<{
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
            state: StockState;
        };
        toLocation: {
            id: string;
            name: string;
            previousStock: number;
            newStock: number;
            state: StockState;
        };
    }>;
    setMinimumStock(dto: SetMinimumStockDto, user: {
        id: string;
        name?: string;
        email?: string;
        role?: any;
    }, businessId?: string): Promise<{
        success: boolean;
        productId: string;
        locationId: string;
        minimumStock: number;
        currentQuantity: number;
        state: StockState;
    }>;
    getMovements(query: GetMovementsQueryDto, businessId?: string): Promise<{
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
}
