import { Test, TestingModule } from '@nestjs/testing';
import { InventoryService } from './inventory.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Reflector } from '@nestjs/core';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InventoryMovementType, LocationType, ProductSaleType } from '@prisma/client';

describe('ETAPA 1: Inventario Multi-Tienda / Multi-Almacén (Pruebas A a L)', () => {
  let inventoryService: InventoryService;
  let permissionsGuard: PermissionsGuard;
  let auditService: AuditService;

  // In-Memory simulated DB
  let locationsDb: any[] = [];
  let productsDb: any[] = [];
  let kitComponentsDb: any[] = [];
  let inventoryStockDb: any[] = [];
  let inventoryMovementDb: any[] = [];
  let auditLogsDb: any[] = [];
  let rolesDb: any[] = [];
  let permissionsDb: any[] = [];
  let rolePermissionsDb: any[] = [];

  const adminUser = {
    id: 'u-admin',
    name: 'Admin User',
    email: 'admin@credimanage.com',
    role: 'Administrador',
    permissions: [
      'inventory.view',
      'inventory.entry',
      'inventory.adjust',
      'inventory.transfer',
      'inventory.min_stock',
    ],
  };

  const cashierUser = {
    id: 'u-cashier',
    name: 'Cajero User',
    email: 'cajero@credimanage.com',
    role: 'Cajero',
    permissions: ['inventory.view'],
  };

  beforeEach(async () => {
    locationsDb = [
      {
        id: 'loc-tienda-a',
        businessId: 'default',
        name: 'Tienda Centro',
        code: 'T01',
        type: LocationType.STORE,
        active: true,
      },
      {
        id: 'loc-tienda-b',
        businessId: 'default',
        name: 'Tienda Norte',
        code: 'T02',
        type: LocationType.STORE,
        active: true,
      },
      {
        id: 'loc-almacen',
        businessId: 'default',
        name: 'Almacén Principal',
        code: 'A01',
        type: LocationType.WAREHOUSE,
        active: true,
      },
    ];

    productsDb = [
      {
        id: 'prod-coca',
        businessId: 'default',
        sku: 'COCA-500',
        barcode: '7751234567890',
        name: 'Coca Cola 500ml',
        saleType: ProductSaleType.UNIT,
        tracksInventory: true,
        defaultMinStock: 5,
        active: true,
      },
      {
        id: 'prod-arroz',
        businessId: 'default',
        sku: 'ARROZ-KG',
        barcode: '7759876543210',
        name: 'Arroz Costeño 1kg',
        saleType: ProductSaleType.WEIGHT,
        tracksInventory: true,
        defaultMinStock: 10,
        active: true,
      },
      {
        id: 'prod-kit-almuerzo',
        businessId: 'default',
        sku: 'KIT-ALMUERZO',
        barcode: '7750000000011',
        name: 'Combo Almuerzo Familiar',
        saleType: ProductSaleType.KIT,
        tracksInventory: false,
        defaultMinStock: 0,
        active: true,
      },
    ];

    kitComponentsDb = [
      {
        id: 'kc-1',
        kitProductId: 'prod-kit-almuerzo',
        componentProductId: 'prod-coca',
        quantity: 2,
        componentProduct: productsDb[0],
      },
      {
        id: 'kc-2',
        kitProductId: 'prod-kit-almuerzo',
        componentProductId: 'prod-arroz',
        quantity: 1,
        componentProduct: productsDb[1],
      },
    ];

    inventoryStockDb = [];
    inventoryMovementDb = [];
    auditLogsDb = [];

    const mockPrisma: any = {
      location: {
        findFirst: jest.fn(async ({ where }) => {
          return locationsDb.find((l) => {
            if (where.id && l.id !== where.id) return false;
            if (where.businessId && l.businessId !== where.businessId) return false;
            if (where.active !== undefined && l.active !== where.active) return false;
            return true;
          }) || null;
        }),
        findMany: jest.fn(async () => locationsDb),
      },

      product: {
        findFirst: jest.fn(async ({ where }) => {
          return productsDb.find((p) => {
            if (where.id && p.id !== where.id) return false;
            if (where.businessId && p.businessId !== where.businessId) return false;
            if (where.active !== undefined && p.active !== where.active) return false;
            return true;
          }) || null;
        }),
        findMany: jest.fn(async ({ where }) => {
          return productsDb.filter((p) => {
            if (where?.businessId && p.businessId !== where.businessId) return false;
            if (where?.active !== undefined && p.active !== where.active) return false;
            if (where?.saleType?.not && p.saleType === where.saleType.not) return false;
            return true;
          });
        }),
      },

      productKitComponent: {
        findMany: jest.fn(async ({ where }) => {
          return kitComponentsDb.filter((kc) => {
            if (where?.kitProductId && kc.kitProductId !== where.kitProductId) return false;
            return true;
          });
        }),
      },

      inventoryStock: {
        findUnique: jest.fn(async ({ where }) => {
          const { locationId, productId } = where.locationId_productId || {};
          return inventoryStockDb.find(
            (s) => s.locationId === locationId && s.productId === productId,
          ) || null;
        }),
        findMany: jest.fn(async ({ where }) => {
          return inventoryStockDb.filter((s) => {
            if (where?.locationId && s.locationId !== where.locationId) return false;
            if (where?.productId?.in && !where.productId.in.includes(s.productId)) return false;
            if (where?.productId && s.productId !== where.productId) return false;
            return true;
          });
        }),
        create: jest.fn(async ({ data }) => {
          const item = {
            id: `stock-${Date.now()}-${Math.random()}`,
            locationId: data.locationId,
            productId: data.productId,
            quantity: data.quantity,
            minimumStock: data.minimumStock ?? 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          inventoryStockDb.push(item);
          return item;
        }),
        update: jest.fn(async ({ where, data }) => {
          const idx = inventoryStockDb.findIndex((s) => s.id === where.id);
          if (idx >= 0) {
            inventoryStockDb[idx] = {
              ...inventoryStockDb[idx],
              ...data,
              updatedAt: new Date(),
            };
            return inventoryStockDb[idx];
          }
          return null;
        }),
        upsert: jest.fn(async ({ where, update, create }) => {
          const { locationId, productId } = where.locationId_productId || {};
          const idx = inventoryStockDb.findIndex(
            (s) => s.locationId === locationId && s.productId === productId,
          );
          if (idx >= 0) {
            inventoryStockDb[idx] = {
              ...inventoryStockDb[idx],
              ...update,
              updatedAt: new Date(),
            };
            return inventoryStockDb[idx];
          }
          const item = {
            id: `stock-${Date.now()}-${Math.random()}`,
            locationId,
            productId,
            quantity: create.quantity ?? 0,
            minimumStock: create.minimumStock ?? 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          inventoryStockDb.push(item);
          return item;
        }),
      },

      inventoryMovement: {
        create: jest.fn(async ({ data }) => {
          const item = {
            id: `mov-${Date.now()}-${Math.random()}`,
            locationId: data.locationId,
            productId: data.productId,
            type: data.type,
            quantity: data.quantity,
            previousStock: data.previousStock,
            newStock: data.newStock,
            referenceType: data.referenceType || null,
            referenceId: data.referenceId || null,
            reason: data.reason || null,
            notes: data.notes || null,
            createdBy: data.createdBy,
            createdAt: new Date(),
          };
          inventoryMovementDb.push(item);
          return item;
        }),
        findMany: jest.fn(async () => inventoryMovementDb),
        count: jest.fn(async () => inventoryMovementDb.length),
      },

      auditLog: {
        create: jest.fn(async ({ data }) => {
          const log = { id: `audit-${Date.now()}`, ...data };
          auditLogsDb.push(log);
          return log;
        }),
      },

      // Simulation of $transaction
      $transaction: jest.fn(async (cb: any) => {
        // Run callback passing transactional proxy
        return cb(mockPrisma);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        AuditService,
        PermissionsGuard,
        Reflector,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    inventoryService = module.get<InventoryService>(InventoryService);
    permissionsGuard = module.get<PermissionsGuard>(PermissionsGuard);
    auditService = module.get<AuditService>(AuditService);
  });

  // A. Entrada +10: 0 -> 10
  it('A. Entrada de stock +10: pasa de 0 a 10 correctamente', async () => {
    const result = await inventoryService.addInventory(
      {
        locationId: 'loc-tienda-a',
        productId: 'prod-coca',
        quantity: 10,
        notes: 'Compra de lote semanal',
      },
      adminUser,
    );

    expect(result.success).toBe(true);
    expect(result.previousStock).toBe(0);
    expect(result.quantityAdded).toBe(10);
    expect(result.newStock).toBe(10);
    expect(result.state).toBe('NORMAL');

    const stockInDb = inventoryStockDb.find(
      (s) => s.locationId === 'loc-tienda-a' && s.productId === 'prod-coca',
    );
    expect(stockInDb).toBeDefined();
    expect(stockInDb.quantity).toBe(10);
  });

  // B. Ajuste -4: 10 -> 6
  it('B. Ajuste de stock -4: pasa de 10 a 6 correctamente', async () => {
    // Seed initial stock of 10
    inventoryStockDb.push({
      id: 'st-coca-1',
      locationId: 'loc-tienda-a',
      productId: 'prod-coca',
      quantity: 10,
      minimumStock: 5,
    });

    const result = await inventoryService.adjustInventory(
      {
        locationId: 'loc-tienda-a',
        productId: 'prod-coca',
        adjustmentQuantity: -4,
        reason: 'Botellas rotas en transporte',
      },
      adminUser,
    );

    expect(result.success).toBe(true);
    expect(result.previousStock).toBe(10);
    expect(result.adjustmentQuantity).toBe(-4);
    expect(result.newStock).toBe(6);
    expect(result.state).toBe('NORMAL');

    const stockInDb = inventoryStockDb.find(
      (s) => s.locationId === 'loc-tienda-a' && s.productId === 'prod-coca',
    );
    expect(stockInDb.quantity).toBe(6);

    const mov = inventoryMovementDb.find(
      (m) => m.type === InventoryMovementType.ADJUSTMENT_NEGATIVE,
    );
    expect(mov).toBeDefined();
    expect(mov.previousStock).toBe(10);
    expect(mov.newStock).toBe(6);
    expect(mov.reason).toBe('Botellas rotas en transporte');
  });

  // C. Stock negativo: 2 - 5 -> -3 permitido
  it('C. Stock negativo: 2 - 5 -> -3 es permitido y no bloquea la operación', async () => {
    inventoryStockDb.push({
      id: 'st-coca-2',
      locationId: 'loc-tienda-a',
      productId: 'prod-coca',
      quantity: 2,
      minimumStock: 5,
    });

    const result = await inventoryService.adjustInventory(
      {
        locationId: 'loc-tienda-a',
        productId: 'prod-coca',
        adjustmentQuantity: -5,
        reason: 'Entrega por anticipado a cliente VIP',
      },
      adminUser,
    );

    expect(result.success).toBe(true);
    expect(result.previousStock).toBe(2);
    expect(result.newStock).toBe(-3);
    expect(result.state).toBe('NEGATIVE');

    const stockInDb = inventoryStockDb.find(
      (s) => s.locationId === 'loc-tienda-a' && s.productId === 'prod-coca',
    );
    expect(stockInDb.quantity).toBe(-3);
  });

  // D. minimumStock independiente por tienda
  it('D. minimumStock es independiente por cada tienda/ubicación', async () => {
    // Config Tienda Centro minimumStock = 10
    const resA = await inventoryService.setMinimumStock(
      {
        locationId: 'loc-tienda-a',
        productId: 'prod-coca',
        minimumStock: 10,
      },
      adminUser,
    );
    expect(resA.minimumStock).toBe(10);

    // Config Tienda Norte minimumStock = 5
    const resB = await inventoryService.setMinimumStock(
      {
        locationId: 'loc-tienda-b',
        productId: 'prod-coca',
        minimumStock: 5,
      },
      adminUser,
    );
    expect(resB.minimumStock).toBe(5);

    // Config Almacén minimumStock = 30
    const resAlm = await inventoryService.setMinimumStock(
      {
        locationId: 'loc-almacen',
        productId: 'prod-coca',
        minimumStock: 30,
      },
      adminUser,
    );
    expect(resAlm.minimumStock).toBe(30);

    const stockA = inventoryStockDb.find((s) => s.locationId === 'loc-tienda-a');
    const stockB = inventoryStockDb.find((s) => s.locationId === 'loc-tienda-b');
    const stockAlm = inventoryStockDb.find((s) => s.locationId === 'loc-almacen');

    expect(stockA.minimumStock).toBe(10);
    expect(stockB.minimumStock).toBe(5);
    expect(stockAlm.minimumStock).toBe(30);
  });

  // E. Transferencia: A 20 -> 10, B 5 -> 15
  it('E. Transferencia entre tiendas: Origen 20 -> 10, Destino 5 -> 15', async () => {
    // Seed: Tienda A = 20, Tienda B = 5
    inventoryStockDb.push({
      id: 'st-a',
      locationId: 'loc-tienda-a',
      productId: 'prod-arroz',
      quantity: 20,
      minimumStock: 5,
    });
    inventoryStockDb.push({
      id: 'st-b',
      locationId: 'loc-tienda-b',
      productId: 'prod-arroz',
      quantity: 5,
      minimumStock: 5,
    });

    const result = await inventoryService.transferInventory(
      {
        fromLocationId: 'loc-tienda-a',
        toLocationId: 'loc-tienda-b',
        productId: 'prod-arroz',
        quantity: 10,
        notes: 'Reabastecimiento regular',
      },
      adminUser,
    );

    expect(result.success).toBe(true);
    expect(result.fromLocation.previousStock).toBe(20);
    expect(result.fromLocation.newStock).toBe(10);
    expect(result.toLocation.previousStock).toBe(5);
    expect(result.toLocation.newStock).toBe(15);

    const stockA = inventoryStockDb.find((s) => s.locationId === 'loc-tienda-a' && s.productId === 'prod-arroz');
    const stockB = inventoryStockDb.find((s) => s.locationId === 'loc-tienda-b' && s.productId === 'prod-arroz');
    expect(stockA.quantity).toBe(10);
    expect(stockB.quantity).toBe(15);
  });

  // F. Transferencia con origen insuficiente: A 3 -> -2, B 0 -> 5
  it('F. Transferencia con origen insuficiente: A 3 -> -2, B 0 -> 5 (no se bloquea)', async () => {
    // Seed: Tienda A = 3, Tienda B = 0 (no row)
    inventoryStockDb.push({
      id: 'st-a-low',
      locationId: 'loc-tienda-a',
      productId: 'prod-coca',
      quantity: 3,
      minimumStock: 5,
    });

    const result = await inventoryService.transferInventory(
      {
        fromLocationId: 'loc-tienda-a',
        toLocationId: 'loc-tienda-b',
        productId: 'prod-coca',
        quantity: 5,
        notes: 'Transferencia urgente aceptada con advertencia de stock negativo',
      },
      adminUser,
    );

    expect(result.success).toBe(true);
    expect(result.fromLocation.previousStock).toBe(3);
    expect(result.fromLocation.newStock).toBe(-2);
    expect(result.toLocation.previousStock).toBe(0);
    expect(result.toLocation.newStock).toBe(5);

    const stockA = inventoryStockDb.find((s) => s.locationId === 'loc-tienda-a' && s.productId === 'prod-coca');
    const stockB = inventoryStockDb.find((s) => s.locationId === 'loc-tienda-b' && s.productId === 'prod-coca');
    expect(stockA.quantity).toBe(-2);
    expect(stockB.quantity).toBe(5);
  });

  // G. Transferencia atómica
  it('G. Transferencia es atómica: si ocurre error, ambas operaciones se descartan', async () => {
    const mockPrismaError: any = {
      location: {
        findFirst: jest.fn(async ({ where }) => {
          return locationsDb.find((l) => l.id === where.id) || null;
        }),
      },
      product: {
        findFirst: jest.fn(async () => productsDb[0]),
      },
      $transaction: jest.fn(async () => {
        throw new Error('Falla intencional en transacción de base de datos');
      }),
    };

    const moduleErr = await Test.createTestingModule({
      providers: [
        InventoryService,
        AuditService,
        { provide: PrismaService, useValue: mockPrismaError },
      ],
    }).compile();

    const serviceErr = moduleErr.get<InventoryService>(InventoryService);

    await expect(
      serviceErr.transferInventory(
        {
          fromLocationId: 'loc-tienda-a',
          toLocationId: 'loc-tienda-b',
          productId: 'prod-coca',
          quantity: 5,
        },
        adminUser,
      ),
    ).rejects.toThrow('Falla intencional en transacción de base de datos');
  });

  // H. Movimiento registra previous/new stock
  it('H. Cada movimiento registra exactamente previousStock y newStock trazable', async () => {
    await inventoryService.addInventory(
      {
        locationId: 'loc-tienda-a',
        productId: 'prod-coca',
        quantity: 15,
      },
      adminUser,
    );

    const movEntry = inventoryMovementDb[inventoryMovementDb.length - 1];
    expect(movEntry.type).toBe(InventoryMovementType.ENTRY);
    expect(movEntry.previousStock).toBe(0);
    expect(movEntry.quantity).toBe(15);
    expect(movEntry.newStock).toBe(15);

    await inventoryService.adjustInventory(
      {
        locationId: 'loc-tienda-a',
        productId: 'prod-coca',
        adjustmentQuantity: -3,
        reason: 'Merma',
      },
      adminUser,
    );

    const movAdj = inventoryMovementDb[inventoryMovementDb.length - 1];
    expect(movAdj.type).toBe(InventoryMovementType.ADJUSTMENT_NEGATIVE);
    expect(movAdj.previousStock).toBe(15);
    expect(movAdj.quantity).toBe(-3);
    expect(movAdj.newStock).toBe(12);
  });

  // I. Kit no crea stock independiente
  it('I. Un Kit no crea stock independiente; add/adjust/transfer directo son rechazados', async () => {
    await expect(
      inventoryService.addInventory(
        {
          locationId: 'loc-tienda-a',
          productId: 'prod-kit-almuerzo',
          quantity: 5,
        },
        adminUser,
      ),
    ).rejects.toThrow(BadRequestException);

    await expect(
      inventoryService.adjustInventory(
        {
          locationId: 'loc-tienda-a',
          productId: 'prod-kit-almuerzo',
          adjustmentQuantity: 5,
          reason: 'Ajuste no permitido',
        },
        adminUser,
      ),
    ).rejects.toThrow(BadRequestException);

    await expect(
      inventoryService.transferInventory(
        {
          fromLocationId: 'loc-tienda-a',
          toLocationId: 'loc-tienda-b',
          productId: 'prod-kit-almuerzo',
          quantity: 2,
        },
        adminUser,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  // J. Explosión de componentes del kit correcta
  it('J. Explosión de componentes del kit calcula cantidades multiplicadas para POS', async () => {
    // Kit compuesto por: 2 Coca Cola + 1 Arroz
    // Venta de 3 kits => 6 Coca Cola + 3 Arroz
    const explosion = await inventoryService.explodeKitComponents('prod-kit-almuerzo', 3);

    expect(explosion).toHaveLength(2);
    const cocaComp = explosion.find((c) => c.componentProductId === 'prod-coca');
    const arrozComp = explosion.find((c) => c.componentProductId === 'prod-arroz');

    expect(cocaComp).toBeDefined();
    expect(arrozComp).toBeDefined();

    expect(cocaComp!.quantityPerKit).toBe(2);
    expect(cocaComp!.totalQuantityDeduction).toBe(6);

    expect(arrozComp!.quantityPerKit).toBe(1);
    expect(arrozComp!.totalQuantityDeduction).toBe(3);
  });

  // K. Cajero no ajusta stock
  it('K. Cajero no tiene permiso para ajustar stock y es denegado por PermissionsGuard', () => {
    const mockReflector = {
      getAllAndOverride: jest.fn().mockReturnValue(['inventory.adjust']),
    };
    const guard = new PermissionsGuard(mockReflector as any);

    const mockExecutionContext = {
      getHandler: () => {},
      getClass: () => {},
      switchToHttp: () => ({
        getRequest: () => ({ user: cashierUser }),
      }),
    } as any;

    expect(() => guard.canActivate(mockExecutionContext)).toThrow(ForbiddenException);
  });

  // L. Administrador sí puede ajustar stock
  it('L. Administrador tiene todos los permisos requeridos y es autorizado por PermissionsGuard', () => {
    const mockReflector = {
      getAllAndOverride: jest.fn().mockReturnValue(['inventory.adjust']),
    };
    const guard = new PermissionsGuard(mockReflector as any);

    const mockExecutionContext = {
      getHandler: () => {},
      getClass: () => {},
      switchToHttp: () => ({
        getRequest: () => ({ user: adminUser }),
      }),
    } as any;

    expect(guard.canActivate(mockExecutionContext)).toBe(true);
  });
});
