import { Test, TestingModule } from '@nestjs/testing';
import { SalesService } from './sales.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { BalanceSyncService } from '../transactions/balance-sync.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  SaleStatus,
  SalePaymentMethod,
  ProductSaleType,
  InventoryMovementType,
  LocationType,
  Prisma,
} from '@prisma/client';
import { CashService } from '../cash/cash.service';

describe('ETAPA 2: POS / Registro de Ventas + Integración con Inventario (Pruebas A a AB)', () => {
  let salesService: SalesService;
  let balanceSyncService: BalanceSyncService;

  // In-memory simulated databases
  let locationsDb: any[] = [];
  let productsDb: any[] = [];
  let kitComponentsDb: any[] = [];
  let inventoryStockDb: any[] = [];
  let inventoryMovementDb: any[] = [];
  let salesDb: any[] = [];
  let saleItemsDb: any[] = [];
  let salePaymentsDb: any[] = [];
  let clientsDb: any[] = [];
  let creditPurchasesDb: any[] = [];
  let auditLogsDb: any[] = [];

  const cashierUser = {
    id: 'u-cashier',
    name: 'Juan Cajero',
    email: 'cajero@credimanage.com',
    role: 'Cajero',
    permissions: ['sales.view', 'sales.create'],
  };

  const adminUser = {
    id: 'u-admin',
    name: 'Admin General',
    email: 'admin@credimanage.com',
    role: 'Administrador',
    permissions: ['sales.view', 'sales.create', 'sales.annul'],
  };

  beforeEach(async () => {
    locationsDb = [
      {
        id: 'loc-tienda-centro',
        businessId: 'default',
        name: 'Tienda Centro',
        code: 'TC01',
        type: LocationType.STORE,
        active: true,
      },
      {
        id: 'loc-tienda-norte',
        businessId: 'default',
        name: 'Tienda Norte',
        code: 'TN02',
        type: LocationType.STORE,
        active: true,
      },
    ];

    productsDb = [
      {
        id: 'prod-coca',
        businessId: 'default',
        sku: 'COCA-500',
        barcode: '775001',
        name: 'Coca Cola 500ml',
        saleType: ProductSaleType.UNIT,
        salePrice: new Prisma.Decimal(3.0),
        tracksInventory: true,
        defaultMinStock: new Prisma.Decimal(5),
        active: true,
      },
      {
        id: 'prod-arroz',
        businessId: 'default',
        sku: 'ARROZ-KG',
        barcode: '775002',
        name: 'Arroz Costeño 1kg',
        saleType: ProductSaleType.WEIGHT,
        salePrice: new Prisma.Decimal(5.0),
        tracksInventory: true,
        defaultMinStock: new Prisma.Decimal(10),
        active: true,
      },
      {
        id: 'prod-galleta',
        businessId: 'default',
        sku: 'GALL-01',
        barcode: '775003',
        name: 'Galleta Soda',
        saleType: ProductSaleType.UNIT,
        salePrice: new Prisma.Decimal(1.0),
        tracksInventory: true,
        defaultMinStock: new Prisma.Decimal(5),
        active: true,
      },
      {
        id: 'prod-kit-baraton',
        businessId: 'default',
        sku: 'KIT-BARATON',
        barcode: '775KIT01',
        name: 'Kit Baratón',
        saleType: ProductSaleType.KIT,
        salePrice: new Prisma.Decimal(12.0),
        tracksInventory: false,
        defaultMinStock: new Prisma.Decimal(0),
        active: true,
      },
    ];

    kitComponentsDb = [
      {
        id: 'kc-1',
        kitProductId: 'prod-kit-baraton',
        componentProductId: 'prod-coca',
        quantity: new Prisma.Decimal(2),
        componentProduct: productsDb[0],
      },
      {
        id: 'kc-2',
        kitProductId: 'prod-kit-baraton',
        componentProductId: 'prod-arroz',
        quantity: new Prisma.Decimal(1),
        componentProduct: productsDb[1],
      },
      {
        id: 'kc-3',
        kitProductId: 'prod-kit-baraton',
        componentProductId: 'prod-galleta',
        quantity: new Prisma.Decimal(1),
        componentProduct: productsDb[2],
      },
    ];

    clientsDb = [
      {
        id: 'cli-juan',
        clientNumber: 'CLI-1001',
        name: 'Juan Pérez',
        phone: '987654321',
        creditLimit: 500,
        currentBalance: 600, // 100 daily + 500 bank
        dailyDebtBalance: new Prisma.Decimal(100),
        bankDebtBalance: new Prisma.Decimal(500),
        status: 'Activo',
      },
    ];

    inventoryStockDb = [];
    inventoryMovementDb = [];
    salesDb = [];
    saleItemsDb = [];
    salePaymentsDb = [];
    creditPurchasesDb = [];
    auditLogsDb = [];

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
      },
      product: {
        findUnique: jest.fn(async ({ where }) => {
          return productsDb.find((p) => p.id === where.id) || null;
        }),
        findMany: jest.fn(async ({ where }) => {
          return productsDb
            .filter((p) => {
              if (where?.id?.in && !where.id.in.includes(p.id)) return false;
              if (where?.businessId && p.businessId !== where.businessId) return false;
              return true;
            })
            .map((p) => ({
              ...p,
              kitComponents: kitComponentsDb.filter((kc) => kc.kitProductId === p.id),
            }));
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
      client: {
        findUnique: jest.fn(async ({ where }) => {
          return clientsDb.find((c) => c.id === where.id) || null;
        }),
        update: jest.fn(async ({ where, data }) => {
          const client = clientsDb.find((c) => c.id === where.id);
          if (client) {
            Object.assign(client, data);
          }
          return client;
        }),
      },
      inventoryStock: {
        findUnique: jest.fn(async ({ where }) => {
          const { locationId, productId } = where.locationId_productId || {};
          return (
            inventoryStockDb.find(
              (s) => s.locationId === locationId && s.productId === productId,
            ) || null
          );
        }),
        create: jest.fn(async ({ data }) => {
          const stock = {
            id: `stock-${Date.now()}-${Math.random()}`,
            ...data,
          };
          inventoryStockDb.push(stock);
          return stock;
        }),
        update: jest.fn(async ({ where, data }) => {
          const s = inventoryStockDb.find((st) => st.id === where.id);
          if (s) {
            Object.assign(s, data);
          }
          return s;
        }),
      },
      inventoryMovement: {
        create: jest.fn(async ({ data }) => {
          const m = {
            id: `mov-${Date.now()}-${Math.random()}`,
            ...data,
            createdAt: new Date(),
          };
          inventoryMovementDb.push(m);
          return m;
        }),
        deleteMany: jest.fn(async ({ where }) => {
          if (where?.saleId) {
            inventoryMovementDb = inventoryMovementDb.filter((m) => m.saleId !== where.saleId);
          }
          return { count: 1 };
        }),
      },
      sale: {
        findFirst: jest.fn(async ({ orderBy }) => {
          if (salesDb.length === 0) return null;
          return salesDb[salesDb.length - 1];
        }),
        findUnique: jest.fn(async ({ where }) => {
          const s = salesDb.find((sl) => sl.id === where.id);
          if (!s) return null;
          return {
            ...s,
            store: locationsDb.find((l) => l.id === s.storeId),
            client: clientsDb.find((c) => c.id === s.clientId),
            items: saleItemsDb.filter((it) => it.saleId === s.id),
            payments: salePaymentsDb.filter((p) => p.saleId === s.id),
            creditPurchases: creditPurchasesDb.filter((cp) => cp.saleId === s.id),
          };
        }),
        findMany: jest.fn(async () => salesDb),
        count: jest.fn(async () => salesDb.length),
        create: jest.fn(async ({ data }) => {
          const s = {
            id: `sale-${Date.now()}-${Math.random()}`,
            ...data,
            createdAt: new Date(),
          };
          salesDb.push(s);
          return s;
        }),
        update: jest.fn(async ({ where, data }) => {
          const s = salesDb.find((sl) => sl.id === where.id);
          if (s) {
            Object.assign(s, data);
          }
          return s;
        }),
      },
      saleItem: {
        create: jest.fn(async ({ data }) => {
          const item = {
            id: `item-${Date.now()}-${Math.random()}`,
            ...data,
            createdAt: new Date(),
          };
          saleItemsDb.push(item);
          return item;
        }),
        deleteMany: jest.fn(async ({ where }) => {
          if (where?.saleId) {
            saleItemsDb = saleItemsDb.filter((i) => i.saleId !== where.saleId);
          }
          return { count: 1 };
        }),
      },
      salePayment: {
        create: jest.fn(async ({ data }) => {
          const pay = {
            id: `pay-${Date.now()}-${Math.random()}`,
            ...data,
            createdAt: new Date(),
          };
          salePaymentsDb.push(pay);
          return pay;
        }),
        deleteMany: jest.fn(async ({ where }) => {
          if (where?.saleId) {
            salePaymentsDb = salePaymentsDb.filter((p) => p.saleId !== where.saleId);
          }
          return { count: 1 };
        }),
      },
      creditPurchase: {
        create: jest.fn(async ({ data }) => {
          const cp = {
            id: `cp-${Date.now()}-${Math.random()}`,
            ...data,
            createdAt: new Date(),
          };
          creditPurchasesDb.push(cp);
          return cp;
        }),
        findMany: jest.fn(async ({ where }) => {
          return creditPurchasesDb.filter((cp) => {
            if (where?.saleId && cp.saleId !== where.saleId) return false;
            return true;
          });
        }),
        update: jest.fn(async ({ where, data }) => {
          const cp = creditPurchasesDb.find((c) => c.id === where.id);
          if (cp) {
            Object.assign(cp, data);
          }
          return cp;
        }),
        updateMany: jest.fn(async ({ where, data }) => {
          return { count: 0 };
        }),
        deleteMany: jest.fn(async ({ where }) => {
          if (where?.saleId) {
            creditPurchasesDb = creditPurchasesDb.filter((cp) => cp.saleId !== where.saleId);
          }
          return { count: 1 };
        }),
      },
      cashSession: {
        findFirst: jest.fn(async () => ({
          id: 'session-test-01',
          cashRegisterId: 'reg-01',
          storeId: 'loc-tienda-centro',
          status: 'OPEN',
          businessId: 'default',
        })),
        findUnique: jest.fn(async () => ({
          id: 'session-test-01',
          cashRegisterId: 'reg-01',
          storeId: 'loc-tienda-centro',
          status: 'OPEN',
          businessId: 'default',
        })),
      },
      cashMovement: {
        create: jest.fn(async ({ data }) => ({ id: `mov-${Date.now()}`, ...data })),
        deleteMany: jest.fn(async () => ({ count: 1 })),
      },
      receipt: {
        create: jest.fn(async ({ data }) => ({ id: `rec-${Date.now()}`, ...data })),
      },
      $transaction: jest.fn(async (cb) => {
        return cb(mockPrisma);
      }),
    };

    const mockAuditService = {
      logAudit: jest.fn(async () => {}),
    };

    const mockBalanceSyncService = {
      syncClientBalances: jest.fn(async (clientId: string, tx: any) => {
        const client = clientsDb.find((c) => c.id === clientId);
        if (!client) return null;

        // Sum active credit purchases for this client
        const activePurchases = creditPurchasesDb.filter(
          (p) => p.clientId === clientId && p.status === 'Activo',
        );
        const dailyDebt = 100 + activePurchases.reduce((acc, p) => acc + Number(p.amount), 0);
        const bankDebt = Number(client.bankDebtBalance);
        const currentBalance = dailyDebt + bankDebt;

        client.dailyDebtBalance = new Prisma.Decimal(dailyDebt);
        client.currentBalance = currentBalance;

        return {
          dailyDebtBalance: dailyDebt,
          bankDebtBalance: bankDebt,
          currentBalance: currentBalance,
          availableCredit: client.creditLimit > 0 ? Math.max(0, client.creditLimit - dailyDebt - bankDebt) : 'Sin límite',
        };
      }),
    };

    const mockCashService = {
      getReceiptConfig: jest.fn(async () => ({
        businessName: 'CrediManage Test',
        series: 'B001',
      })),
      generateNextReceiptNumber: jest.fn(async () => ({
        number: 'B001-000001',
        sequence: 1,
        series: 'B001',
      })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SalesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAuditService },
        { provide: BalanceSyncService, useValue: mockBalanceSyncService },
        { provide: CashService, useValue: mockCashService },
      ],
    }).compile();

    salesService = module.get<SalesService>(SalesService);
    balanceSyncService = module.get<BalanceSyncService>(BalanceSyncService);
  });

  // =========================================================================
  // 57. TESTS BACKEND — VENTA NORMAL
  // =========================================================================
  describe('57. Venta Normal', () => {
    it('A. Venta producto normal: stock 10, venta 2 -> stock final 8', async () => {
      inventoryStockDb.push({
        id: 'st-coca-centro',
        locationId: 'loc-tienda-centro',
        productId: 'prod-coca',
        quantity: new Prisma.Decimal(10),
        minimumStock: new Prisma.Decimal(5),
      });

      const result = await salesService.createSale(
        {
          storeId: 'loc-tienda-centro',
          items: [{ productId: 'prod-coca', quantity: 2 }],
          payments: [{ method: SalePaymentMethod.CASH, amount: 6.0 }],
        },
        cashierUser,
      );

      const stock = inventoryStockDb.find(
        (s) => s.locationId === 'loc-tienda-centro' && s.productId === 'prod-coca',
      );
      expect(Number(stock.quantity)).toBe(8);
      expect(result.total).toBe(6.0);
    });

    it('B. Stock insuficiente permitido: stock 2, venta 5 -> stock final -3 (no bloquea)', async () => {
      inventoryStockDb.push({
        id: 'st-coca-centro',
        locationId: 'loc-tienda-centro',
        productId: 'prod-coca',
        quantity: new Prisma.Decimal(2),
        minimumStock: new Prisma.Decimal(5),
      });

      const result = await salesService.createSale(
        {
          storeId: 'loc-tienda-centro',
          items: [{ productId: 'prod-coca', quantity: 5 }],
          payments: [{ method: SalePaymentMethod.CASH, amount: 15.0 }],
        },
        cashierUser,
      );

      const stock = inventoryStockDb.find(
        (s) => s.locationId === 'loc-tienda-centro' && s.productId === 'prod-coca',
      );
      expect(Number(stock.quantity)).toBe(-3);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('stock negativo (-3 unidades)');
    });

    it('C. InventoryMovement SALE correcto con quantity negativa, previousStock y newStock', async () => {
      inventoryStockDb.push({
        id: 'st-coca-centro',
        locationId: 'loc-tienda-centro',
        productId: 'prod-coca',
        quantity: new Prisma.Decimal(10),
        minimumStock: new Prisma.Decimal(5),
      });

      await salesService.createSale(
        {
          storeId: 'loc-tienda-centro',
          items: [{ productId: 'prod-coca', quantity: 3 }],
          payments: [{ method: SalePaymentMethod.CASH, amount: 9.0 }],
        },
        cashierUser,
      );

      const mov = inventoryMovementDb.find(
        (m) => m.locationId === 'loc-tienda-centro' && m.productId === 'prod-coca',
      );
      expect(mov).toBeDefined();
      expect(mov.type).toBe(InventoryMovementType.SALE);
      expect(Number(mov.quantity)).toBe(-3);
      expect(Number(mov.previousStock)).toBe(10);
      expect(Number(mov.newStock)).toBe(7);
      expect(mov.referenceType).toBe('SALE');
    });

    it('D. Sale total correcto con múltiples items', async () => {
      inventoryStockDb.push(
        {
          id: 'st-coca',
          locationId: 'loc-tienda-centro',
          productId: 'prod-coca',
          quantity: new Prisma.Decimal(10),
        },
        {
          id: 'st-arroz',
          locationId: 'loc-tienda-centro',
          productId: 'prod-arroz',
          quantity: new Prisma.Decimal(10),
        },
      );

      // Coca (3.00) x 2 = 6.00, Arroz (5.00) x 3 = 15.00 -> Total = 21.00
      const result = await salesService.createSale(
        {
          storeId: 'loc-tienda-centro',
          items: [
            { productId: 'prod-coca', quantity: 2 },
            { productId: 'prod-arroz', quantity: 3 },
          ],
          payments: [{ method: SalePaymentMethod.CASH, amount: 21.0 }],
        },
        cashierUser,
      );

      expect(result.subtotal).toBe(21.0);
      expect(result.total).toBe(21.0);
    });

    it('E. SaleItem snapshot guarda histórico inmutable', async () => {
      inventoryStockDb.push({
        id: 'st-coca',
        locationId: 'loc-tienda-centro',
        productId: 'prod-coca',
        quantity: new Prisma.Decimal(10),
      });

      const result = await salesService.createSale(
        {
          storeId: 'loc-tienda-centro',
          items: [{ productId: 'prod-coca', quantity: 2 }],
          payments: [{ method: SalePaymentMethod.CASH, amount: 6.0 }],
        },
        cashierUser,
      );

      const item = result.items[0];
      expect(item.productCode).toBe('COCA-500');
      expect(item.productName).toBe('Coca Cola 500ml');
      expect(item.unitPrice).toBe(3.0);
      expect(item.quantity).toBe(2);
      expect(item.lineTotal).toBe(6.0);
    });

    it('F. Producto repetido en carrito se acumula y descuenta la cantidad consolidada', async () => {
      inventoryStockDb.push({
        id: 'st-coca',
        locationId: 'loc-tienda-centro',
        productId: 'prod-coca',
        quantity: new Prisma.Decimal(10),
      });

      // Product repeated in items list: 2 units + 3 units = 5 units
      const result = await salesService.createSale(
        {
          storeId: 'loc-tienda-centro',
          items: [
            { productId: 'prod-coca', quantity: 2 },
            { productId: 'prod-coca', quantity: 3 },
          ],
          payments: [{ method: SalePaymentMethod.CASH, amount: 15.0 }],
        },
        cashierUser,
      );

      const stock = inventoryStockDb.find(
        (s) => s.locationId === 'loc-tienda-centro' && s.productId === 'prod-coca',
      );
      expect(Number(stock.quantity)).toBe(5);
      expect(result.items.length).toBe(1);
      expect(result.items[0].quantity).toBe(5);
      expect(result.total).toBe(15.0);
    });
  });

  // =========================================================================
  // 58. TESTS BACKEND — KIT / COMBO
  // =========================================================================
  describe('58. Productos Kit / Combo', () => {
    it('G. Kit Baratón (2 Coca, 1 Arroz, 1 Galleta): vender 3 descuenta Coca -6, Arroz -3, Galleta -3', async () => {
      inventoryStockDb.push(
        {
          id: 'st-coca',
          locationId: 'loc-tienda-centro',
          productId: 'prod-coca',
          quantity: new Prisma.Decimal(20),
        },
        {
          id: 'st-arroz',
          locationId: 'loc-tienda-centro',
          productId: 'prod-arroz',
          quantity: new Prisma.Decimal(10),
        },
        {
          id: 'st-galleta',
          locationId: 'loc-tienda-centro',
          productId: 'prod-galleta',
          quantity: new Prisma.Decimal(15),
        },
      );

      // Kit Baratón price = 12.00 x 3 = 36.00
      const result = await salesService.createSale(
        {
          storeId: 'loc-tienda-centro',
          items: [{ productId: 'prod-kit-baraton', quantity: 3 }],
          payments: [{ method: SalePaymentMethod.CASH, amount: 36.0 }],
        },
        cashierUser,
      );

      expect(result.total).toBe(36.0);
      expect(result.items[0].productName).toBe('Kit Baratón');
      expect(result.items[0].productType).toBe(ProductSaleType.KIT);

      const cocaStock = inventoryStockDb.find((s) => s.productId === 'prod-coca');
      const arrozStock = inventoryStockDb.find((s) => s.productId === 'prod-arroz');
      const galletaStock = inventoryStockDb.find((s) => s.productId === 'prod-galleta');

      expect(Number(cocaStock.quantity)).toBe(14); // 20 - 6
      expect(Number(arrozStock.quantity)).toBe(7); // 10 - 3
      expect(Number(galletaStock.quantity)).toBe(12); // 15 - 3
    });

    it('H. Kit no crea ni modifica stock propio para el producto Kit', async () => {
      await salesService.createSale(
        {
          storeId: 'loc-tienda-centro',
          items: [{ productId: 'prod-kit-baraton', quantity: 1 }],
          payments: [{ method: SalePaymentMethod.CASH, amount: 12.0 }],
        },
        cashierUser,
      );

      const kitStock = inventoryStockDb.find(
        (s) => s.productId === 'prod-kit-baraton',
      );
      expect(kitStock).toBeUndefined();
    });

    it('I. Kit puede llevar componentes a stock negativo sin bloquear la venta', async () => {
      inventoryStockDb.push({
        id: 'st-coca',
        locationId: 'loc-tienda-centro',
        productId: 'prod-coca',
        quantity: new Prisma.Decimal(2), // Requires 6 for 3 kits -> will end up at -4
      });

      const result = await salesService.createSale(
        {
          storeId: 'loc-tienda-centro',
          items: [{ productId: 'prod-kit-baraton', quantity: 3 }],
          payments: [{ method: SalePaymentMethod.CASH, amount: 36.0 }],
        },
        cashierUser,
      );

      const cocaStock = inventoryStockDb.find((s) => s.productId === 'prod-coca');
      expect(Number(cocaStock.quantity)).toBe(-4);
      expect(result.warnings.some((w) => w.includes('Coca Cola'))).toBe(true);
    });
  });

  // =========================================================================
  // 59. TESTS BACKEND — PAGOS
  // =========================================================================
  describe('59. Métodos de Pago y Cuadre', () => {
    it('J. Pago efectivo 100%', async () => {
      const result = await salesService.createSale(
        {
          storeId: 'loc-tienda-centro',
          items: [{ productId: 'prod-coca', quantity: 2 }], // 6.00
          payments: [{ method: SalePaymentMethod.CASH, amount: 6.0 }],
        },
        cashierUser,
      );
      expect(result.paymentStatus).toBe('PAID');
      expect(result.payments[0].method).toBe(SalePaymentMethod.CASH);
    });

    it('K. Pago Yape 100%', async () => {
      const result = await salesService.createSale(
        {
          storeId: 'loc-tienda-centro',
          items: [{ productId: 'prod-coca', quantity: 2 }], // 6.00
          payments: [
            {
              method: SalePaymentMethod.YAPE,
              amount: 6.0,
              reference: 'OP-987654',
            },
          ],
        },
        cashierUser,
      );
      expect(result.payments[0].method).toBe(SalePaymentMethod.YAPE);
      expect(result.payments[0].reference).toBe('OP-987654');
    });

    it('L. Pago mixto: 40 cash, 30 Yape, 30 Card = 100', async () => {
      // 20 arroz (5.00 each) = 100.00
      const result = await salesService.createSale(
        {
          storeId: 'loc-tienda-centro',
          items: [{ productId: 'prod-arroz', quantity: 20 }],
          payments: [
            { method: SalePaymentMethod.CASH, amount: 40.0 },
            { method: SalePaymentMethod.YAPE, amount: 30.0, reference: 'YP-123' },
            { method: SalePaymentMethod.CARD, amount: 30.0, reference: 'VISA-4455' },
          ],
        },
        cashierUser,
      );
      expect(result.total).toBe(101.5);
      expect(result.cardSurcharge).toBe(1.5);
      expect(result.paymentStatus).toBe('MIXED');
      expect(result.payments.length).toBe(3);
    });

    it('M. Pagos que suman 90 para venta de 100 -> rechazo con error de descuadre', async () => {
      await expect(
        salesService.createSale(
          {
            storeId: 'loc-tienda-centro',
            items: [{ productId: 'prod-arroz', quantity: 20 }], // 100.00
            payments: [
              { method: SalePaymentMethod.CASH, amount: 40.0 },
              { method: SalePaymentMethod.YAPE, amount: 30.0 },
              { method: SalePaymentMethod.CARD, amount: 20.0 }, // Sum = 90
            ],
          },
          cashierUser,
        ),
      ).rejects.toThrow('Faltan S/ 10.00 para completar el total de la venta');
    });

    it('N. Cambio: venta 80, recibido 100, cambio 20, SalePayment CASH = 80', async () => {
      // 16 arroz = 80.00
      const result = await salesService.createSale(
        {
          storeId: 'loc-tienda-centro',
          items: [{ productId: 'prod-arroz', quantity: 16 }],
          payments: [{ method: SalePaymentMethod.CASH, amount: 80.0 }],
          cashReceived: 100.0,
        },
        cashierUser,
      );

      expect(result.total).toBe(80.0);
      expect(result.cashReceived).toBe(100.0);
      expect(result.cashChange).toBe(20.0);
      expect(result.payments[0].amount).toBe(80.0);
    });
  });

  // =========================================================================
  // 60. TESTS BACKEND — CRÉDITO E INTEGRACIÓN CONTABLE
  // =========================================================================
  describe('60. Venta a Crédito y Deuda Corriente', () => {
    it('O. Venta crédito sin cliente -> rechazo', async () => {
      await expect(
        salesService.createSale(
          {
            storeId: 'loc-tienda-centro',
            items: [{ productId: 'prod-coca', quantity: 2 }],
            payments: [{ method: SalePaymentMethod.CREDIT, amount: 6.0 }],
            clientId: null,
          },
          cashierUser,
        ),
      ).rejects.toThrow('Selecciona un cliente para registrar una venta a crédito');
    });

    it('P. Venta crédito 100: dailyDebtBalance aumenta exactamente total', async () => {
      // Juan initial dailyDebt = 100, bankDebt = 500
      const result = await salesService.createSale(
        {
          storeId: 'loc-tienda-centro',
          clientId: 'cli-juan',
          items: [{ productId: 'prod-arroz', quantity: 20 }], // 100.00
          payments: [{ method: SalePaymentMethod.CREDIT, amount: 100.0 }],
        },
        cashierUser,
      );

      expect(result.paymentStatus).toBe('CREDIT');
      expect(balanceSyncService.syncClientBalances).toHaveBeenCalledWith(
        'cli-juan',
        expect.anything(),
      );

      const juan = clientsDb.find((c) => c.id === 'cli-juan');
      expect(Number(juan.dailyDebtBalance)).toBe(200); // 100 initial + 100 credit
      expect(Number(juan.bankDebtBalance)).toBe(500); // bank debt unchanged
      expect(juan.currentBalance).toBe(700); // 200 + 500
    });

    it('Q. Venta mixta: total 100, cash 40, credit 60 -> dailyDebtBalance aumenta 60', async () => {
      // Juan initial dailyDebt = 100
      const result = await salesService.createSale(
        {
          storeId: 'loc-tienda-centro',
          clientId: 'cli-juan',
          items: [{ productId: 'prod-arroz', quantity: 20 }], // 100.00
          payments: [
            { method: SalePaymentMethod.CASH, amount: 40.0 },
            { method: SalePaymentMethod.CREDIT, amount: 60.0 },
          ],
        },
        cashierUser,
      );

      expect(result.paymentStatus).toBe('MIXED');
      const juan = clientsDb.find((c) => c.id === 'cli-juan');
      expect(Number(juan.dailyDebtBalance)).toBe(160); // 100 + 60
    });

    it('R. bankDebtBalance no cambia bajo ninguna circunstancia por una venta POS', async () => {
      await salesService.createSale(
        {
          storeId: 'loc-tienda-centro',
          clientId: 'cli-juan',
          items: [{ productId: 'prod-coca', quantity: 5 }], // 15.00
          payments: [{ method: SalePaymentMethod.CREDIT, amount: 15.0 }],
        },
        cashierUser,
      );

      const juan = clientsDb.find((c) => c.id === 'cli-juan');
      expect(Number(juan.bankDebtBalance)).toBe(500);
    });

    it('S. currentBalance mantiene invariante: currentBalance = dailyDebtBalance + bankDebtBalance', async () => {
      await salesService.createSale(
        {
          storeId: 'loc-tienda-centro',
          clientId: 'cli-juan',
          items: [{ productId: 'prod-galleta', quantity: 10 }], // 10.00
          payments: [{ method: SalePaymentMethod.CREDIT, amount: 10.0 }],
        },
        cashierUser,
      );

      const juan = clientsDb.find((c) => c.id === 'cli-juan');
      expect(juan.currentBalance).toBe(
        Number(juan.dailyDebtBalance) + Number(juan.bankDebtBalance),
      );
    });
  });

  // =========================================================================
  // 61. TESTS BACKEND — ATOMICIDAD
  // =========================================================================
  describe('61. Atomicidad y Rollback', () => {
    it('T. Fallo en registro de movimiento: Sale no se crea y se hace rollback', async () => {
      const mockPrisma = (salesService as any).prisma;
      mockPrisma.inventoryMovement.create.mockImplementationOnce(() => {
        throw new Error('DATABASE_CONNECTION_LOST');
      });

      await expect(
        salesService.createSale(
          {
            storeId: 'loc-tienda-centro',
            items: [{ productId: 'prod-coca', quantity: 1 }],
            payments: [{ method: SalePaymentMethod.CASH, amount: 3.0 }],
          },
          cashierUser,
        ),
      ).rejects.toThrow('DATABASE_CONNECTION_LOST');
    });

    it('U. Fallo en ledger de deuda: Sale e inventario se revierten', async () => {
      (balanceSyncService.syncClientBalances as jest.Mock).mockImplementationOnce(
        () => {
          throw new Error('LEDGER_INVARIANT_VIOLATION');
        },
      );

      await expect(
        salesService.createSale(
          {
            storeId: 'loc-tienda-centro',
            clientId: 'cli-juan',
            items: [{ productId: 'prod-coca', quantity: 1 }],
            payments: [{ method: SalePaymentMethod.CREDIT, amount: 3.0 }],
          },
          cashierUser,
        ),
      ).rejects.toThrow('LEDGER_INVARIANT_VIOLATION');
    });

    it('V. Fallo en SalePayment: inventario no cambia', async () => {
      const mockPrisma = (salesService as any).prisma;
      mockPrisma.salePayment.create.mockImplementationOnce(() => {
        throw new Error('PAYMENT_GATEWAY_TIMEOUT');
      });

      await expect(
        salesService.createSale(
          {
            storeId: 'loc-tienda-centro',
            items: [{ productId: 'prod-coca', quantity: 1 }],
            payments: [{ method: SalePaymentMethod.CASH, amount: 3.0 }],
          },
          cashierUser,
        ),
      ).rejects.toThrow('PAYMENT_GATEWAY_TIMEOUT');
    });

    it('W. Dos ventas consecutivas sobre el mismo producto arrojan saldo final consistente', async () => {
      inventoryStockDb.push({
        id: 'st-coca',
        locationId: 'loc-tienda-centro',
        productId: 'prod-coca',
        quantity: new Prisma.Decimal(10),
      });

      // Venta 1: 3 unidades
      await salesService.createSale(
        {
          storeId: 'loc-tienda-centro',
          items: [{ productId: 'prod-coca', quantity: 3 }],
          payments: [{ method: SalePaymentMethod.CASH, amount: 9.0 }],
        },
        cashierUser,
      );

      // Venta 2: 4 unidades
      await salesService.createSale(
        {
          storeId: 'loc-tienda-centro',
          items: [{ productId: 'prod-coca', quantity: 4 }],
          payments: [{ method: SalePaymentMethod.CASH, amount: 12.0 }],
        },
        cashierUser,
      );

      const stock = inventoryStockDb.find((s) => s.productId === 'prod-coca');
      expect(Number(stock.quantity)).toBe(3); // 10 - 3 - 4 = 3
    });
  });

  // =========================================================================
  // 62. TESTS BACKEND — ANULACIÓN
  // =========================================================================
  describe('62. Anulación de Ventas', () => {
    it('X. Anular venta normal restaura stock y genera InventoryMovement SALE_REVERSAL', async () => {
      inventoryStockDb.push({
        id: 'st-coca',
        locationId: 'loc-tienda-centro',
        productId: 'prod-coca',
        quantity: new Prisma.Decimal(10),
      });

      const sale = await salesService.createSale(
        {
          storeId: 'loc-tienda-centro',
          items: [{ productId: 'prod-coca', quantity: 4 }], // stock becomes 6
          payments: [{ method: SalePaymentMethod.CASH, amount: 12.0 }],
        },
        cashierUser,
      );

      const stockAfterSale = inventoryStockDb.find((s) => s.productId === 'prod-coca');
      expect(Number(stockAfterSale.quantity)).toBe(6);

      // Admin anula venta
      const annulled = await salesService.annulSale(
        sale.id,
        { reason: 'Cliente canceló compra en ventanilla' },
        adminUser,
      );

      expect(annulled.status).toBe(SaleStatus.ANULLED);
      expect(annulled.annulReason).toBe('Cliente canceló compra en ventanilla');

      const stockAfterAnnul = inventoryStockDb.find((s) => s.productId === 'prod-coca');
      expect(Number(stockAfterAnnul.quantity)).toBe(10); // restored back to 10

      const revMov = inventoryMovementDb.find(
        (m) => m.referenceType === 'SALE_REVERSAL' && m.productId === 'prod-coca',
      );
      expect(revMov).toBeDefined();
      expect(revMov.type).toBe(InventoryMovementType.SALE_REVERSAL);
      expect(Number(revMov.quantity)).toBe(4);
    });

    it('Y. Anular Kit restaura componentes físicos en sus cantidades exactas', async () => {
      inventoryStockDb.push(
        {
          id: 'st-coca',
          locationId: 'loc-tienda-centro',
          productId: 'prod-coca',
          quantity: new Prisma.Decimal(20),
        },
        {
          id: 'st-arroz',
          locationId: 'loc-tienda-centro',
          productId: 'prod-arroz',
          quantity: new Prisma.Decimal(10),
        },
      );

      // Kit Baratón has 2 Coca, 1 Arroz. Venta de 2 kits -> Coca -4, Arroz -2
      const sale = await salesService.createSale(
        {
          storeId: 'loc-tienda-centro',
          items: [{ productId: 'prod-kit-baraton', quantity: 2 }],
          payments: [{ method: SalePaymentMethod.CASH, amount: 24.0 }],
        },
        cashierUser,
      );

      expect(Number(inventoryStockDb.find((s) => s.productId === 'prod-coca').quantity)).toBe(16);
      expect(Number(inventoryStockDb.find((s) => s.productId === 'prod-arroz').quantity)).toBe(8);

      await salesService.annulSale(
        sale.id,
        { reason: 'Devolución de kit completo' },
        adminUser,
      );

      expect(Number(inventoryStockDb.find((s) => s.productId === 'prod-coca').quantity)).toBe(20);
      expect(Number(inventoryStockDb.find((s) => s.productId === 'prod-arroz').quantity)).toBe(10);
    });

    it('Z. Anular venta a crédito revierte dailyDebt en el ledger', async () => {
      const sale = await salesService.createSale(
        {
          storeId: 'loc-tienda-centro',
          clientId: 'cli-juan',
          items: [{ productId: 'prod-arroz', quantity: 10 }], // 50.00
          payments: [{ method: SalePaymentMethod.CREDIT, amount: 50.0 }],
        },
        cashierUser,
      );

      const juanAfterSale = clientsDb.find((c) => c.id === 'cli-juan');
      expect(Number(juanAfterSale.dailyDebtBalance)).toBe(150); // 100 + 50

      await salesService.annulSale(
        sale.id,
        { reason: 'Error en folio de venta a crédito' },
        adminUser,
      );

      const juanAfterAnnul = clientsDb.find((c) => c.id === 'cli-juan');
      expect(Number(juanAfterAnnul.dailyDebtBalance)).toBe(100); // reverted back to 100
    });

    it('AA. bankDebt permanece intacta tras anulación de venta a crédito', async () => {
      const sale = await salesService.createSale(
        {
          storeId: 'loc-tienda-centro',
          clientId: 'cli-juan',
          items: [{ productId: 'prod-coca', quantity: 5 }], // 15.00
          payments: [{ method: SalePaymentMethod.CREDIT, amount: 15.0 }],
        },
        cashierUser,
      );

      await salesService.annulSale(
        sale.id,
        { reason: 'Anulación de prueba bancaria' },
        adminUser,
      );

      const juan = clientsDb.find((c) => c.id === 'cli-juan');
      expect(Number(juan.bankDebtBalance)).toBe(500);
    });

    it('AB. Segunda anulación de la misma venta es rechazada', async () => {
      const sale = await salesService.createSale(
        {
          storeId: 'loc-tienda-centro',
          items: [{ productId: 'prod-coca', quantity: 1 }],
          payments: [{ method: SalePaymentMethod.CASH, amount: 3.0 }],
        },
        cashierUser,
      );

      await salesService.annulSale(
        sale.id,
        { reason: 'Primera anulación' },
        adminUser,
      );

      await expect(
        salesService.annulSale(
          sale.id,
          { reason: 'Segunda anulación no permitida' },
          adminUser,
        ),
      ).rejects.toThrow('Esta venta ya se encuentra anulada');
    });
  });

  describe('Nuevas Reglas de Negocio: Recargo Tarjeta 5% y Edición de Ventas', () => {
    it('1. Venta solamente en efectivo (sin recargo)', async () => {
      // 10 coca = 30.00
      const sale = await salesService.createSale(
        {
          storeId: 'loc-tienda-centro',
          items: [{ productId: 'prod-coca', quantity: 10 }],
          payments: [{ method: SalePaymentMethod.CASH, amount: 30.0 }],
        },
        cashierUser,
      );
      expect(sale.subtotal).toBe(30.0);
      expect(sale.cardSurcharge).toBe(0);
      expect(sale.total).toBe(30.0);
    });

    it('2. Venta solamente con Yape (sin recargo)', async () => {
      // 10 coca = 30.00
      const sale = await salesService.createSale(
        {
          storeId: 'loc-tienda-centro',
          items: [{ productId: 'prod-coca', quantity: 10 }],
          payments: [{ method: SalePaymentMethod.YAPE, amount: 30.0, reference: 'YP-999' }],
        },
        cashierUser,
      );
      expect(sale.subtotal).toBe(30.0);
      expect(sale.cardSurcharge).toBe(0);
      expect(sale.total).toBe(30.0);
    });

    it('3 y 4. Venta solamente con tarjeta (con recargo del 5%)', async () => {
      // 20 arroz = 100.00, Card: 100.00, Surcharge 5% = 5.00, Total = 105.00
      const sale = await salesService.createSale(
        {
          storeId: 'loc-tienda-centro',
          items: [{ productId: 'prod-arroz', quantity: 20 }],
          payments: [{ method: SalePaymentMethod.CARD, amount: 100.0, reference: 'VISA-100' }],
        },
        cashierUser,
      );
      expect(sale.subtotal).toBe(100.0);
      expect(sale.cardSurcharge).toBe(5.0);
      expect(sale.total).toBe(105.0);
    });

    it('5. Venta Efectivo + Tarjeta (recargo solo sobre tarjeta)', async () => {
      // 20 arroz = 100.00, Cash: 60.00, Card: 40.00 -> Card Surcharge = 40 * 0.05 = 2.00, Total = 102.00
      const sale = await salesService.createSale(
        {
          storeId: 'loc-tienda-centro',
          items: [{ productId: 'prod-arroz', quantity: 20 }],
          payments: [
            { method: SalePaymentMethod.CASH, amount: 60.0 },
            { method: SalePaymentMethod.CARD, amount: 40.0, reference: 'POS-01' },
          ],
        },
        cashierUser,
      );
      expect(sale.subtotal).toBe(100.0);
      expect(sale.cardSurcharge).toBe(2.0);
      expect(sale.total).toBe(102.0);
    });

    it('6. Venta Yape + Tarjeta (recargo solo sobre tarjeta)', async () => {
      // 10 arroz = 50.00, Yape: 30.00, Card: 20.00 -> Card Surcharge = 20 * 0.05 = 1.00, Total = 51.00
      const sale = await salesService.createSale(
        {
          storeId: 'loc-tienda-centro',
          items: [{ productId: 'prod-arroz', quantity: 10 }],
          payments: [
            { method: SalePaymentMethod.YAPE, amount: 30.0 },
            { method: SalePaymentMethod.CARD, amount: 20.0 },
          ],
        },
        cashierUser,
      );
      expect(sale.subtotal).toBe(50.0);
      expect(sale.cardSurcharge).toBe(1.0);
      expect(sale.total).toBe(51.0);
    });

    it('7. Venta Efectivo + Yape + Tarjeta', async () => {
      // 20 arroz = 100.00, Cash: 50.00, Yape: 30.00, Card: 20.00 -> Surcharge: 1.00, Total: 101.00
      const sale = await salesService.createSale(
        {
          storeId: 'loc-tienda-centro',
          items: [{ productId: 'prod-arroz', quantity: 20 }],
          payments: [
            { method: SalePaymentMethod.CASH, amount: 50.0 },
            { method: SalePaymentMethod.YAPE, amount: 30.0 },
            { method: SalePaymentMethod.CARD, amount: 20.0 },
          ],
        },
        cashierUser,
      );
      expect(sale.subtotal).toBe(100.0);
      expect(sale.cardSurcharge).toBe(1.0);
      expect(sale.total).toBe(101.0);
    });

    it('8. Pago mixto con cambio (efectivo con vuelto)', async () => {
      // 20 arroz = 100.00, Cash applied: 60.00 (received: 100, change: 40), Card: 40.00 -> Surcharge: 2.00, Total: 102.00
      const sale = await salesService.createSale(
        {
          storeId: 'loc-tienda-centro',
          items: [{ productId: 'prod-arroz', quantity: 20 }],
          payments: [
            { method: SalePaymentMethod.CASH, amount: 60.0 },
            { method: SalePaymentMethod.CARD, amount: 40.0 },
          ],
          cashReceived: 100.0,
        },
        cashierUser,
      );
      expect(sale.cashReceived).toBe(100.0);
      expect(sale.cashChange).toBe(40.0);
      expect(sale.total).toBe(102.0);
    });

    it('9, 10, 11, 16, 17, 18. Edición de Venta: agregar producto, cambiar cantidades, conservar folio y no duplicar venta ni inventario', async () => {
      const initialSalesCount = salesDb.length;

      // 1. Crear venta original: 2 coca (3.0 c/u = 6.00) pagada en efectivo
      const originalSale = await salesService.createSale(
        {
          storeId: 'loc-tienda-centro',
          items: [{ productId: 'prod-coca', quantity: 2 }],
          payments: [{ method: SalePaymentMethod.CASH, amount: 6.0 }],
        },
        cashierUser,
      );

      const originalNumber = originalSale.saleNumber;
      const originalId = originalSale.id;
      expect(salesDb.length).toBe(initialSalesCount + 1);

      // Stock check before update
      const cocaStockBefore = inventoryStockDb.find(
        (s) => s.locationId === 'loc-tienda-centro' && s.productId === 'prod-coca',
      );
      const initialCocaQty = cocaStockBefore ? Number(cocaStockBefore.quantity) : 0;

      // 2. Editar venta: cambiar coca de 2 a 3 unidades y AGREGAR 1 arroz (5.00) -> Total productos: 3*3 + 1*5 = 14.00
      const updatedSale = await salesService.updateSale(
        originalId,
        {
          storeId: 'loc-tienda-centro',
          items: [
            { productId: 'prod-coca', quantity: 3 },
            { productId: 'prod-arroz', quantity: 1 },
          ],
          payments: [{ method: SalePaymentMethod.CASH, amount: 14.0 }],
        },
        adminUser,
      );

      // Verificar que NO cambió el ID ni el saleNumber (mismo folio)
      expect(updatedSale.id).toBe(originalId);
      expect(updatedSale.saleNumber).toBe(originalNumber);

      // Verificar que NO se duplicó la venta en la base de datos
      expect(salesDb.length).toBe(initialSalesCount + 1);

      // Verificar nuevos totales
      expect(updatedSale.subtotal).toBe(14.0);
      expect(updatedSale.total).toBe(14.0);

      // Verificar inventario:
      // Coca tenía salida de 2, ahora es salida de 3 (neto: -1 adicional desde el estado antes de la edición)
      const cocaStockAfter = inventoryStockDb.find(
        (s) => s.locationId === 'loc-tienda-centro' && s.productId === 'prod-coca',
      );
      expect(Number(cocaStockAfter.quantity)).toBe(initialCocaQty - 1);

      // 3. Editar venta nuevamente eliminando arroz: volver a solo 2 coca
      const updatedAgain = await salesService.updateSale(
        originalId,
        {
          storeId: 'loc-tienda-centro',
          items: [{ productId: 'prod-coca', quantity: 2 }],
          payments: [{ method: SalePaymentMethod.CASH, amount: 6.0 }],
        },
        adminUser,
      );

      expect(updatedAgain.subtotal).toBe(6.0);
      expect(updatedAgain.items.length).toBe(1);
      // Arroz debe haber recuperado su stock de 1
      const cocaStockFinal = inventoryStockDb.find(
        (s) => s.locationId === 'loc-tienda-centro' && s.productId === 'prod-coca',
      );
      expect(Number(cocaStockFinal.quantity)).toBe(initialCocaQty);
    });

    it('12. Editar cliente en una venta', async () => {
      // Venta al contado con cliente Juan
      const sale = await salesService.createSale(
        {
          storeId: 'loc-tienda-centro',
          clientId: 'cli-juan',
          items: [{ productId: 'prod-coca', quantity: 1 }],
          payments: [{ method: SalePaymentMethod.CASH, amount: 3.0 }],
        },
        cashierUser,
      );
      expect(sale.clientId).toBe('cli-juan');

      // Editar y remover cliente (venta al público en general)
      const updated = await salesService.updateSale(
        sale.id,
        {
          storeId: 'loc-tienda-centro',
          clientId: null,
          items: [{ productId: 'prod-coca', quantity: 1 }],
          payments: [{ method: SalePaymentMethod.CASH, amount: 3.0 }],
        },
        adminUser,
      );
      expect(updated.clientId).toBeNull();
    });

    it('13, 14, 15, 23. Cambiar método de pago (Efectivo <-> Tarjeta) y recálculo del 5%', async () => {
      // Venta inicial en efectivo: 10 arroz = 50.00
      const sale = await salesService.createSale(
        {
          storeId: 'loc-tienda-centro',
          items: [{ productId: 'prod-arroz', quantity: 10 }],
          payments: [{ method: SalePaymentMethod.CASH, amount: 50.0 }],
        },
        cashierUser,
      );
      expect(sale.cardSurcharge).toBe(0);
      expect(sale.total).toBe(50.0);

      // Cambiar de efectivo a tarjeta: 50 * 5% = 2.50 recargo -> total 52.50
      const updatedWithCard = await salesService.updateSale(
        sale.id,
        {
          storeId: 'loc-tienda-centro',
          items: [{ productId: 'prod-arroz', quantity: 10 }],
          payments: [{ method: SalePaymentMethod.CARD, amount: 50.0, reference: 'TARJETA-VISA' }],
        },
        adminUser,
      );
      expect(updatedWithCard.subtotal).toBe(50.0);
      expect(updatedWithCard.cardSurcharge).toBe(2.5);
      expect(updatedWithCard.total).toBe(52.5);
      expect(updatedWithCard.subtotal + updatedWithCard.cardSurcharge).toBe(updatedWithCard.total);

      // Cambiar de tarjeta de regreso a efectivo: recargo vuelve a 0
      const updatedBackToCash = await salesService.updateSale(
        sale.id,
        {
          storeId: 'loc-tienda-centro',
          items: [{ productId: 'prod-arroz', quantity: 10 }],
          payments: [{ method: SalePaymentMethod.CASH, amount: 50.0 }],
        },
        adminUser,
      );
      expect(updatedBackToCash.subtotal).toBe(50.0);
      expect(updatedBackToCash.cardSurcharge).toBe(0);
      expect(updatedBackToCash.total).toBe(50.0);
    });
  });
});
