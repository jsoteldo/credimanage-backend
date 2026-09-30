import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ExcelImporterService, RawImportRow } from './excel-importer.service';
import { ProductSaleType, Prisma } from '@prisma/client';
import { toProductDto, ProductResponseDto } from './product.dto';

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

@Injectable()
export class ProductsService {
  constructor(
    private prisma: PrismaService,
    private excelImporter: ExcelImporterService,
  ) {}

  async getProducts(query?: {
    q?: string;
    departmentId?: string;
    saleType?: ProductSaleType;
    active?: boolean | string;
    businessId?: string;
  }): Promise<ProductResponseDto[]> {
    const businessId = query?.businessId || 'default';
    const where: any = { businessId };

    if (query?.departmentId) {
      where.departmentId = query.departmentId;
    }

    if (query?.saleType) {
      where.saleType = query.saleType;
    }

    if (query?.active !== undefined && query?.active !== '') {
      where.active = query.active === true || query.active === 'true';
    }

    if (query?.q && query.q.trim()) {
      const q = query.q.trim();
      where.OR = [
        { sku: { contains: q, mode: 'insensitive' } },
        { barcode: { contains: q, mode: 'insensitive' } },
        { name: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ];
    }

    const list = await this.prisma.product.findMany({
      where,
      include: {
        department: true,
        kitComponents: {
          include: {
            componentProduct: true,
          },
        },
      },
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
    });

    return list.map((p) => toProductDto(p));
  }

  async getProductById(
    id: string,
    businessId = 'default',
  ): Promise<ProductResponseDto> {
    const product = await this.prisma.product.findFirst({
      where: { id, businessId },
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

    return toProductDto(product);
  }

  async createProduct(data: CreateProductInput): Promise<ProductResponseDto> {
    const businessId = data.businessId || 'default';

    const sku = data.sku?.trim();
    if (!sku) {
      throw new BadRequestException('El código / SKU es obligatorio');
    }

    const name = data.name?.trim();
    if (!name) {
      throw new BadRequestException('El nombre o descripción es obligatorio');
    }

    const rawBarcode = data.barcode?.trim();
    const barcode = rawBarcode && rawBarcode !== '' ? rawBarcode : null;

    // Check SKU uniqueness in business
    const existingSku = await this.prisma.product.findFirst({
      where: { businessId, sku: { equals: sku, mode: 'insensitive' } },
    });
    if (existingSku) {
      throw new BadRequestException(
        `Ya existe un producto con el SKU "${sku}" en este negocio`,
      );
    }

    // Check Barcode uniqueness in business when provided
    if (barcode) {
      const existingBarcode = await this.prisma.product.findFirst({
        where: { businessId, barcode },
      });
      if (existingBarcode) {
        throw new BadRequestException(
          `Ya existe un producto con el código de barras "${barcode}" en este negocio`,
        );
      }
    }

    // Check department existence if provided
    if (data.departmentId) {
      const dept = await this.prisma.department.findFirst({
        where: { id: data.departmentId, businessId },
      });
      if (!dept) {
        throw new BadRequestException('El departamento especificado no existe');
      }
    }

    const saleType = data.saleType || ProductSaleType.UNIT;
    const isKit = saleType === ProductSaleType.KIT;

    // Backend Invariant: KITS force tracksInventory = false and defaultMinStock = 0
    const tracksInventory = isKit ? false : data.tracksInventory !== false;
    const defaultMinStock = isKit
      ? 0
      : Math.max(0, Number(data.defaultMinStock) || 0);

    const costPrice = Math.max(0, Number(data.costPrice) || 0);
    const salePrice = Math.max(0, Number(data.salePrice) || 0);
    const wholesalePrice = Math.max(
      0,
      Number(data.wholesalePrice) || salePrice,
    );

    // Validate Kit components
    if (isKit) {
      if (!data.components || data.components.length === 0) {
        throw new BadRequestException(
          'Un producto tipo KIT debe tener al menos un componente',
        );
      }
      await this.validateComponents(data.components, null, businessId);
    }

    // Execute creation in atomic transaction
    return this.prisma.$transaction(async (tx) => {
      const newProduct = await tx.product.create({
        data: {
          businessId,
          sku,
          barcode,
          name,
          description: data.description?.trim() || null,
          departmentId: data.departmentId || null,
          saleType,
          costPrice: new Prisma.Decimal(costPrice),
          salePrice: new Prisma.Decimal(salePrice),
          wholesalePrice: new Prisma.Decimal(wholesalePrice),
          tracksInventory,
          defaultMinStock: new Prisma.Decimal(defaultMinStock),
          active: true,
        },
      });

      if (isKit && data.components && data.components.length > 0) {
        for (const comp of data.components) {
          await tx.productKitComponent.create({
            data: {
              kitProductId: newProduct.id,
              componentProductId: comp.componentProductId,
              quantity: new Prisma.Decimal(Number(comp.quantity)),
            },
          });
        }
      }

      const complete = await tx.product.findUnique({
        where: { id: newProduct.id },
        include: {
          department: true,
          kitComponents: {
            include: { componentProduct: true },
          },
        },
      });

      return toProductDto(complete);
    });
  }

  async updateProduct(
    id: string,
    data: UpdateProductInput,
  ): Promise<ProductResponseDto> {
    const businessId = data.businessId || 'default';
    const existing = await this.prisma.product.findFirst({
      where: { id, businessId },
      include: { kitComponents: true },
    });

    if (!existing) {
      throw new NotFoundException('Producto no encontrado');
    }

    const updateData: any = {};

    if (data.sku !== undefined) {
      const sku = data.sku.trim();
      if (!sku) {
        throw new BadRequestException('El código / SKU no puede estar vacío');
      }
      if (sku.toLowerCase() !== existing.sku.toLowerCase()) {
        const duplicate = await this.prisma.product.findFirst({
          where: {
            businessId,
            sku: { equals: sku, mode: 'insensitive' },
            id: { not: id },
          },
        });
        if (duplicate) {
          throw new BadRequestException(
            `Ya existe otro producto con el SKU "${sku}"`,
          );
        }
      }
      updateData.sku = sku;
    }

    if (data.barcode !== undefined) {
      const rawBarcode = data.barcode?.trim();
      const barcode = rawBarcode && rawBarcode !== '' ? rawBarcode : null;
      if (barcode && barcode !== existing.barcode) {
        const duplicate = await this.prisma.product.findFirst({
          where: {
            businessId,
            barcode,
            id: { not: id },
          },
        });
        if (duplicate) {
          throw new BadRequestException(
            `Ya existe otro producto con el código de barras "${barcode}"`,
          );
        }
      }
      updateData.barcode = barcode;
    }

    if (data.name !== undefined) {
      const name = data.name.trim();
      if (!name) {
        throw new BadRequestException(
          'El nombre o descripción no puede estar vacío',
        );
      }
      updateData.name = name;
    }

    if (data.description !== undefined) {
      updateData.description = data.description?.trim() || null;
    }

    if (data.departmentId !== undefined) {
      if (data.departmentId) {
        const dept = await this.prisma.department.findFirst({
          where: { id: data.departmentId, businessId },
        });
        if (!dept) {
          throw new BadRequestException(
            'El departamento especificado no existe',
          );
        }
      }
      updateData.departmentId = data.departmentId || null;
    }

    const newSaleType = data.saleType || existing.saleType;
    const isKit = newSaleType === ProductSaleType.KIT;
    updateData.saleType = newSaleType;

    if (isKit) {
      // Backend invariant: KIT forces tracksInventory = false and defaultMinStock = 0
      updateData.tracksInventory = false;
      updateData.defaultMinStock = new Prisma.Decimal(0);
    } else {
      if (data.tracksInventory !== undefined) {
        updateData.tracksInventory = Boolean(data.tracksInventory);
      }
      if (data.defaultMinStock !== undefined) {
        updateData.defaultMinStock = new Prisma.Decimal(
          Math.max(0, Number(data.defaultMinStock) || 0),
        );
      }
    }

    if (data.costPrice !== undefined) {
      updateData.costPrice = new Prisma.Decimal(
        Math.max(0, Number(data.costPrice) || 0),
      );
    }

    if (data.salePrice !== undefined) {
      updateData.salePrice = new Prisma.Decimal(
        Math.max(0, Number(data.salePrice) || 0),
      );
    }

    if (data.wholesalePrice !== undefined) {
      updateData.wholesalePrice = new Prisma.Decimal(
        Math.max(0, Number(data.wholesalePrice) || 0),
      );
    }

    if (data.active !== undefined) {
      updateData.active = Boolean(data.active);
    }

    // Validate Kit components if it is or becomes a KIT
    if (isKit) {
      const components = data.components ?? existing.kitComponents;
      if (!components || components.length === 0) {
        throw new BadRequestException(
          'Un producto tipo KIT debe tener al menos un componente',
        );
      }
      if (data.components) {
        await this.validateComponents(data.components, id, businessId);
      }
    }

    // Execute update in atomic transaction
    return this.prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id },
        data: updateData,
      });

      if (isKit && data.components) {
        // Sync kit components: delete old and recreate new
        await tx.productKitComponent.deleteMany({
          where: { kitProductId: id },
        });

        for (const comp of data.components) {
          await tx.productKitComponent.create({
            data: {
              kitProductId: id,
              componentProductId: comp.componentProductId,
              quantity: new Prisma.Decimal(Number(comp.quantity)),
            },
          });
        }
      } else if (!isKit && existing.saleType === ProductSaleType.KIT) {
        // Converted from KIT to UNIT/WEIGHT: clear components
        await tx.productKitComponent.deleteMany({
          where: { kitProductId: id },
        });
      }

      const complete = await tx.product.findUnique({
        where: { id },
        include: {
          department: true,
          kitComponents: {
            include: { componentProduct: true },
          },
        },
      });

      return toProductDto(complete);
    });
  }

  async deactivateProduct(id: string, businessId = 'default') {
    const product = await this.prisma.product.findFirst({
      where: { id, businessId },
      include: {
        componentOfKits: {
          include: { kitProduct: true },
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Producto no encontrado');
    }

    // Check if it is an active component of an active KIT
    const activeParentKits = product.componentOfKits.filter(
      (ck) => ck.kitProduct.active,
    );
    if (activeParentKits.length > 0) {
      const parentNames = activeParentKits
        .map((k) => `"${k.kitProduct.name}" (${k.kitProduct.sku})`)
        .join(', ');
      throw new BadRequestException(
        `No se puede desactivar este producto porque es componente activo de los siguientes kits: ${parentNames}`,
      );
    }

    const updated = await this.prisma.product.update({
      where: { id },
      data: { active: false },
      include: {
        department: true,
        kitComponents: {
          include: { componentProduct: true },
        },
      },
    });

    return toProductDto(updated);
  }

  async reactivateProduct(id: string, businessId = 'default') {
    await this.getProductById(id, businessId);
    const updated = await this.prisma.product.update({
      where: { id },
      data: { active: true },
      include: {
        department: true,
        kitComponents: {
          include: { componentProduct: true },
        },
      },
    });
    return toProductDto(updated);
  }

  /**
   * Helper to validate kit components:
   * 1. Quantity > 0
   * 2. Cannot contain itself
   * 3. No duplicate component products in the kit
   * 4. Components must strictly be UNIT or WEIGHT (NO KIT as component in Entrega 1)
   */
  private async validateComponents(
    components: CreateComponentInput[],
    currentKitId: string | null,
    businessId: string,
  ) {
    const seen = new Set<string>();

    for (const comp of components) {
      const qty = Number(comp.quantity);
      if (isNaN(qty) || qty <= 0) {
        throw new BadRequestException(
          'La cantidad de cada componente en un KIT debe ser estrictamente mayor a 0',
        );
      }

      if (currentKitId && comp.componentProductId === currentKitId) {
        throw new BadRequestException(
          'Un producto KIT no puede contenerse a sí mismo',
        );
      }

      if (seen.has(comp.componentProductId)) {
        throw new BadRequestException(
          'No se pueden repetir componentes duplicados dentro del mismo KIT',
        );
      }
      seen.add(comp.componentProductId);

      const componentProd = await this.prisma.product.findFirst({
        where: { id: comp.componentProductId, businessId },
      });

      if (!componentProd) {
        throw new BadRequestException(
          `El componente con ID "${comp.componentProductId}" no existe en este negocio`,
        );
      }

      if (componentProd.saleType === ProductSaleType.KIT) {
        throw new BadRequestException(
          `El producto "${componentProd.name}" (${componentProd.sku}) es un KIT. En esta entrega no se permiten kits anidados dentro de otros kits.`,
        );
      }
    }
  }

  /**
   * Domain helper to calculate available quantity for a KIT based on component stock
   * Formula: min(floor(stock / quantity))
   */
  calculateKitAvailability(
    components: { quantity: number; availableStock: number }[],
  ): number {
    if (!components || components.length === 0) return 0;

    let minKits = Infinity;
    for (const comp of components) {
      if (comp.quantity <= 0) continue;
      const possible = Math.floor(comp.availableStock / comp.quantity);
      if (possible < minKits) {
        minKits = possible;
      }
    }

    return minKits === Infinity ? 0 : Math.max(0, minKits);
  }

  /**
   * Import products from file buffer
   */
  async importProductsFile(buffer: Buffer, businessId = 'default') {
    const rows = this.excelImporter.parseBuffer(buffer);
    return this.excelImporter.processRows(rows, businessId);
  }

  /**
   * Import products from JSON row payload
   */
  async importProductsRows(rows: RawImportRow[], businessId = 'default') {
    return this.excelImporter.processRows(rows, businessId);
  }
}
