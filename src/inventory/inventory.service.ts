import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  AddInventoryDto,
  AdjustInventoryDto,
  TransferInventoryDto,
  SetMinimumStockDto,
  GetStockQueryDto,
  GetMovementsQueryDto,
} from './inventory.dto';
import { InventoryMovementType, Prisma, ProductSaleType } from '@prisma/client';

export type StockState = 'NORMAL' | 'LOW' | 'OUT_OF_STOCK' | 'NEGATIVE';

@Injectable()
export class InventoryService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  /**
   * Evaluates the visual inventory state according to CrediManage business rules:
   * - quantity < 0: NEGATIVE (Non-blocking warning)
   * - quantity === 0: OUT_OF_STOCK
   * - quantity > 0 && quantity <= minimumStock: LOW
   * - quantity > minimumStock: NORMAL
   */
  computeStockState(quantity: number, minimumStock: number): StockState {
    if (quantity < 0) return 'NEGATIVE';
    if (quantity === 0) return 'OUT_OF_STOCK';
    if (quantity <= minimumStock) return 'LOW';
    return 'NORMAL';
  }

  /**
   * Retrieves stock list by location (or across all locations) with state calculation and filters.
   */
  async getStock(query: GetStockQueryDto, businessId = 'default') {
    const { locationId, departmentId, q, stockState } = query;

    // Filter products: tracks inventory, active, and not kits (kits derive stock)
    const productWhere: Prisma.ProductWhereInput = {
      businessId,
      active: true,
      tracksInventory: true,
      saleType: { not: ProductSaleType.KIT },
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

    // Get matching products
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

    // If a specific location is selected
    if (locationId && locationId !== 'all') {
      const location = await this.prisma.location.findFirst({
        where: { id: locationId, businessId, active: true },
      });
      if (!location) {
        throw new NotFoundException('Ubicación no encontrada o inactiva');
      }

      // Fetch stock records for this location
      const stocks = await this.prisma.inventoryStock.findMany({
        where: {
          locationId,
          productId: { in: productIds },
        },
      });

      const stockMap = new Map<string, (typeof stocks)[0]>();
      stocks.forEach((s) => stockMap.set(s.productId, s));

      // Get latest movement per product in this location for quick reference
      const latestMovements = await this.prisma.inventoryMovement.findMany({
        where: {
          locationId,
          productId: { in: productIds },
        },
        orderBy: { createdAt: 'desc' },
        distinct: ['productId'],
      });
      const movementMap = new Map<string, (typeof latestMovements)[0]>();
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

      // Filter by stockState if requested
      if (stockState && stockState !== 'all') {
        const stateUpper = stockState.toUpperCase();
        if (stateUpper === 'NORMAL') {
          return result.filter((r) => r.state === 'NORMAL');
        } else if (stateUpper === 'LOW') {
          return result.filter((r) => r.state === 'LOW');
        } else if (stateUpper === 'OUT' || stateUpper === 'OUT_OF_STOCK') {
          return result.filter((r) => r.state === 'OUT_OF_STOCK');
        } else if (stateUpper === 'NEGATIVE') {
          return result.filter((r) => r.state === 'NEGATIVE');
        }
      }

      return result;
    }

    // "All locations" aggregated view
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

    // Group stocks by product
    const productStockMap = new Map<string, typeof allStocks>();
    allStocks.forEach((s) => {
      const list = productStockMap.get(s.productId) || [];
      list.push(s);
      productStockMap.set(s.productId, list);
    });

    const result = products.map((product) => {
      const pStocks = productStockMap.get(product.id) || [];
      const totalQuantity = pStocks.reduce(
        (sum, s) => sum + Number(s.quantity),
        0,
      );
      const totalMinStock = pStocks.reduce(
        (sum, s) => sum + Number(s.minimumStock),
        0,
      );
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
      } else if (stateUpper === 'LOW') {
        return result.filter((r) => r.state === 'LOW');
      } else if (stateUpper === 'OUT' || stateUpper === 'OUT_OF_STOCK') {
        return result.filter((r) => r.state === 'OUT_OF_STOCK');
      } else if (stateUpper === 'NEGATIVE') {
        return result.filter((r) => r.state === 'NEGATIVE');
      }
    }

    return result;
  }

  /**
   * Calculates inventory KPIs, responding directly to the selected location.
   */
  async getKpis(locationId?: string, businessId = 'default') {
    const products = await this.prisma.product.findMany({
      where: {
        businessId,
        active: true,
        tracksInventory: true,
        saleType: { not: ProductSaleType.KIT },
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

      const stockMap = new Map<string, (typeof stocks)[0]>();
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
        } else if (qty === 0) {
          outOfStockCount++;
        } else if (qty <= min) {
          lowStockCount++;
        } else {
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

    // Aggregated across all active locations
    const allStocks = await this.prisma.inventoryStock.findMany({
      where: {
        productId: { in: productIds },
        location: { businessId, active: true },
      },
    });

    const aggregatedQtyMap = new Map<string, number>();
    const aggregatedMinMap = new Map<string, number>();

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
      } else if (qty === 0) {
        outOfStockCount++;
      } else if (qty <= min) {
        lowStockCount++;
      } else {
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

  /**
   * Retrieves single product stock detail across all locations, recent movements, and kit breakdown if applicable.
   */
  async getProductStockDetails(productId: string, businessId = 'default') {
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
      throw new NotFoundException('Producto no encontrado');
    }

    const locations = await this.prisma.location.findMany({
      where: { businessId, active: true },
      orderBy: { name: 'asc' },
    });

    // If it's a KIT, stock is derived dynamically from its components
    if (product.saleType === ProductSaleType.KIT) {
      const kitExplosion = await this.getKitAvailabilityPerLocation(
        product.id,
        locations,
      );
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

    // Standard or Weight product
    const stocks = await this.prisma.inventoryStock.findMany({
      where: { productId },
    });
    const stockMap = new Map<string, (typeof stocks)[0]>();
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

  /**
   * Helper: calculates kit component availability per location.
   */
  private async getKitAvailabilityPerLocation(
    kitProductId: string,
    locations: { id: string; name: string; type: any }[],
  ) {
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

    const stockLookup = new Map<string, number>(); // key: `locationId_productId`
    componentStocks.forEach((cs) => {
      stockLookup.set(`${cs.locationId}_${cs.productId}`, Number(cs.quantity));
    });

    const locationsAvailability = locations.map((loc) => {
      let maxKitsPossible = Infinity;
      const componentStatus = components.map((c) => {
        const availableStock =
          stockLookup.get(`${loc.id}_${c.componentProductId}`) || 0;
        const qtyPerKit = Number(c.quantity);
        const kitsFromComponent =
          qtyPerKit > 0 ? Math.floor(availableStock / qtyPerKit) : 0;
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

      const finalKitsAvailable =
        maxKitsPossible === Infinity ? 0 : Math.max(0, maxKitsPossible);

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

  /**
   * Helper for future POS: explodes a kit into its component movements.
   */
  async explodeKitComponents(kitProductId: string, quantity = 1) {
    if (
      typeof quantity !== 'number' ||
      !Number.isFinite(quantity) ||
      !Number.isInteger(quantity)
    ) {
      throw new BadRequestException(
        'La cantidad de inventario debe ser un número entero.',
      );
    }
    const components = await this.prisma.productKitComponent.findMany({
      where: { kitProductId },
      include: { componentProduct: true },
    });

    if (components.length === 0) {
      throw new BadRequestException('El Kit no posee componentes configurados');
    }

    return components.map((c) => ({
      componentProductId: c.componentProductId,
      sku: c.componentProduct.sku,
      name: c.componentProduct.name,
      quantityPerKit: Number(c.quantity),
      totalQuantityDeduction: Number(c.quantity) * quantity,
    }));
  }

  /**
   * Adds inventory (ENTRY) atomically in a Prisma Transaction.
   */
  async addInventory(
    dto: AddInventoryDto,
    user: { id: string; name?: string; email?: string; role?: any },
    businessId = 'default',
  ) {
    if (
      typeof dto.quantity !== 'number' ||
      !Number.isFinite(dto.quantity) ||
      !Number.isInteger(dto.quantity)
    ) {
      throw new BadRequestException(
        'La cantidad de inventario debe ser un número entero.',
      );
    }
    if (dto.quantity <= 0) {
      throw new BadRequestException('La cantidad a agregar debe ser mayor a 0');
    }

    const location = await this.prisma.location.findFirst({
      where: { id: dto.locationId, businessId, active: true },
    });
    if (!location) {
      throw new NotFoundException('Ubicación no encontrada o inactiva');
    }

    const product = await this.prisma.product.findFirst({
      where: { id: dto.productId, businessId, active: true },
    });
    if (!product) {
      throw new NotFoundException('Producto no encontrado o inactivo');
    }
    if (product.saleType === ProductSaleType.KIT) {
      throw new BadRequestException(
        'Los Kits/Combos no manejan stock propio; su inventario se deriva de sus componentes.',
      );
    }

    const userName = user.name || user.email || 'Usuario';

    // Prisma Transaction: Atomic stock update & movement creation
    const result = await this.prisma.$transaction(async (tx) => {
      // Find or create current stock record
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
      } else {
        stock = await tx.inventoryStock.create({
          data: {
            locationId: dto.locationId,
            productId: dto.productId,
            quantity: newStock,
            minimumStock: minStock,
          },
        });
      }

      // Record movement
      const movement = await tx.inventoryMovement.create({
        data: {
          locationId: dto.locationId,
          productId: dto.productId,
          type: InventoryMovementType.ENTRY,
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

    // Audit log
    await this.auditService.logAudit(
      user.id,
      userName,
      user.role || 'Administrador',
      'INVENTORY_ENTRY',
      `Entrada de ${dto.quantity} unidades para "${product.name}" en "${location.name}". Stock: ${result.previousStock} -> ${result.newStock}`,
      result.movement.id,
    );

    return {
      success: true,
      productId: product.id,
      productName: product.name,
      locationId: location.id,
      locationName: location.name,
      previousStock: result.previousStock,
      quantityAdded: dto.quantity,
      newStock: result.newStock,
      state: this.computeStockState(
        result.newStock,
        Number(result.stock.minimumStock),
      ),
      movementId: result.movement.id,
    };
  }

  /**
   * Adjusts inventory (Positive or Negative) atomically in a Prisma Transaction.
   * NOTE: Does NOT block if newStock < 0!
   */
  async adjustInventory(
    dto: AdjustInventoryDto,
    user: { id: string; name?: string; email?: string; role?: any },
    businessId = 'default',
  ) {
    if (
      typeof dto.adjustmentQuantity !== 'number' ||
      !Number.isFinite(dto.adjustmentQuantity) ||
      !Number.isInteger(dto.adjustmentQuantity)
    ) {
      throw new BadRequestException(
        'La cantidad de inventario debe ser un número entero.',
      );
    }
    if (dto.adjustmentQuantity === 0) {
      throw new BadRequestException('La cantidad de ajuste no puede ser 0');
    }

    const location = await this.prisma.location.findFirst({
      where: { id: dto.locationId, businessId, active: true },
    });
    if (!location) {
      throw new NotFoundException('Ubicación no encontrada o inactiva');
    }

    const product = await this.prisma.product.findFirst({
      where: { id: dto.productId, businessId, active: true },
    });
    if (!product) {
      throw new NotFoundException('Producto no encontrado o inactivo');
    }
    if (product.saleType === ProductSaleType.KIT) {
      throw new BadRequestException(
        'Los Kits/Combos no manejan stock propio; su inventario se deriva de sus componentes.',
      );
    }

    const userName = user.name || user.email || 'Usuario';
    const movementType =
      dto.adjustmentQuantity > 0
        ? InventoryMovementType.ADJUSTMENT_POSITIVE
        : InventoryMovementType.ADJUSTMENT_NEGATIVE;

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
      } else {
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

    await this.auditService.logAudit(
      user.id,
      userName,
      user.role || 'Administrador',
      'INVENTORY_ADJUSTMENT',
      `Ajuste (${dto.adjustmentQuantity > 0 ? '+' : ''}${dto.adjustmentQuantity}) para "${product.name}" en "${location.name}". Motivo: ${dto.reason}. Stock: ${result.previousStock} -> ${result.newStock}`,
      result.movement.id,
    );

    return {
      success: true,
      productId: product.id,
      productName: product.name,
      locationId: location.id,
      locationName: location.name,
      previousStock: result.previousStock,
      adjustmentQuantity: dto.adjustmentQuantity,
      newStock: result.newStock,
      state: this.computeStockState(
        result.newStock,
        Number(result.stock.minimumStock),
      ),
      movementId: result.movement.id,
    };
  }

  /**
   * Transfers inventory between two stores/warehouses atomically.
   * Generates TRANSFER_OUT and TRANSFER_IN sharing a common transfer referenceId.
   * CRITICAL: Does NOT block transfer even if origin stock < transferred quantity!
   */
  async transferInventory(
    dto: TransferInventoryDto,
    user: { id: string; name?: string; email?: string; role?: any },
    businessId = 'default',
  ) {
    if (dto.fromLocationId === dto.toLocationId) {
      throw new BadRequestException(
        'La ubicación de origen y destino deben ser diferentes',
      );
    }
    if (
      typeof dto.quantity !== 'number' ||
      !Number.isFinite(dto.quantity) ||
      !Number.isInteger(dto.quantity)
    ) {
      throw new BadRequestException(
        'La cantidad de inventario debe ser un número entero.',
      );
    }
    if (dto.quantity <= 0) {
      throw new BadRequestException(
        'La cantidad a transferir debe ser mayor a 0',
      );
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
      throw new NotFoundException('Ubicación de origen no encontrada o inactiva');
    }
    if (!toLocation) {
      throw new NotFoundException(
        'Ubicación de destino no encontrada o inactiva',
      );
    }
    if (!product) {
      throw new NotFoundException('Producto no encontrado o inactivo');
    }
    if (product.saleType === ProductSaleType.KIT) {
      throw new BadRequestException(
        'Los Kits/Combos no pueden transferirse directamente ya que derivan su stock de componentes.',
      );
    }

    const userName = user.name || user.email || 'Usuario';
    const referenceId = `TRF-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Source location: decrement stock & create TRANSFER_OUT
      let fromStock = await tx.inventoryStock.findUnique({
        where: {
          locationId_productId: {
            locationId: dto.fromLocationId,
            productId: dto.productId,
          },
        },
      });

      const fromPreviousStock = fromStock ? Number(fromStock.quantity) : 0;
      const fromNewStock = fromPreviousStock - dto.quantity; // Can be negative! Allowed!
      const fromMinStock = fromStock
        ? Number(fromStock.minimumStock)
        : Number(product.defaultMinStock || 0);

      if (fromStock) {
        fromStock = await tx.inventoryStock.update({
          where: { id: fromStock.id },
          data: { quantity: fromNewStock },
        });
      } else {
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
          type: InventoryMovementType.TRANSFER_OUT,
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

      // 2. Destination location: increment stock & create TRANSFER_IN
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
      } else {
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
          type: InventoryMovementType.TRANSFER_IN,
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

    await this.auditService.logAudit(
      user.id,
      userName,
      user.role || 'Administrador',
      'INVENTORY_TRANSFER',
      `Transferencia de ${dto.quantity} unidades de "${product.name}" desde "${fromLocation.name}" (nuevo stock: ${result.fromNewStock}) hacia "${toLocation.name}" (nuevo stock: ${result.toNewStock}). Ref: ${result.referenceId}`,
      result.referenceId,
    );

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

  /**
   * Sets minimum stock per product and location without altering current quantity.
   */
  async setMinimumStock(
    dto: SetMinimumStockDto,
    user: { id: string; name?: string; email?: string; role?: any },
    businessId = 'default',
  ) {
    if (
      typeof dto.minimumStock !== 'number' ||
      !Number.isFinite(dto.minimumStock) ||
      !Number.isInteger(dto.minimumStock)
    ) {
      throw new BadRequestException(
        'La cantidad de inventario debe ser un número entero.',
      );
    }
    if (dto.minimumStock < 0) {
      throw new BadRequestException('El stock mínimo no puede ser negativo');
    }

    const location = await this.prisma.location.findFirst({
      where: { id: dto.locationId, businessId, active: true },
    });
    if (!location) {
      throw new NotFoundException('Ubicación no encontrada o inactiva');
    }

    const product = await this.prisma.product.findFirst({
      where: { id: dto.productId, businessId, active: true },
    });
    if (!product) {
      throw new NotFoundException('Producto no encontrado o inactivo');
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
      state: this.computeStockState(
        Number(stock.quantity),
        Number(stock.minimumStock),
      ),
    };
  }

  /**
   * Retrieves Kardex / historical inventory movements with multi-variable filters and pagination.
   */
  async getMovements(query: GetMovementsQueryDto, businessId = 'default') {
    const where: Prisma.InventoryMovementWhereInput = {
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
        // End of day
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
}
