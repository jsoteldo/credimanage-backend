import { Test, TestingModule } from '@nestjs/testing';
import { InventoryService } from './inventory.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ProductsService } from '../products/products.service';
import { SalesService } from '../sales/sales.service';
import { CashService } from '../cash/cash.service';
import { ExcelImporterService } from '../products/excel-importer.service';
import { BalanceSyncService } from '../transactions/balance-sync.service';
import { BadRequestException } from '@nestjs/common';
import {
  InventoryMovementType,
  LocationType,
  ProductSaleType,
  SaleStatus,
  SalePaymentMethod,
} from '@prisma/client';

describe('Regla de Negocio: Cantidades Enteras en Inventario (Pruebas A a J)', () => {
  let inventoryService: InventoryService;
  let productsService: ProductsService;
  let salesService: SalesService;

  // In-Memory simulated DB
  let locationsDb: any[] = [];
  let productsDb: any[] = [];
  let kitComponentsDb: any[] = [];
  let inventoryStockDb: any[] = [];
  let inventoryMovementDb: any[] = [];
  let auditLogsDb: any[] = [];
  let salesDb: any[] = [];
  let saleItemsDb: any[] = [];
  let salePaymentsDb: any[] = [];
  let cashSessionsDb: any[] = [];

  const adminUser = {
    id: 'u-admin',
    name: 'Admin User',
    email: 'admin@credimanage.com',
    role: 'Administrador',
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
    ];

    productsDb = [
      {
        id: 'prod-coca',
        businessId: 'default',
        sku: 'COCA-500',
        barcode: '7751234567890',
        name: 'Coca Cola 500ml',
        saleType: ProductSaleType.UNIT,
        costPrice: 2,
        salePrice: 3.5,
        wholesalePrice: 3,
        tracksInventory: true,
        defaultMinStock: 5,
        active: true,
      },
      {
        id: 'prod-arroz',
        businessId: 'default',
        sku: 'ARROZ-KG',
        barcode: '7759876543210',
        name: 'Arroz 1kg',
        saleType: ProductSaleType.UNIT,
        costPrice: 3,
        salePrice: 4.5,
        wholesalePrice: 4,
        tracksInventory: true,
        defaultMinStock: 10,
        active: true,
      },
    ];

    kitComponentsDb = [];
    inventoryStockDb = [];
    inventoryMovementDb = [];
    auditLogsDb = [];
    salesDb = [];
    saleItemsDb = [];
    salePaymentsDb = [];
    cashSessionsDb = [
      {
        id: 'cs-active',
        businessId: 'default',
        storeId: 'loc-tienda-a',
        status: 'OPEN',
        openedBy: adminUser.id,
      },
    ];

    const mockPrisma: any = {
      location: {
        findFirst: jest.fn(async ({ where }) => {
          return (
            locationsDb.find((l) => {
              if (where.id && l.id !== where.id) return false;
              if (where.businessId && l.businessId !== where.businessId) return false;
              if (where.active !== undefined && l.active !== where.active) return false;
              return true;
            }) || null
          );
        }),
        findMany: jest.fn(async () => locationsDb),
      },

      product: {
        findFirst: jest.fn(async ({ where }) => {
          return (
            productsDb.find((p) => {
              if (where.id && p.id !== where.id) return false;
              if (where.businessId && p.businessId !== where.businessId) return false;
              const targetSku = typeof where.sku === 'string' ? where.sku : where.sku?.equals;
              if (targetSku && p.sku.toLowerCase() !== targetSku.toLowerCase()) return false;
              if (where.active !== undefined && p.active !== where.active) return false;
              return true;
            }) || null
          );
        }),
        findUnique: jest.fn(async ({ where }) => {
          return productsDb.find((p) => p.id === where.id) || null;
        }),
        findMany: jest.fn(async ({ where }) => {
          return productsDb.filter((p) => {
            if (where?.id?.in && !where.id.in.includes(p.id)) return false;
            return true;
          });
        }),
        create: jest.fn(async ({ data }) => {
          const item = { id: `prod-${Date.now()}`, ...data };
          productsDb.push(item);
          return item;
        }),
        update: jest.fn(async ({ where, data }) => {
          const idx = productsDb.findIndex((p) => p.id === where.id);
          if (idx !== -1) {
            productsDb[idx] = { ...productsDb[idx], ...data };
            return productsDb[idx];
          }
          return null;
        }),
      },

      productKitComponent: {
        findMany: jest.fn(async ({ where }) => {
          return kitComponentsDb
            .filter((kc) => !where?.kitProductId || kc.kitProductId === where.kitProductId)
            .map((kc) => ({
              ...kc,
              componentProduct: productsDb.find((p) => p.id === kc.componentProductId),
            }));
        }),
        create: jest.fn(async ({ data }) => {
          const item = { id: `kc-${Date.now()}`, ...data };
          kitComponentsDb.push(item);
          return item;
        }),
        deleteMany: jest.fn(async ({ where }) => {
          kitComponentsDb = kitComponentsDb.filter((kc) => kc.kitProductId !== where.kitProductId);
          return { count: 1 };
        }),
      },

      inventoryStock: {
        findUnique: jest.fn(async ({ where }) => {
          const locId = where.locationId_productId?.locationId || where.locationId;
          const prodId = where.locationId_productId?.productId || where.productId;
          return (
            inventoryStockDb.find(
              (s) => s.locationId === locId && s.productId === prodId,
            ) || null
          );
        }),
        findMany: jest.fn(async ({ where }) => {
          return inventoryStockDb.filter((s) => {
            if (where.locationId && s.locationId !== where.locationId) return false;
            if (where.productId && s.productId !== where.productId) return false;
            return true;
          });
        }),
        create: jest.fn(async ({ data }) => {
          const item = {
            id: `stk-${Date.now()}-${Math.random()}`,
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          inventoryStockDb.push(item);
          return item;
        }),
        update: jest.fn(async ({ where, data }) => {
          const idx = inventoryStockDb.findIndex((s) => s.id === where.id);
          if (idx !== -1) {
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
          const locId = where.locationId_productId.locationId;
          const prodId = where.locationId_productId.productId;
          const idx = inventoryStockDb.findIndex(
            (s) => s.locationId === locId && s.productId === prodId,
          );
          if (idx !== -1) {
            inventoryStockDb[idx] = { ...inventoryStockDb[idx], ...update, updatedAt: new Date() };
            return inventoryStockDb[idx];
          } else {
            const item = { id: `stk-${Date.now()}`, ...create, createdAt: new Date(), updatedAt: new Date() };
            inventoryStockDb.push(item);
            return item;
          }
        }),
      },

      inventoryMovement: {
        create: jest.fn(async ({ data }) => {
          const item = {
            id: `mov-${Date.now()}-${Math.random()}`,
            ...data,
            createdAt: new Date(),
          };
          inventoryMovementDb.push(item);
          return item;
        }),
        findMany: jest.fn(async () => inventoryMovementDb),
      },

      sale: {
        findFirst: jest.fn(async () => null),
        create: jest.fn(async ({ data }) => {
          const item = { id: `sale-${Date.now()}`, ...data, createdAt: new Date() };
          salesDb.push(item);
          return item;
        }),
      },

      saleItem: {
        create: jest.fn(async ({ data }) => {
          const item = { id: `si-${Date.now()}`, ...data, createdAt: new Date() };
          saleItemsDb.push(item);
          return item;
        }),
      },

      salePayment: {
        create: jest.fn(async ({ data }) => {
          const item = { id: `sp-${Date.now()}`, ...data, createdAt: new Date() };
          salePaymentsDb.push(item);
          return item;
        }),
      },

      cashSession: {
        findFirst: jest.fn(async () => cashSessionsDb[0]),
        findUnique: jest.fn(async ({ where }) => cashSessionsDb.find((c) => c.id === where.id) || null),
      },

      cashMovement: {
        create: jest.fn(async ({ data }) => ({ id: `cm-${Date.now()}`, ...data })),
      },

      receiptConfig: {
        findFirst: jest.fn(async () => null),
      },

      receipt: {
        create: jest.fn(async ({ data }) => ({ id: `rc-${Date.now()}`, ...data })),
      },

      $transaction: jest.fn(async (callback) => {
        return callback(mockPrisma);
      }),
    };

    const mockAuditService = {
      logAudit: jest.fn(async (userId, userName, role, action, details, targetId) => {
        auditLogsDb.push({ userId, userName, role, action, details, targetId });
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        ProductsService,
        SalesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAuditService },
        { provide: ExcelImporterService, useValue: {} },
        { provide: CashService, useValue: { registerSalePayment: jest.fn() } },
        {
          provide: BalanceSyncService,
          useValue: { syncClientDailyDebtFromPurchases: jest.fn() },
        },
      ],
    }).compile();

    inventoryService = module.get<InventoryService>(InventoryService);
    productsService = module.get<ProductsService>(ProductsService);
    salesService = module.get<SalesService>(SalesService);
  });

  // A. Stock 100 + 13 = 113
  it('A: Stock 100 + 13 = 113 exacto entero', async () => {
    // Initial entry 100
    await inventoryService.addInventory(
      { locationId: 'loc-tienda-a', productId: 'prod-coca', quantity: 100 },
      adminUser,
    );
    // Add 13
    const result = await inventoryService.addInventory(
      { locationId: 'loc-tienda-a', productId: 'prod-coca', quantity: 13 },
      adminUser,
    );

    expect(result.previousStock).toBe(100);
    expect(result.quantityAdded).toBe(13);
    expect(result.newStock).toBe(113);
    expect(Number.isInteger(result.newStock)).toBe(true);

    const stockInDb = inventoryStockDb.find(
      (s) => s.locationId === 'loc-tienda-a' && s.productId === 'prod-coca',
    );
    expect(stockInDb.quantity).toBe(113);
    expect(Number.isInteger(stockInDb.quantity)).toBe(true);
  });

  // B. Stock 113 - 1 = 112
  it('B: Stock 113 - 1 = 112 al restar ajuste', async () => {
    inventoryStockDb.push({
      id: 'stk-init',
      locationId: 'loc-tienda-a',
      productId: 'prod-coca',
      quantity: 113,
      minimumStock: 5,
    });

    const result = await inventoryService.adjustInventory(
      {
        locationId: 'loc-tienda-a',
        productId: 'prod-coca',
        adjustmentQuantity: -1,
        reason: 'Merma',
      },
      adminUser,
    );

    expect(result.previousStock).toBe(113);
    expect(result.adjustmentQuantity).toBe(-1);
    expect(result.newStock).toBe(112);
    expect(Number.isInteger(result.newStock)).toBe(true);
  });

  // C. Stock 0 - 1 = -1 (permite stock negativo entero)
  it('C: Stock 0 - 1 = -1 permite stock negativo entero sin bloquear', async () => {
    // No stock exists initially -> previous is 0
    const result = await inventoryService.adjustInventory(
      {
        locationId: 'loc-tienda-a',
        productId: 'prod-coca',
        adjustmentQuantity: -1,
        reason: 'Venta desfasada',
      },
      adminUser,
    );

    expect(result.previousStock).toBe(0);
    expect(result.adjustmentQuantity).toBe(-1);
    expect(result.newStock).toBe(-1);
    expect(result.state).toBe('NEGATIVE');
    expect(Number.isInteger(result.newStock)).toBe(true);
  });

  // D. Entrada 1.5 -> rechazo con mensaje exacto
  it('D: Entrada con cantidad decimal (1.5) es rechazada', async () => {
    await expect(
      inventoryService.addInventory(
        { locationId: 'loc-tienda-a', productId: 'prod-coca', quantity: 1.5 },
        adminUser,
      ),
    ).rejects.toThrow('La cantidad de inventario debe ser un número entero.');
  });

  // E. Ajuste -2.5 -> rechazo con mensaje exacto
  it('E: Ajuste con cantidad decimal (-2.5) es rechazado', async () => {
    await expect(
      inventoryService.adjustInventory(
        {
          locationId: 'loc-tienda-a',
          productId: 'prod-coca',
          adjustmentQuantity: -2.5,
          reason: 'Conteo incorrecto',
        },
        adminUser,
      ),
    ).rejects.toThrow('La cantidad de inventario debe ser un número entero.');
  });

  // F. Transferencia 3.2 -> rechazo con mensaje exacto
  it('F: Transferencia con cantidad decimal (3.2) es rechazada', async () => {
    await expect(
      inventoryService.transferInventory(
        {
          fromLocationId: 'loc-tienda-a',
          toLocationId: 'loc-tienda-b',
          productId: 'prod-coca',
          quantity: 3.2,
        },
        adminUser,
      ),
    ).rejects.toThrow('La cantidad de inventario debe ser un número entero.');
  });

  // G. Venta quantity 1.5 -> rechazo con mensaje exacto
  it('G: Venta POS con cantidad decimal (1.5) es rechazada', async () => {
    await expect(
      salesService.createSale(
        {
          storeId: 'loc-tienda-a',
          items: [{ productId: 'prod-coca', quantity: 1.5 }],
          payments: [{ method: SalePaymentMethod.CASH, amount: 5.25 }],
        },
        adminUser,
      ),
    ).rejects.toThrow('La cantidad de inventario debe ser un número entero.');
  });

  // H. Kit componente 0.5 -> rechazo con mensaje exacto
  it('H: Kit con cantidad de componente decimal (0.5) es rechazado', async () => {
    await expect(
      productsService.createProduct({
        sku: 'KIT-PACK',
        name: 'Pack Ahorro',
        saleType: ProductSaleType.KIT,
        components: [{ componentProductId: 'prod-coca', quantity: 0.5 }],
      }),
    ).rejects.toThrow('La cantidad de inventario debe ser un número entero.');
  });

  // I. minimumStock decimal -> rechazo con mensaje exacto
  it('I: minimumStock decimal (5.5) es rechazado en configuración y producto', async () => {
    // 1. En setMinimumStock
    await expect(
      inventoryService.setMinimumStock(
        {
          locationId: 'loc-tienda-a',
          productId: 'prod-coca',
          minimumStock: 5.5,
        },
        adminUser,
      ),
    ).rejects.toThrow('La cantidad de inventario debe ser un número entero.');

    // 2. En createProduct
    await expect(
      productsService.createProduct({
        sku: 'GALLETAS',
        name: 'Galletas Vainilla',
        saleType: ProductSaleType.UNIT,
        defaultMinStock: 3.5,
      }),
    ).rejects.toThrow('La cantidad de inventario debe ser un número entero.');
  });

  // J. Todas las operaciones resultan siempre en entero
  it('J: Todas las operaciones consecutivas (entrada, transferencia, ajuste) resultan siempre en enteros', async () => {
    // 1. Entrada de 50
    const entry = await inventoryService.addInventory(
      { locationId: 'loc-tienda-a', productId: 'prod-coca', quantity: 50 },
      adminUser,
    );
    expect(Number.isInteger(entry.newStock)).toBe(true);
    expect(entry.newStock).toBe(50);

    // 2. Transferencia de 20 hacia Tienda B
    const transfer = await inventoryService.transferInventory(
      {
        fromLocationId: 'loc-tienda-a',
        toLocationId: 'loc-tienda-b',
        productId: 'prod-coca',
        quantity: 20,
      },
      adminUser,
    );
    expect(Number.isInteger(transfer.fromLocation.newStock)).toBe(true);
    expect(Number.isInteger(transfer.toLocation.newStock)).toBe(true);
    expect(transfer.fromLocation.newStock).toBe(30);
    expect(transfer.toLocation.newStock).toBe(20);

    // 3. Ajuste de -5 en Tienda A
    const adjust = await inventoryService.adjustInventory(
      {
        locationId: 'loc-tienda-a',
        productId: 'prod-coca',
        adjustmentQuantity: -5,
        reason: 'Rotura de botellas',
      },
      adminUser,
    );
    expect(Number.isInteger(adjust.newStock)).toBe(true);
    expect(adjust.newStock).toBe(25);

    // Verificar en DB que todos los stocks y movimientos registrados sean estrictamente enteros
    for (const stk of inventoryStockDb) {
      expect(Number.isInteger(stk.quantity)).toBe(true);
      expect(Number.isInteger(stk.minimumStock)).toBe(true);
    }

    for (const mov of inventoryMovementDb) {
      expect(Number.isInteger(mov.quantity)).toBe(true);
      expect(Number.isInteger(mov.previousStock)).toBe(true);
      expect(Number.isInteger(mov.newStock)).toBe(true);
    }
  });
});
