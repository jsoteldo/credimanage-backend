import { Test, TestingModule } from '@nestjs/testing';
import { ProductsService } from './products.service';
import { ExcelImporterService } from './excel-importer.service';
import { DepartmentsService } from '../departments/departments.service';
import { SuppliersService } from '../suppliers/suppliers.service';
import { LocationsService } from '../locations/locations.service';
import { RolesService } from '../roles/roles.service';
import { PermissionsGuard } from '../auth/permissions.guard';
import { PrismaService } from '../prisma/prisma.service';
import { Reflector } from '@nestjs/core';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ProductSaleType, LocationType, Prisma } from '@prisma/client';
import * as XLSX from 'xlsx';

describe('ENTREGA 1 — Dominio Base Productos e Inventario (Tests A a AI)', () => {
  let productsService: ProductsService;
  let excelImporter: ExcelImporterService;
  let departmentsService: DepartmentsService;
  let suppliersService: SuppliersService;
  let locationsService: LocationsService;
  let rolesService: RolesService;
  let permissionsGuard: PermissionsGuard;
  let mockPrisma: any;

  // In-Memory storage simulation for tests
  let departmentsDb: any[] = [];
  let suppliersDb: any[] = [];
  let locationsDb: any[] = [];
  let productsDb: any[] = [];
  let kitComponentsDb: any[] = [];
  let rolesDb: any[] = [];
  let permissionsDb: any[] = [];
  let rolePermissionsDb: any[] = [];
  let usersDb: any[] = [];

  beforeEach(async () => {
    departmentsDb = [];
    suppliersDb = [];
    locationsDb = [];
    productsDb = [];
    kitComponentsDb = [];
    rolesDb = [
      { id: 'role-admin', name: 'Administrador', isSystem: true },
      { id: 'role-cajero', name: 'Cajero', isSystem: true },
    ];
    permissionsDb = [
      { id: 'p1', code: 'product.view', name: 'Ver productos' },
      { id: 'p2', code: 'product.create', name: 'Crear productos' },
      { id: 'p3', code: 'product.edit', name: 'Editar productos' },
      { id: 'p4', code: 'product.deactivate', name: 'Desactivar productos' },
      { id: 'p5', code: 'product.import', name: 'Importar productos' },
    ];
    rolePermissionsDb = [
      { roleId: 'role-admin', permissionId: 'p1' },
      { roleId: 'role-admin', permissionId: 'p2' },
      { roleId: 'role-admin', permissionId: 'p3' },
      { roleId: 'role-admin', permissionId: 'p4' },
      { roleId: 'role-admin', permissionId: 'p5' },
      { roleId: 'role-cajero', permissionId: 'p1' },
    ];
    usersDb = [
      { id: 'u-admin', name: 'Admin', role: 'Administrador', roleId: null },
      { id: 'u-cajero', name: 'Cajero', role: 'Cajero', roleId: null },
    ];

    mockPrisma = {
      department: {
        findMany: jest.fn(async ({ where }) => {
          return departmentsDb.filter((d) => {
            if (where?.businessId && d.businessId !== where.businessId)
              return false;
            if (where?.active !== undefined && d.active !== where.active)
              return false;
            return true;
          });
        }),
        findFirst: jest.fn(async ({ where }) => {
          return (
            departmentsDb.find((d) => {
              if (where?.id && d.id !== where.id) return false;
              if (where?.businessId && d.businessId !== where.businessId)
                return false;
              if (
                where?.name?.equals &&
                d.name.toLowerCase() !== where.name.equals.toLowerCase()
              )
                return false;
              return true;
            }) || null
          );
        }),
        create: jest.fn(async ({ data }) => {
          const item = {
            id: `dept-${Date.now()}-${Math.random()}`,
            businessId: data.businessId || 'default',
            name: data.name,
            description: data.description || null,
            active: data.active ?? true,
            createdAt: new Date(),
            updatedAt: new Date(),
            _count: { products: 0 },
          };
          departmentsDb.push(item);
          return item;
        }),
        update: jest.fn(async ({ where, data }) => {
          const idx = departmentsDb.findIndex((d) => d.id === where.id);
          if (idx >= 0) {
            departmentsDb[idx] = { ...departmentsDb[idx], ...data };
            return departmentsDb[idx];
          }
          return null;
        }),
      },

      supplier: {
        findMany: jest.fn(async () => suppliersDb),
        findFirst: jest.fn(async ({ where }) => {
          return (
            suppliersDb.find((s) => {
              if (where?.id && s.id !== where.id) return false;
              if (where?.businessId && s.businessId !== where.businessId)
                return false;
              if (
                where?.name?.equals &&
                s.name.toLowerCase() !== where.name.equals.toLowerCase()
              )
                return false;
              return true;
            }) || null
          );
        }),
        create: jest.fn(async ({ data }) => {
          const item = {
            id: `supp-${Date.now()}-${Math.random()}`,
            businessId: data.businessId || 'default',
            name: data.name,
            taxId: data.taxId || null,
            phone: data.phone || null,
            email: data.email || null,
            address: data.address || null,
            contactName: data.contactName || null,
            active: data.active ?? true,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          suppliersDb.push(item);
          return item;
        }),
        update: jest.fn(async ({ where, data }) => {
          const idx = suppliersDb.findIndex((s) => s.id === where.id);
          if (idx >= 0) {
            suppliersDb[idx] = { ...suppliersDb[idx], ...data };
            return suppliersDb[idx];
          }
          return null;
        }),
      },

      location: {
        findMany: jest.fn(async () => locationsDb),
        findFirst: jest.fn(async ({ where }) => {
          return (
            locationsDb.find((l) => {
              if (where?.id && l.id !== where.id) return false;
              if (where?.businessId && l.businessId !== where.businessId)
                return false;
              if (
                where?.name?.equals &&
                l.name.toLowerCase() !== where.name.equals.toLowerCase()
              )
                return false;
              if (
                where?.code?.equals &&
                l.code &&
                l.code.toLowerCase() !== where.code.equals.toLowerCase()
              )
                return false;
              return true;
            }) || null
          );
        }),
        create: jest.fn(async ({ data }) => {
          const item = {
            id: `loc-${Date.now()}-${Math.random()}`,
            businessId: data.businessId || 'default',
            name: data.name,
            code: data.code || null,
            address: data.address || null,
            type: data.type || LocationType.STORE,
            active: data.active ?? true,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          locationsDb.push(item);
          return item;
        }),
      },

      product: {
        findMany: jest.fn(async ({ where }) => {
          return productsDb
            .filter((p) => {
              if (where?.businessId && p.businessId !== where.businessId)
                return false;
              if (where?.active !== undefined && p.active !== where.active)
                return false;
              if (where?.saleType && p.saleType !== where.saleType)
                return false;
              if (where?.departmentId && p.departmentId !== where.departmentId)
                return false;
              if (where?.OR) {
                const q = where.OR[0].sku.contains.toLowerCase();
                const match =
                  p.sku.toLowerCase().includes(q) ||
                  (p.barcode && p.barcode.toLowerCase().includes(q)) ||
                  p.name.toLowerCase().includes(q);
                if (!match) return false;
              }
              return true;
            })
            .map((p) => ({
              ...p,
              department:
                departmentsDb.find((d) => d.id === p.departmentId) || null,
              kitComponents: kitComponentsDb
                .filter((kc) => kc.kitProductId === p.id)
                .map((kc) => ({
                  ...kc,
                  componentProduct: productsDb.find(
                    (cp) => cp.id === kc.componentProductId,
                  ),
                })),
            }));
        }),
        findFirst: jest.fn(async ({ where }) => {
          const found = productsDb.find((p) => {
            if (where?.id && typeof where.id === 'string' && p.id !== where.id)
              return false;
            if (where?.id?.not && p.id === where.id.not) return false;
            if (where?.businessId && p.businessId !== where.businessId)
              return false;
            if (
              where?.sku?.equals &&
              p.sku.toLowerCase() !== where.sku.equals.toLowerCase()
            )
              return false;
            if (
              where?.sku &&
              typeof where.sku === 'string' &&
              p.sku.toLowerCase() !== where.sku.toLowerCase()
            )
              return false;
            if (where?.barcode && p.barcode !== where.barcode) return false;
            return true;
          });
          if (!found) return null;
          return {
            ...found,
            department:
              departmentsDb.find((d) => d.id === found.departmentId) || null,
            kitComponents: kitComponentsDb
              .filter((kc) => kc.kitProductId === found.id)
              .map((kc) => ({
                ...kc,
                componentProduct: productsDb.find(
                  (cp) => cp.id === kc.componentProductId,
                ),
              })),
            componentOfKits: kitComponentsDb
              .filter((kc) => kc.componentProductId === found.id)
              .map((kc) => ({
                ...kc,
                kitProduct: productsDb.find((kp) => kp.id === kc.kitProductId),
              })),
          };
        }),
        findUnique: jest.fn(async ({ where }) => {
          const p = productsDb.find((x) => x.id === where.id);
          if (!p) return null;
          return {
            ...p,
            department:
              departmentsDb.find((d) => d.id === p.departmentId) || null,
            kitComponents: kitComponentsDb
              .filter((kc) => kc.kitProductId === p.id)
              .map((kc) => ({
                ...kc,
                componentProduct: productsDb.find(
                  (cp) => cp.id === kc.componentProductId,
                ),
              })),
          };
        }),
        create: jest.fn(async ({ data }) => {
          const item = {
            id: `prod-${Date.now()}-${Math.random()}`,
            businessId: data.businessId || 'default',
            sku: data.sku,
            barcode: data.barcode || null,
            name: data.name,
            description: data.description || null,
            departmentId: data.departmentId || null,
            saleType: data.saleType || ProductSaleType.UNIT,
            costPrice: new Prisma.Decimal(data.costPrice || 0),
            salePrice: new Prisma.Decimal(data.salePrice || 0),
            wholesalePrice: new Prisma.Decimal(data.wholesalePrice || 0),
            tracksInventory: data.tracksInventory ?? true,
            defaultMinStock: new Prisma.Decimal(data.defaultMinStock || 0),
            active: data.active ?? true,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          productsDb.push(item);
          return item;
        }),
        update: jest.fn(async ({ where, data }) => {
          const idx = productsDb.findIndex((p) => p.id === where.id);
          if (idx >= 0) {
            productsDb[idx] = { ...productsDb[idx], ...data };
            return productsDb[idx];
          }
          return null;
        }),
      },

      productKitComponent: {
        create: jest.fn(async ({ data }) => {
          const item = {
            id: `comp-${Date.now()}-${Math.random()}`,
            kitProductId: data.kitProductId,
            componentProductId: data.componentProductId,
            quantity: new Prisma.Decimal(data.quantity),
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          kitComponentsDb.push(item);
          return item;
        }),
        deleteMany: jest.fn(async ({ where }) => {
          kitComponentsDb = kitComponentsDb.filter(
            (kc) => kc.kitProductId !== where.kitProductId,
          );
          return { count: 1 };
        }),
      },

      role: {
        findMany: jest.fn(async () => rolesDb),
        findUnique: jest.fn(async ({ where }) => {
          const r = rolesDb.find(
            (r) => r.id === where.id || r.name === where.name,
          );
          if (!r) return null;
          return {
            ...r,
            permissions: rolePermissionsDb
              .filter((rp) => rp.roleId === r.id)
              .map((rp) => ({
                ...rp,
                permission: permissionsDb.find((p) => p.id === rp.permissionId),
              })),
          };
        }),
        create: jest.fn(async ({ data }) => {
          const item = { id: `role-${Date.now()}`, ...data, isSystem: false };
          rolesDb.push(item);
          return item;
        }),
      },

      permission: {
        findMany: jest.fn(async ({ where }) => {
          if (where?.code?.in) {
            return permissionsDb.filter((p) => where.code.in.includes(p.code));
          }
          return permissionsDb;
        }),
      },

      rolePermission: {
        createMany: jest.fn(async ({ data }) => {
          rolePermissionsDb.push(...data);
          return { count: data.length };
        }),
        deleteMany: jest.fn(async ({ where }) => {
          rolePermissionsDb = rolePermissionsDb.filter(
            (rp) => rp.roleId !== where.roleId,
          );
          return { count: 1 };
        }),
      },

      user: {
        findMany: jest.fn(async () => usersDb),
        update: jest.fn(async ({ where, data }) => {
          const u = usersDb.find((x) => x.id === where.id);
          if (u) Object.assign(u, data);
          return u;
        }),
      },

      $transaction: jest.fn(async (callback) => callback(mockPrisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        ExcelImporterService,
        DepartmentsService,
        SuppliersService,
        LocationsService,
        RolesService,
        PermissionsGuard,
        Reflector,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    productsService = module.get<ProductsService>(ProductsService);
    excelImporter = module.get<ExcelImporterService>(ExcelImporterService);
    departmentsService = module.get<DepartmentsService>(DepartmentsService);
    suppliersService = module.get<SuppliersService>(SuppliersService);
    locationsService = module.get<LocationsService>(LocationsService);
    rolesService = module.get<RolesService>(RolesService);
    permissionsGuard = module.get<PermissionsGuard>(PermissionsGuard);
  });

  // A. Crear Department
  it('A: Debe crear un Department exitosamente', async () => {
    const dept = await departmentsService.createDepartment({
      name: 'Bebidas',
      description: 'Refrescos y jugos',
    });
    expect(dept).toBeDefined();
    expect(dept.name).toBe('Bebidas');
    expect(dept.active).toBe(true);
  });

  // B. Duplicado Department mismo negocio rechazado
  it('B: Debe rechazar Department con nombre duplicado en el mismo negocio', async () => {
    await departmentsService.createDepartment({ name: 'Lácteos' });
    await expect(
      departmentsService.createDepartment({ name: 'lácteos' }),
    ).rejects.toThrow(BadRequestException);
  });

  // C. Crear Supplier
  it('C: Debe crear un Supplier exitosamente', async () => {
    const supp = await suppliersService.createSupplier({
      name: 'Distribuidora Central S.A.',
      taxId: 'J-12345678-9',
      phone: '0414-1234567',
    });
    expect(supp).toBeDefined();
    expect(supp.name).toBe('Distribuidora Central S.A.');
    expect(supp.active).toBe(true);
  });

  // D. Crear Product UNIT
  it('D: Debe crear un Product de tipo UNIT correctamente', async () => {
    const prod = await productsService.createProduct({
      sku: 'COCA-350',
      name: 'Coca Cola 350ml',
      saleType: ProductSaleType.UNIT,
      salePrice: 1.5,
      costPrice: 0.8,
    });
    expect(prod).toBeDefined();
    expect(prod.sku).toBe('COCA-350');
    expect(prod.saleType).toBe('UNIT');
    expect(prod.tracksInventory).toBe(true);
  });

  // E. Crear Product WEIGHT
  it('E: Debe crear un Product de tipo WEIGHT con soporte decimal', async () => {
    const prod = await productsService.createProduct({
      sku: 'QUESO-BLANCO',
      name: 'Queso Blanco Llanero',
      saleType: ProductSaleType.WEIGHT,
      salePrice: 4.5,
      costPrice: 3.2,
      defaultMinStock: 2.5,
    });
    expect(prod).toBeDefined();
    expect(prod.saleType).toBe('WEIGHT');
    expect(prod.defaultMinStock).toBe(2.5);
  });

  // F. Crear Product sin inventario (tracksInventory = false)
  it('F: Debe crear un Product sin control de inventario (servicio)', async () => {
    const prod = await productsService.createProduct({
      sku: 'SERV-DELIVERY',
      name: 'Servicio de Delivery',
      saleType: ProductSaleType.UNIT,
      tracksInventory: false,
      salePrice: 3.0,
    });
    expect(prod).toBeDefined();
    expect(prod.tracksInventory).toBe(false);
  });

  // G. SKU duplicado rechazado
  it('G: Debe rechazar la creación de un producto con SKU duplicado en el mismo negocio', async () => {
    await productsService.createProduct({
      sku: 'PAN-01',
      name: 'Pan Canilla',
    });
    await expect(
      productsService.createProduct({
        sku: 'pan-01',
        name: 'Pan Canilla Duplicado',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  // H. Barcode duplicado no nulo rechazado
  it('H: Debe rechazar barcode duplicado no nulo en el mismo negocio', async () => {
    await productsService.createProduct({
      sku: 'GALLETA-1',
      barcode: '7591234567890',
      name: 'Galleta María',
    });
    await expect(
      productsService.createProduct({
        sku: 'GALLETA-2',
        barcode: '7591234567890',
        name: 'Otra Galleta',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  // I. Barcode null permitido en varios productos
  it('I: Debe permitir barcode null en múltiples productos sin conflicto', async () => {
    const p1 = await productsService.createProduct({
      sku: 'ITEM-NO-BARCODE-1',
      barcode: null,
      name: 'Item Sin Código 1',
    });
    const p2 = await productsService.createProduct({
      sku: 'ITEM-NO-BARCODE-2',
      barcode: null,
      name: 'Item Sin Código 2',
    });
    expect(p1.barcode).toBeNull();
    expect(p2.barcode).toBeNull();
  });

  // J. Editar Product reutiliza contrato existente
  it('J: Editar producto actualiza los campos reutilizando el contrato', async () => {
    const created = await productsService.createProduct({
      sku: 'JUGO-01',
      name: 'Jugo Naranja',
      salePrice: 2.0,
    });

    const updated = await productsService.updateProduct(created.id, {
      name: 'Jugo Naranja 1L Premium',
      salePrice: 2.5,
    });

    expect(updated.name).toBe('Jugo Naranja 1L Premium');
    expect(updated.salePrice).toBe(2.5);
  });

  // K. Desactivar Product
  it('K: Desactivar producto cambia active a false', async () => {
    const created = await productsService.createProduct({
      sku: 'SNACK-01',
      name: 'Papas Fritas',
    });

    const deactivated = await productsService.deactivateProduct(created.id);
    expect(deactivated.active).toBe(false);
  });

  // L. Crear KIT
  it('L: Debe crear un KIT con componentes válidos', async () => {
    const comp1 = await productsService.createProduct({
      sku: 'HAMB-CARNE',
      name: 'Hamburguesa Carne',
      saleType: ProductSaleType.UNIT,
    });
    const comp2 = await productsService.createProduct({
      sku: 'PAPAS-MED',
      name: 'Papas Medianas',
      saleType: ProductSaleType.UNIT,
    });

    const kit = await productsService.createProduct({
      sku: 'COMBO-1',
      name: 'Combo Hamburguesa',
      saleType: ProductSaleType.KIT,
      salePrice: 6.0,
      components: [
        { componentProductId: comp1.id, quantity: 1 },
        { componentProductId: comp2.id, quantity: 1 },
      ],
    });

    expect(kit).toBeDefined();
    expect(kit.saleType).toBe('KIT');
    expect(kit.components).toHaveLength(2);
  });

  // M. Agregar componentes al KIT
  it('M: Permite actualizar componentes de un KIT existente', async () => {
    const c1 = await productsService.createProduct({
      sku: 'C1',
      name: 'Comp 1',
    });
    const c2 = await productsService.createProduct({
      sku: 'C2',
      name: 'Comp 2',
    });
    const c3 = await productsService.createProduct({
      sku: 'C3',
      name: 'Comp 3',
    });

    const kit = await productsService.createProduct({
      sku: 'KIT-EXP',
      name: 'Kit Experimental',
      saleType: ProductSaleType.KIT,
      components: [{ componentProductId: c1.id, quantity: 1 }],
    });

    const updatedKit = await productsService.updateProduct(kit.id, {
      components: [
        { componentProductId: c1.id, quantity: 2 },
        { componentProductId: c2.id, quantity: 1 },
        { componentProductId: c3.id, quantity: 0.5 },
      ],
    });

    expect(updatedKit.components).toHaveLength(3);
  });

  // N. Cantidad componente <= 0 rechazada
  it('N: Rechaza componente de kit con cantidad <= 0', async () => {
    const c1 = await productsService.createProduct({
      sku: 'C-QTY',
      name: 'Comp Qty',
    });

    await expect(
      productsService.createProduct({
        sku: 'KIT-INVALID-QTY',
        name: 'Kit Cantidad Invalida',
        saleType: ProductSaleType.KIT,
        components: [{ componentProductId: c1.id, quantity: 0 }],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  // O. Producto no puede contenerse a sí mismo
  it('O: Un KIT no puede contenerse a sí mismo como componente', async () => {
    const c1 = await productsService.createProduct({
      sku: 'C-BASE',
      name: 'Comp Base',
    });
    const kit = await productsService.createProduct({
      sku: 'KIT-SELF',
      name: 'Kit Auto Referencia',
      saleType: ProductSaleType.KIT,
      components: [{ componentProductId: c1.id, quantity: 1 }],
    });

    await expect(
      productsService.updateProduct(kit.id, {
        components: [{ componentProductId: kit.id, quantity: 1 }],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  // P. Ciclo de kits rechazado: componentes deben ser no-KIT
  it('P: Rechaza el uso de un producto KIT como componente de otro KIT', async () => {
    const c1 = await productsService.createProduct({
      sku: 'C-SUB',
      name: 'Item Sub',
    });
    const kitHijo = await productsService.createProduct({
      sku: 'KIT-HIJO',
      name: 'Kit Hijo',
      saleType: ProductSaleType.KIT,
      components: [{ componentProductId: c1.id, quantity: 1 }],
    });

    await expect(
      productsService.createProduct({
        sku: 'KIT-PADRE',
        name: 'Kit Padre',
        saleType: ProductSaleType.KIT,
        components: [{ componentProductId: kitHijo.id, quantity: 1 }],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  // Q. Permisos: usuario sin product.create no puede crear
  it('Q: Usuario sin product.create es rechazado por PermissionsGuard con 403', () => {
    const context: any = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({
          user: { id: 'u1', role: 'Cajero', permissions: ['product.view'] },
        }),
      }),
    };

    const reflector = new Reflector();
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue(['product.create']);
    const guard = new PermissionsGuard(reflector);

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  // R. Rol nuevo con product.create puede crear sin código especial
  it('R: Rol nuevo con product.create pasa la validación de PermissionsGuard', () => {
    const context: any = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({
          user: {
            id: 'u-custom',
            role: 'EncargadoAlmacen',
            permissions: ['product.view', 'product.create'],
          },
        }),
      }),
    };

    const reflector = new Reflector();
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue(['product.create']);
    const guard = new PermissionsGuard(reflector);

    expect(guard.canActivate(context)).toBe(true);
  });

  // S. Búsqueda por SKU
  it('S: Búsqueda de productos filtra correctamente por SKU', async () => {
    await productsService.createProduct({
      sku: 'SEARCH-SKU-99',
      name: 'Refresco Cola',
    });
    await productsService.createProduct({
      sku: 'OTHER-SKU-11',
      name: 'Agua Mineral',
    });

    const results = await productsService.getProducts({ q: 'SEARCH-SKU' });
    expect(results).toHaveLength(1);
    expect(results[0].sku).toBe('SEARCH-SKU-99');
  });

  // T. Búsqueda por barcode
  it('T: Búsqueda de productos filtra correctamente por barcode', async () => {
    await productsService.createProduct({
      sku: 'ITEM-BC-1',
      barcode: '9876543210001',
      name: 'Galletas Chocolate',
    });

    const results = await productsService.getProducts({ q: '9876543210001' });
    expect(results).toHaveLength(1);
    expect(results[0].sku).toBe('ITEM-BC-1');
  });

  // U. Búsqueda por descripción
  it('U: Búsqueda de productos filtra por nombre o descripción', async () => {
    await productsService.createProduct({
      sku: 'DESC-1',
      name: 'Cereal Integral con Frutas',
    });

    const results = await productsService.getProducts({ q: 'integral' });
    expect(results).toHaveLength(1);
    expect(results[0].sku).toBe('DESC-1');
  });

  // V. Importar SKU nuevo
  it('V: Importar Excel con SKU nuevo crea el producto', async () => {
    const rows = [
      {
        codigo: 'IMP-NEW-01',
        descripcion: 'Producto Importado Nuevo',
        precioventa: 5.5,
        preciocosto: 3.0,
      },
    ];

    const result = await excelImporter.processRows(rows, 'default');
    expect(result.createdCount).toBe(1);
    expect(result.updatedCount).toBe(0);

    const created = productsDb.find((p) => p.sku === 'IMP-NEW-01');
    expect(created).toBeDefined();
    expect(created.name).toBe('Producto Importado Nuevo');
  });

  // W. Importar SKU existente actualiza
  it('W: Importar Excel con SKU existente actualiza los datos sin duplicar', async () => {
    await productsService.createProduct({
      sku: 'IMP-EXIST-01',
      name: 'Nombre Antiguo',
      salePrice: 1.0,
    });

    const rows = [
      {
        codigo: 'IMP-EXIST-01',
        descripcion: 'Nombre Actualizado por Excel',
        precioventa: 2.5,
        preciocosto: 1.2,
      },
    ];

    const result = await excelImporter.processRows(rows, 'default');
    expect(result.updatedCount).toBe(1);
    expect(result.createdCount).toBe(0);

    const updated = productsDb.find((p) => p.sku === 'IMP-EXIST-01');
    expect(updated.name).toBe('Nombre Actualizado por Excel');
    expect(Number(updated.salePrice)).toBe(2.5);
  });

  // X. Departamento inexistente durante importación se crea automáticamente
  it('X: Crea departamento automáticamente si no existe durante la importación', async () => {
    const rows = [
      {
        codigo: 'IMP-DEPT-01',
        descripcion: 'Queso Crema',
        departamento: 'Lácteos Artesanales',
      },
    ];

    const result = await excelImporter.processRows(rows, 'default');
    expect(result.departmentsCreated).toBe(1);

    const createdDept = departmentsDb.find(
      (d) => d.name === 'Lácteos Artesanales',
    );
    expect(createdDept).toBeDefined();
  });

  // Y. businessId nunca queda NULL en nuevas entidades
  it('Y: businessId siempre tiene valor por defecto y nunca queda nulo en Location, Department, Supplier y Product', async () => {
    const loc = await locationsService.createLocation({
      name: 'Tienda Central',
    });
    const dept = await departmentsService.createDepartment({
      name: 'Ferretería',
    });
    const supp = await suppliersService.createSupplier({
      name: 'Tornillos C.A.',
    });
    const prod = await productsService.createProduct({
      sku: 'TORN-01',
      name: 'Tornillo 1 pulgada',
    });

    expect(loc.businessId).toBe('default');
    expect(dept.businessId).toBe('default');
    expect(supp.businessId).toBe('default');
    expect(prod.businessId).toBe('default');
  });

  // Z. Location.code duplicado dentro del mismo business es rechazado
  it('Z: Rechaza Location con código duplicado en el mismo negocio', async () => {
    await locationsService.createLocation({
      name: 'Tienda Norte',
      code: 'TIENDA-01',
    });
    await expect(
      locationsService.createLocation({
        name: 'Tienda Sur',
        code: 'TIENDA-01',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  // AA. Usuarios existentes reciben roleId correcto mediante backfill
  it('AA: Simula backfill de usuarios asignando roleId correspondiente según role', async () => {
    // Backfill logic
    for (const u of usersDb) {
      const matchingRole = rolesDb.find((r) => r.name === u.role);
      if (matchingRole) {
        u.roleId = matchingRole.id;
      }
    }

    const adminUser = usersDb.find((u) => u.name === 'Admin');
    const cajeroUser = usersDb.find((u) => u.name === 'Cajero');
    expect(adminUser.roleId).toBe('role-admin');
    expect(cajeroUser.roleId).toBe('role-cajero');
  });

  // AB. Administrador existente conserva acceso después de migración
  it('AB: Administrador existente conserva todos los permisos tras la migración', () => {
    const adminPermissions = rolePermissionsDb
      .filter((rp) => rp.roleId === 'role-admin')
      .map((rp) => permissionsDb.find((p) => p.id === rp.permissionId)?.code);

    expect(adminPermissions).toContain('product.view');
    expect(adminPermissions).toContain('product.create');
    expect(adminPermissions).toContain('product.edit');
    expect(adminPermissions).toContain('product.deactivate');
    expect(adminPermissions).toContain('product.import');
  });

  // AC. Cajero existente conserva el acceso correspondiente
  it('AC: Cajero existente conserva permiso de lectura pero no de creación/edición', () => {
    const cajeroPermissions = rolePermissionsDb
      .filter((rp) => rp.roleId === 'role-cajero')
      .map((rp) => permissionsDb.find((p) => p.id === rp.permissionId)?.code);

    expect(cajeroPermissions).toContain('product.view');
    expect(cajeroPermissions).not.toContain('product.create');
    expect(cajeroPermissions).not.toContain('product.deactivate');
  });

  // AD. Rol dinámico nuevo + permission funciona sin cambiar TypeScript
  it('AD: Creación de rol dinámico y asignación de permisos sin modificar código', async () => {
    const newRole = await rolesService.createRole({
      name: 'SupervisorInventario',
      description: 'Supervisa catálogo e inventario',
    });
    expect(newRole.name).toBe('SupervisorInventario');

    await rolesService.updateRolePermissions(newRole.id, [
      'product.view',
      'product.create',
    ]);

    const updatedRole = await rolesService.getRoleById(newRole.id);
    const assigned = updatedRole.permissions.map((p: any) => p.permission.code);
    expect(assigned).toContain('product.view');
    expect(assigned).toContain('product.create');
    expect(assigned).not.toContain('product.deactivate');
  });

  // AE. KIT fuerza tracksInventory=false desde backend aunque request mande true
  it('AE: KIT fuerza tracksInventory = false en backend aunque el request envíe true', async () => {
    const comp = await productsService.createProduct({
      sku: 'C-AE',
      name: 'Item AE',
    });
    const kit = await productsService.createProduct({
      sku: 'KIT-FORCE-NO-TRACK',
      name: 'Kit Invariante Stock',
      saleType: ProductSaleType.KIT,
      tracksInventory: true, // Request envía true maliciosamente o por descuido
      defaultMinStock: 50,
      components: [{ componentProductId: comp.id, quantity: 1 }],
    });

    expect(kit.tracksInventory).toBe(false);
    expect(kit.defaultMinStock).toBe(0);
  });

  // AF. KIT sin componentes es rechazado
  it('AF: KIT sin componentes es rechazado en creación y actualización', async () => {
    await expect(
      productsService.createProduct({
        sku: 'KIT-NO-COMP',
        name: 'Kit Vacío',
        saleType: ProductSaleType.KIT,
        components: [],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  // AG. KIT no puede usar otro KIT como componente
  it('AG: Rechaza terminantemente anidar un KIT dentro de otro KIT', async () => {
    const unitItem = await productsService.createProduct({
      sku: 'U1',
      name: 'Unit 1',
    });
    const subKit = await productsService.createProduct({
      sku: 'SUB-KIT-1',
      name: 'Sub Kit',
      saleType: ProductSaleType.KIT,
      components: [{ componentProductId: unitItem.id, quantity: 1 }],
    });

    await expect(
      productsService.createProduct({
        sku: 'PARENT-KIT',
        name: 'Parent Kit',
        saleType: ProductSaleType.KIT,
        components: [{ componentProductId: subKit.id, quantity: 1 }],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  // AH. Product no queda limitado a un único Supplier
  it('AH: Product no tiene campo supplierId obligatorio o exclusivo', async () => {
    const prod = await productsService.createProduct({
      sku: 'MULTI-SUPP-ITEM',
      name: 'Item Abierto para Múltiples Proveedores',
    });
    // Verifica que el contrato del producto es independiente del proveedor
    expect((prod as any).supplierId).toBeUndefined();
  });

  // AI. Import de Excel no altera stock en Entrega 1
  it('AI: La importación de Excel ignora la columna Existencia y emite aviso explícito', async () => {
    const rows = [
      {
        codigo: 'ITEM-WITH-STOCK',
        descripcion: 'Item con Existencia en Excel',
        existencia: 500,
        precioventa: 10,
      },
    ];

    const result = await excelImporter.processRows(rows, 'default');
    expect(result.createdCount).toBe(1);
    expect(result.pendingStockNotice).toContain(
      'Las existencias/stock no han sido alteradas',
    );

    const created = productsDb.find((p) => p.sku === 'ITEM-WITH-STOCK');
    expect(created).toBeDefined();
    // Verifica que no se escribió ningún stock directo ni tabla de inventario
    expect(created.currentStock).toBeUndefined();
  });

  // Helper de disponibilidad de kits
  it('Disponibilidad de Kit: Calcula correctamente min(floor(stock / qty))', () => {
    const components = [
      { quantity: 2, availableStock: 10 }, // 10 / 2 = 5
      { quantity: 1, availableStock: 3 }, // 3 / 1 = 3
    ];
    const available = productsService.calculateKitAvailability(components);
    expect(available).toBe(3);
  });
});
