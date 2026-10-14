"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InventoryService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const audit_service_1 = require("../audit/audit.service");
const client_1 = require("@prisma/client");
let InventoryService = class InventoryService {
    prisma;
    auditService;
    constructor(prisma, auditService) {
        this.prisma = prisma;
        this.auditService = auditService;
    }
    computeStockState(quantity, minimumStock) {
        if (quantity < 0)
            return 'NEGATIVE';
        if (quantity === 0)
            return 'OUT_OF_STOCK';
        if (quantity <= minimumStock)
            return 'LOW';
        return 'NORMAL';
    }
    async getStock(query, businessId = 'default') {
        const { locationId, departmentId, q, stockState } = query;
        const productWhere = {
            businessId,
            active: true,
            tracksInventory: true,
            saleType: { not: client_1.ProductSaleType.KIT },
        };
        if (departmentId && departmentId !== 'todos') {
            productWhere.departmentId = departmentId;
        }
        if (q && q.trim()) {
            const search = q.trim();
            productWhere.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { sku: { contains: search, mode: 'insensitive' } },
                { barcode: { contains: search, mode: 'insensitive' } },
            ];
        }
        const products = await this.prisma.product.findMany({
            where: productWhere,
            include: {
                department: true,
            },
            orderBy: { name: 'asc' },
        });
        if (products.length === 0) {
            return [];
        }
        const productIds = products.map((p) => p.id);
        if (locationId && locationId !== 'all') {
            const location = await this.prisma.location.findFirst({
                where: { id: locationId, businessId, active: true },
            });
            if (!location) {
                throw new common_1.NotFoundException('Ubicación no encontrada o inactiva');
            }
            const stocks = await this.prisma.inventoryStock.findMany({
                where: {
                    locationId,
                    productId: { in: productIds },
                },
            });
            const stockMap = new Map();
            stocks.forEach((s) => stockMap.set(s.productId, s));
            const latestMovements = await this.prisma.inventoryMovement.findMany({
                where: {
                    locationId,
                    productId: { in: productIds },
                },
                orderBy: { createdAt: 'desc' },
                distinct: ['productId'],
            });
            const movementMap = new Map();
            latestMovements.forEach((m) => movementMap.set(m.productId, m));
            const result = products.map((product) => {
                const stockRecord = stockMap.get(product.id);
                const quantity = stockRecord ? Number(stockRecord.quantity) : 0;
                const minimumStock = stockRecord
                    ? Number(stockRecord.minimumStock)
                    : Number(product.defaultMinStock || 0);
                const state = this.computeStockState(quantity, minimumStock);
                const lastMov = movementMap.get(product.id);
                return {
                    productId: product.id,
                    productName: product.name,
                    sku: product.sku,
                    barcode: product.barcode,
                    saleType: product.saleType,
                    costPrice: Number(product.costPrice),
                    salePrice: Number(product.salePrice),
                    departmentId: product.departmentId,
                    departmentName: product.department?.name || null,
                    locationId: location.id,
                    locationName: location.name,
                    locationType: location.type,
                    quantity,
                    minimumStock,
                    state,
                    lastMovement: lastMov
                        ? {
                            type: lastMov.type,
                            quantity: Number(lastMov.quantity),
                            createdAt: lastMov.createdAt,
                            notes: lastMov.notes,
                        }
                        : null,
                    updatedAt: stockRecord?.updatedAt || product.updatedAt,
                };
            });
            if (stockState && stockState !== 'all') {
                const stateUpper = stockState.toUpperCase();
                if (stateUpper === 'NORMAL') {
                    return result.filter((r) => r.state === 'NORMAL');
                }
                else if (stateUpper === 'LOW') {
                    return result.filter((r) => r.state === 'LOW');
                }
                else if (stateUpper === 'OUT' || stateUpper === 'OUT_OF_STOCK') {
                    return result.filter((r) => r.state === 'OUT_OF_STOCK');
                }
                else if (stateUpper === 'NEGATIVE') {
                    return result.filter((r) => r.state === 'NEGATIVE');
                }
            }
            return result;
        }
        const allLocations = await this.prisma.location.findMany({
            where: { businessId, active: true },
            orderBy: { name: 'asc' },
        });
        const allStocks = await this.prisma.inventoryStock.findMany({
            where: {
                productId: { in: productIds },
                location: { businessId, active: true },
            },
            include: {
                location: true,
            },
        });
        const productStockMap = new Map();
        allStocks.forEach((s) => {
            const list = productStockMap.get(s.productId) || [];
            list.push(s);
            productStockMap.set(s.productId, list);
        });
        const result = products.map((product) => {
            const pStocks = productStockMap.get(product.id) || [];
            const totalQuantity = pStocks.reduce((sum, s) => sum + Number(s.quantity), 0);
            const totalMinStock = pStocks.reduce((sum, s) => sum + Number(s.minimumStock), 0);
            const state = this.computeStockState(totalQuantity, totalMinStock);
            const locationBreakdown = allLocations.map((loc) => {
                const found = pStocks.find((s) => s.locationId === loc.id);
                const qty = found ? Number(found.quantity) : 0;
                const min = found
                    ? Number(found.minimumStock)
                    : Number(product.defaultMinStock || 0);
                return {
                    locationId: loc.id,
                    locationName: loc.name,
                    locationType: loc.type,
                    quantity: qty,
                    minimumStock: min,
                    state: this.computeStockState(qty, min),
                };
            });
            return {
                productId: product.id,
                productName: product.name,
                sku: product.sku,
                barcode: product.barcode,
                saleType: product.saleType,
                costPrice: Number(product.costPrice),
                salePrice: Number(product.salePrice),
                departmentId: product.departmentId,
                departmentName: product.department?.name || null,
                locationId: 'all',
                locationName: 'Todas las ubicaciones',
                locationType: null,
                quantity: totalQuantity,
                minimumStock: totalMinStock,
                state,
                locationBreakdown,
                updatedAt: product.updatedAt,
            };
        });
        if (stockState && stockState !== 'all') {
            const stateUpper = stockState.toUpperCase();
            if (stateUpper === 'NORMAL') {
                return result.filter((r) => r.state === 'NORMAL');
            }
            else if (stateUpper === 'LOW') {
                return result.filter((r) => r.state === 'LOW');
            }
            else if (stateUpper === 'OUT' || stateUpper === 'OUT_OF_STOCK') {
                return result.filter((r) => r.state === 'OUT_OF_STOCK');
            }
            else if (stateUpper === 'NEGATIVE') {
                return result.filter((r) => r.state === 'NEGATIVE');
            }
        }
        return result;
    }
    async getKpis(locationId, businessId = 'default') {
        const products = await this.prisma.product.findMany({
            where: {
                businessId,
                active: true,
                tracksInventory: true,
                saleType: { not: client_1.ProductSaleType.KIT },
            },
            select: { id: true, defaultMinStock: true },
        });
        const totalProducts = products.length;
        if (totalProducts === 0) {
            return {
                totalProducts: 0,
                inStockCount: 0,
                lowStockCount: 0,
                outOfStockCount: 0,
                negativeStockCount: 0,
            };
        }
        const productIds = products.map((p) => p.id);
        if (locationId && locationId !== 'all') {
            const stocks = await this.prisma.inventoryStock.findMany({
                where: {
                    locationId,
                    productId: { in: productIds },
                },
            });
            const stockMap = new Map();
            stocks.forEach((s) => stockMap.set(s.productId, s));
            let inStockCount = 0;
            let lowStockCount = 0;
            let outOfStockCount = 0;
            let negativeStockCount = 0;
            for (const p of products) {
                const s = stockMap.get(p.id);
                const qty = s ? Number(s.quantity) : 0;
                const min = s ? Number(s.minimumStock) : Number(p.defaultMinStock || 0);
                if (qty < 0) {
                    negativeStockCount++;
                }
                else if (qty === 0) {
                    outOfStockCount++;
                }
                else if (qty <= min) {
                    lowStockCount++;
                }
                else {
                    inStockCount++;
                }
            }
            return {
                totalProducts,
                inStockCount,
                lowStockCount,
                outOfStockCount,
                negativeStockCount,
            };
        }
        const allStocks = await this.prisma.inventoryStock.findMany({
            where: {
                productId: { in: productIds },
                location: { businessId, active: true },
            },
        });
        const aggregatedQtyMap = new Map();
        const aggregatedMinMap = new Map();
        allStocks.forEach((s) => {
            const curQty = aggregatedQtyMap.get(s.productId) || 0;
            aggregatedQtyMap.set(s.productId, curQty + Number(s.quantity));
            const curMin = aggregatedMinMap.get(s.productId) || 0;
            aggregatedMinMap.set(s.productId, curMin + Number(s.minimumStock));
        });
        let inStockCount = 0;
        let lowStockCount = 0;
        let outOfStockCount = 0;
        let negativeStockCount = 0;
        for (const p of products) {
            const qty = aggregatedQtyMap.get(p.id) || 0;
            const min = aggregatedMinMap.get(p.id) || Number(p.defaultMinStock || 0);
            if (qty < 0) {
                negativeStockCount++;
            }
            else if (qty === 0) {
                outOfStockCount++;
            }
            else if (qty <= min) {
                lowStockCount++;
            }
            else {
                inStockCount++;
            }
        }
        return {
            totalProducts,
            inStockCount,
            lowStockCount,
            outOfStockCount,
            negativeStockCount,
        };
    }
    async getProductStockDetails(productId, businessId = 'default') {
        const product = await this.prisma.product.findFirst({
            where: { id: productId, businessId },
            include: {
                department: true,
                kitComponents: {
                    include: {
                        componentProduct: true,
                    },
                },
            },
        });
        if (!product) {
            throw new common_1.NotFoundException('Producto no encontrado');
        }
        const locations = await this.prisma.location.findMany({
            where: { businessId, active: true },
            orderBy: { name: 'asc' },
        });
        if (product.saleType === client_1.ProductSaleType.KIT) {
            const kitExplosion = await this.getKitAvailabilityPerLocation(product.id, locations);
            return {
                product: {
                    id: product.id,
                    name: product.name,
                    sku: product.sku,
                    barcode: product.barcode,
                    saleType: product.saleType,
                    departmentName: product.department?.name || null,
                    salePrice: Number(product.salePrice),
                    isKit: true,
                },
                isKit: true,
                kitComponents: kitExplosion.components,
                locationsAvailability: kitExplosion.locationsAvailability,
                recentMovements: [],
            };
        }
        const stocks = await this.prisma.inventoryStock.findMany({
            where: { productId },
        });
        const stockMap = new Map();
        stocks.forEach((s) => stockMap.set(s.locationId, s));
        const locationStocks = locations.map((loc) => {
            const stock = stockMap.get(loc.id);
            const quantity = stock ? Number(stock.quantity) : 0;
            const minimumStock = stock
                ? Number(stock.minimumStock)
                : Number(product.defaultMinStock || 0);
            return {
                locationId: loc.id,
                locationName: loc.name,
                locationType: loc.type,
                quantity,
                minimumStock,
                state: this.computeStockState(quantity, minimumStock),
                updatedAt: stock?.updatedAt || null,
            };
        });
        const recentMovements = await this.prisma.inventoryMovement.findMany({
            where: { productId },
            include: {
                location: {
                    select: { name: true, type: true },
                },
            },
            orderBy: { createdAt: 'desc' },
            take: 25,
        });
        return {
            product: {
                id: product.id,
                name: product.name,
                sku: product.sku,
                barcode: product.barcode,
                saleType: product.saleType,
                departmentName: product.department?.name || null,
                salePrice: Number(product.salePrice),
                costPrice: Number(product.costPrice),
                defaultMinStock: Number(product.defaultMinStock || 0),
                isKit: false,
            },
            isKit: false,
            locationStocks,
            recentMovements: recentMovements.map((m) => ({
                id: m.id,
                locationId: m.locationId,
                locationName: m.location.name,
                locationType: m.location.type,
                type: m.type,
                quantity: Number(m.quantity),
                previousStock: Number(m.previousStock),
                newStock: Number(m.newStock),
                referenceType: m.referenceType,
                referenceId: m.referenceId,
                reason: m.reason,
                notes: m.notes,
                createdBy: m.createdBy,
                createdAt: m.createdAt,
            })),
        };
    }
    async getKitAvailabilityPerLocation(kitProductId, locations) {
        const components = await this.prisma.productKitComponent.findMany({
            where: { kitProductId },
            include: {
                componentProduct: true,
            },
        });
        const componentIds = components.map((c) => c.componentProductId);
        const componentStocks = await this.prisma.inventoryStock.findMany({
            where: {
                productId: { in: componentIds },
            },
        });
        const stockLookup = new Map();
        componentStocks.forEach((cs) => {
            stockLookup.set(`${cs.locationId}_${cs.productId}`, Number(cs.quantity));
        });
        const locationsAvailability = locations.map((loc) => {
            let maxKitsPossible = Infinity;
            const componentStatus = components.map((c) => {
                const availableStock = stockLookup.get(`${loc.id}_${c.componentProductId}`) || 0;
                const qtyPerKit = Number(c.quantity);
                const kitsFromComponent = qtyPerKit > 0 ? Math.floor(availableStock / qtyPerKit) : 0;
                if (kitsFromComponent < maxKitsPossible) {
                    maxKitsPossible = kitsFromComponent;
                }
                return {
                    componentProductId: c.componentProductId,
                    sku: c.componentProduct.sku,
                    name: c.componentProduct.name,
                    quantityPerKit: qtyPerKit,
                    availableStock,
                    kitsPossible: Math.max(0, kitsFromComponent),
                };
            });
            const finalKitsAvailable = maxKitsPossible === Infinity ? 0 : Math.max(0, maxKitsPossible);
            return {
                locationId: loc.id,
                locationName: loc.name,
                locationType: loc.type,
                availableKits: finalKitsAvailable,
                components: componentStatus,
            };
        });
        return {
            components: components.map((c) => ({
                componentProductId: c.componentProductId,
                sku: c.componentProduct.sku,
                name: c.componentProduct.name,
                quantity: Number(c.quantity),
            })),
            locationsAvailability,
        };
    }
    async explodeKitComponents(kitProductId, quantity = 1) {
        if (typeof quantity !== 'number' ||
            !Number.isFinite(quantity) ||
            !Number.isInteger(quantity)) {
            throw new common_1.BadRequestException('La cantidad de inventario debe ser un número entero.');
        }
        const components = await this.prisma.productKitComponent.findMany({
            where: { kitProductId },
            include: { componentProduct: true },
        });
        if (components.length === 0) {
            throw new common_1.BadRequestException('El Kit no posee componentes configurados');
        }
        return components.map((c) => ({
            componentProductId: c.componentProductId,
            sku: c.componentProduct.sku,
            name: c.componentProduct.name,
            quantityPerKit: Number(c.quantity),
            totalQuantityDeduction: Number(c.quantity) * quantity,
        }));
    }
    async addInventory(dto, user, businessId = 'default') {
        if (typeof dto.quantity !== 'number' ||
            !Number.isFinite(dto.quantity) ||
            !Number.isInteger(dto.quantity)) {
            throw new common_1.BadRequestException('La cantidad de inventario debe ser un número entero.');
        }
        if (dto.quantity <= 0) {
            throw new common_1.BadRequestException('La cantidad a agregar debe ser mayor a 0');
        }
        const location = await this.prisma.location.findFirst({
            where: { id: dto.locationId, businessId, active: true },
        });
        if (!location) {
            throw new common_1.NotFoundException('Ubicación no encontrada o inactiva');
        }
        const product = await this.prisma.product.findFirst({
            where: { id: dto.productId, businessId, active: true },
        });
        if (!product) {
            throw new common_1.NotFoundException('Producto no encontrado o inactivo');
        }
        if (product.saleType === client_1.ProductSaleType.KIT) {
            throw new common_1.BadRequestException('Los Kits/Combos no manejan stock propio; su inventario se deriva de sus componentes.');
        }
        const userName = user.name || user.email || 'Usuario';
        const result = await this.prisma.$transaction(async (tx) => {
            let stock = await tx.inventoryStock.findUnique({
                where: {
                    locationId_productId: {
                        locationId: dto.locationId,
                        productId: dto.productId,
                    },
                },
            });
            const previousStock = stock ? Number(stock.quantity) : 0;
            const newStock = previousStock + dto.quantity;
            const minStock = stock
                ? Number(stock.minimumStock)
                : Number(product.defaultMinStock || 0);
            if (stock) {
                stock = await tx.inventoryStock.update({
                    where: { id: stock.id },
                    data: {
                        quantity: newStock,
                    },
                });
            }
            else {
                stock = await tx.inventoryStock.create({
                    data: {
                        locationId: dto.locationId,
                        productId: dto.productId,
                        quantity: newStock,
                        minimumStock: minStock,
                    },
                });
            }
            const movement = await tx.inventoryMovement.create({
                data: {
                    locationId: dto.locationId,
                    productId: dto.productId,
                    type: client_1.InventoryMovementType.ENTRY,
                    quantity: dto.quantity,
                    previousStock,
                    newStock,
                    referenceType: 'MANUAL_ENTRY',
                    notes: dto.notes?.trim() || null,
                    reason: 'Entrada de inventario',
                    createdBy: userName,
                },
            });
            return { stock, movement, previousStock, newStock };
        });
        await this.auditService.logAudit(user.id, userName, user.role || 'Administrador', 'INVENTORY_ENTRY', `Entrada de ${dto.quantity} unidades para "${product.name}" en "${location.name}". Stock: ${result.previousStock} -> ${result.newStock}`, result.movement.id);
        return {
            success: true,
            productId: product.id,
            productName: product.name,
            locationId: location.id,
            locationName: location.name,
            previousStock: result.previousStock,
            quantityAdded: dto.quantity,
            newStock: result.newStock,
            state: this.computeStockState(result.newStock, Number(result.stock.minimumStock)),
            movementId: result.movement.id,
        };
    }
    async adjustInventory(dto, user, businessId = 'default') {
        if (typeof dto.adjustmentQuantity !== 'number' ||
            !Number.isFinite(dto.adjustmentQuantity) ||
            !Number.isInteger(dto.adjustmentQuantity)) {
            throw new common_1.BadRequestException('La cantidad de inventario debe ser un número entero.');
        }
        if (dto.adjustmentQuantity === 0) {
            throw new common_1.BadRequestException('La cantidad de ajuste no puede ser 0');
        }
        const location = await this.prisma.location.findFirst({
            where: { id: dto.locationId, businessId, active: true },
        });
        if (!location) {
            throw new common_1.NotFoundException('Ubicación no encontrada o inactiva');
        }
        const product = await this.prisma.product.findFirst({
            where: { id: dto.productId, businessId, active: true },
        });
        if (!product) {
            throw new common_1.NotFoundException('Producto no encontrado o inactivo');
        }
        if (product.saleType === client_1.ProductSaleType.KIT) {
            throw new common_1.BadRequestException('Los Kits/Combos no manejan stock propio; su inventario se deriva de sus componentes.');
        }
        const userName = user.name || user.email || 'Usuario';
        const movementType = dto.adjustmentQuantity > 0
            ? client_1.InventoryMovementType.ADJUSTMENT_POSITIVE
            : client_1.InventoryMovementType.ADJUSTMENT_NEGATIVE;
        const result = await this.prisma.$transaction(async (tx) => {
            let stock = await tx.inventoryStock.findUnique({
                where: {
                    locationId_productId: {
                        locationId: dto.locationId,
                        productId: dto.productId,
                    },
                },
            });
            const previousStock = stock ? Number(stock.quantity) : 0;
            const newStock = previousStock + dto.adjustmentQuantity;
            const minStock = stock
                ? Number(stock.minimumStock)
                : Number(product.defaultMinStock || 0);
            if (stock) {
                stock = await tx.inventoryStock.update({
                    where: { id: stock.id },
                    data: {
                        quantity: newStock,
                    },
                });
            }
            else {
                stock = await tx.inventoryStock.create({
                    data: {
                        locationId: dto.locationId,
                        productId: dto.productId,
                        quantity: newStock,
                        minimumStock: minStock,
                    },
                });
            }
            const movement = await tx.inventoryMovement.create({
                data: {
                    locationId: dto.locationId,
                    productId: dto.productId,
                    type: movementType,
                    quantity: dto.adjustmentQuantity,
                    previousStock,
                    newStock,
                    referenceType: 'MANUAL_ADJUSTMENT',
                    reason: dto.reason.trim(),
                    notes: dto.notes?.trim() || null,
                    createdBy: userName,
                },
            });
            return { stock, movement, previousStock, newStock };
        });
        await this.auditService.logAudit(user.id, userName, user.role || 'Administrador', 'INVENTORY_ADJUSTMENT', `Ajuste (${dto.adjustmentQuantity > 0 ? '+' : ''}${dto.adjustmentQuantity}) para "${product.name}" en "${location.name}". Motivo: ${dto.reason}. Stock: ${result.previousStock} -> ${result.newStock}`, result.movement.id);
        return {
            success: true,
            productId: product.id,
            productName: product.name,
            locationId: location.id,
            locationName: location.name,
            previousStock: result.previousStock,
            adjustmentQuantity: dto.adjustmentQuantity,
            newStock: result.newStock,
            state: this.computeStockState(result.newStock, Number(result.stock.minimumStock)),
            movementId: result.movement.id,
        };
    }
    async transferInventory(dto, user, businessId = 'default') {
        if (dto.fromLocationId === dto.toLocationId) {
            throw new common_1.BadRequestException('La ubicación de origen y destino deben ser diferentes');
        }
        if (typeof dto.quantity !== 'number' ||
            !Number.isFinite(dto.quantity) ||
            !Number.isInteger(dto.quantity)) {
            throw new common_1.BadRequestException('La cantidad de inventario debe ser un número entero.');
        }
        if (dto.quantity <= 0) {
            throw new common_1.BadRequestException('La cantidad a transferir debe ser mayor a 0');
        }
        const [fromLocation, toLocation, product] = await Promise.all([
            this.prisma.location.findFirst({
                where: { id: dto.fromLocationId, businessId, active: true },
            }),
            this.prisma.location.findFirst({
                where: { id: dto.toLocationId, businessId, active: true },
            }),
            this.prisma.product.findFirst({
                where: { id: dto.productId, businessId, active: true },
            }),
        ]);
        if (!fromLocation) {
            throw new common_1.NotFoundException('Ubicación de origen no encontrada o inactiva');
        }
        if (!toLocation) {
            throw new common_1.NotFoundException('Ubicación de destino no encontrada o inactiva');
        }
        if (!product) {
            throw new common_1.NotFoundException('Producto no encontrado o inactivo');
        }
        if (product.saleType === client_1.ProductSaleType.KIT) {
            throw new common_1.BadRequestException('Los Kits/Combos no pueden transferirse directamente ya que derivan su stock de componentes.');
        }
        const userName = user.name || user.email || 'Usuario';
        const referenceId = `TRF-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
        const result = await this.prisma.$transaction(async (tx) => {
            let fromStock = await tx.inventoryStock.findUnique({
                where: {
                    locationId_productId: {
                        locationId: dto.fromLocationId,
                        productId: dto.productId,
                    },
                },
            });
            const fromPreviousStock = fromStock ? Number(fromStock.quantity) : 0;
            const fromNewStock = fromPreviousStock - dto.quantity;
            const fromMinStock = fromStock
                ? Number(fromStock.minimumStock)
                : Number(product.defaultMinStock || 0);
            if (fromStock) {
                fromStock = await tx.inventoryStock.update({
                    where: { id: fromStock.id },
                    data: { quantity: fromNewStock },
                });
            }
            else {
                fromStock = await tx.inventoryStock.create({
                    data: {
                        locationId: dto.fromLocationId,
                        productId: dto.productId,
                        quantity: fromNewStock,
                        minimumStock: fromMinStock,
                    },
                });
            }
            const outMovement = await tx.inventoryMovement.create({
                data: {
                    locationId: dto.fromLocationId,
                    productId: dto.productId,
                    type: client_1.InventoryMovementType.TRANSFER_OUT,
                    quantity: -dto.quantity,
                    previousStock: fromPreviousStock,
                    newStock: fromNewStock,
                    referenceType: 'TRANSFER',
                    referenceId,
                    reason: `Transferencia hacia ${toLocation.name}`,
                    notes: dto.notes?.trim() || null,
                    createdBy: userName,
                },
            });
            let toStock = await tx.inventoryStock.findUnique({
                where: {
                    locationId_productId: {
                        locationId: dto.toLocationId,
                        productId: dto.productId,
                    },
                },
            });
            const toPreviousStock = toStock ? Number(toStock.quantity) : 0;
            const toNewStock = toPreviousStock + dto.quantity;
            const toMinStock = toStock
                ? Number(toStock.minimumStock)
                : Number(product.defaultMinStock || 0);
            if (toStock) {
                toStock = await tx.inventoryStock.update({
                    where: { id: toStock.id },
                    data: { quantity: toNewStock },
                });
            }
            else {
                toStock = await tx.inventoryStock.create({
                    data: {
                        locationId: dto.toLocationId,
                        productId: dto.productId,
                        quantity: toNewStock,
                        minimumStock: toMinStock,
                    },
                });
            }
            const inMovement = await tx.inventoryMovement.create({
                data: {
                    locationId: dto.toLocationId,
                    productId: dto.productId,
                    type: client_1.InventoryMovementType.TRANSFER_IN,
                    quantity: dto.quantity,
                    previousStock: toPreviousStock,
                    newStock: toNewStock,
                    referenceType: 'TRANSFER',
                    referenceId,
                    reason: `Transferencia desde ${fromLocation.name}`,
                    notes: dto.notes?.trim() || null,
                    createdBy: userName,
                },
            });
            return {
                referenceId,
                fromPreviousStock,
                fromNewStock,
                toPreviousStock,
                toNewStock,
                outMovementId: outMovement.id,
                inMovementId: inMovement.id,
            };
        });
        await this.auditService.logAudit(user.id, userName, user.role || 'Administrador', 'INVENTORY_TRANSFER', `Transferencia de ${dto.quantity} unidades de "${product.name}" desde "${fromLocation.name}" (nuevo stock: ${result.fromNewStock}) hacia "${toLocation.name}" (nuevo stock: ${result.toNewStock}). Ref: ${result.referenceId}`, result.referenceId);
        return {
            success: true,
            referenceId: result.referenceId,
            productId: product.id,
            productName: product.name,
            quantityTransferred: dto.quantity,
            fromLocation: {
                id: fromLocation.id,
                name: fromLocation.name,
                previousStock: result.fromPreviousStock,
                newStock: result.fromNewStock,
                state: this.computeStockState(result.fromNewStock, 0),
            },
            toLocation: {
                id: toLocation.id,
                name: toLocation.name,
                previousStock: result.toPreviousStock,
                newStock: result.toNewStock,
                state: this.computeStockState(result.toNewStock, 0),
            },
        };
    }
    async setMinimumStock(dto, user, businessId = 'default') {
        if (typeof dto.minimumStock !== 'number' ||
            !Number.isFinite(dto.minimumStock) ||
            !Number.isInteger(dto.minimumStock)) {
            throw new common_1.BadRequestException('La cantidad de inventario debe ser un número entero.');
        }
        if (dto.minimumStock < 0) {
            throw new common_1.BadRequestException('El stock mínimo no puede ser negativo');
        }
        const location = await this.prisma.location.findFirst({
            where: { id: dto.locationId, businessId, active: true },
        });
        if (!location) {
            throw new common_1.NotFoundException('Ubicación no encontrada o inactiva');
        }
        const product = await this.prisma.product.findFirst({
            where: { id: dto.productId, businessId, active: true },
        });
        if (!product) {
            throw new common_1.NotFoundException('Producto no encontrado o inactivo');
        }
        const stock = await this.prisma.inventoryStock.upsert({
            where: {
                locationId_productId: {
                    locationId: dto.locationId,
                    productId: dto.productId,
                },
            },
            update: {
                minimumStock: dto.minimumStock,
            },
            create: {
                locationId: dto.locationId,
                productId: dto.productId,
                quantity: 0,
                minimumStock: dto.minimumStock,
            },
        });
        return {
            success: true,
            productId: product.id,
            locationId: location.id,
            minimumStock: Number(stock.minimumStock),
            currentQuantity: Number(stock.quantity),
            state: this.computeStockState(Number(stock.quantity), Number(stock.minimumStock)),
        };
    }
    async getMovements(query, businessId = 'default') {
        const where = {
            product: { businessId },
        };
        if (query.locationId && query.locationId !== 'all') {
            where.locationId = query.locationId;
        }
        if (query.productId) {
            where.productId = query.productId;
        }
        if (query.type) {
            where.type = query.type;
        }
        if (query.startDate || query.endDate) {
            where.createdAt = {};
            if (query.startDate) {
                where.createdAt.gte = new Date(query.startDate);
            }
            if (query.endDate) {
                const end = new Date(query.endDate);
                end.setHours(23, 59, 59, 999);
                where.createdAt.lte = end;
            }
        }
        const page = Math.max(1, Number(query.page) || 1);
        const limit = Math.min(100, Math.max(1, Number(query.limit) || 50));
        const skip = (page - 1) * limit;
        const [total, movements] = await Promise.all([
            this.prisma.inventoryMovement.count({ where }),
            this.prisma.inventoryMovement.findMany({
                where,
                include: {
                    location: {
                        select: { id: true, name: true, type: true, code: true },
                    },
                    product: {
                        select: {
                            id: true,
                            name: true,
                            sku: true,
                            barcode: true,
                            saleType: true,
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
        ]);
        return {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            movements: movements.map((m) => ({
                id: m.id,
                createdAt: m.createdAt,
                productId: m.productId,
                productName: m.product.name,
                sku: m.product.sku,
                barcode: m.product.barcode,
                saleType: m.product.saleType,
                locationId: m.locationId,
                locationName: m.location.name,
                locationType: m.location.type,
                type: m.type,
                quantity: Number(m.quantity),
                previousStock: Number(m.previousStock),
                newStock: Number(m.newStock),
                referenceType: m.referenceType,
                referenceId: m.referenceId,
                reason: m.reason,
                notes: m.notes,
                createdBy: m.createdBy,
            })),
        };
    }
};
exports.InventoryService = InventoryService;
exports.InventoryService = InventoryService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], InventoryService);
//# sourceMappingURL=inventory.service.js.map