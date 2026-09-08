import { Prisma, ProductSaleType } from '@prisma/client';

export class CreateProductDto {
  sku!: string;
  barcode?: string | null;
  name!: string;
  description?: string | null;
  departmentId?: string | null;
  saleType?: ProductSaleType;
  costPrice?: number | string;
  salePrice?: number | string;
  wholesalePrice?: number | string;
  tracksInventory?: boolean;
  defaultMinStock?: number | string | null;
  components?: {
    componentProductId: string;
    quantity: number | string;
  }[];
  businessId?: string;
}

export class UpdateProductDto {
  sku?: string;
  barcode?: string | null;
  name?: string;
  description?: string | null;
  departmentId?: string | null;
  saleType?: ProductSaleType;
  costPrice?: number | string;
  salePrice?: number | string;
  wholesalePrice?: number | string;
  tracksInventory?: boolean;
  defaultMinStock?: number | string | null;
  components?: {
    componentProductId: string;
    quantity: number | string;
  }[];
  active?: boolean;
  businessId?: string;
}

export interface ProductResponseDto {
  id: string;
  businessId: string;
  sku: string;
  barcode: string | null;
  name: string;
  description: string | null;
  departmentId: string | null;
  departmentName?: string | null;
  saleType: ProductSaleType;
  costPrice: number;
  salePrice: number;
  wholesalePrice: number;
  tracksInventory: boolean;
  defaultMinStock: number;
  active: boolean;
  components?: {
    id: string;
    componentProductId: string;
    componentSku: string;
    componentName: string;
    quantity: number;
    saleType: ProductSaleType;
  }[];
  createdAt: string | Date;
  updatedAt: string | Date;
}

export function toProductDto(product: any): ProductResponseDto {
  return {
    id: product.id,
    businessId: product.businessId,
    sku: product.sku,
    barcode: product.barcode || null,
    name: product.name,
    description: product.description || null,
    departmentId: product.departmentId || null,
    departmentName: product.department?.name || null,
    saleType: product.saleType,
    costPrice: product.costPrice instanceof Prisma.Decimal
      ? product.costPrice.toNumber()
      : Number(product.costPrice || 0),
    salePrice: product.salePrice instanceof Prisma.Decimal
      ? product.salePrice.toNumber()
      : Number(product.salePrice || 0),
    wholesalePrice: product.wholesalePrice instanceof Prisma.Decimal
      ? product.wholesalePrice.toNumber()
      : Number(product.wholesalePrice || 0),
    tracksInventory: product.tracksInventory,
    defaultMinStock: product.defaultMinStock instanceof Prisma.Decimal
      ? product.defaultMinStock.toNumber()
      : Number(product.defaultMinStock || 0),
    active: product.active,
    components: product.kitComponents?.map((kc: any) => ({
      id: kc.id,
      componentProductId: kc.componentProductId,
      componentSku: kc.componentProduct?.sku || '',
      componentName: kc.componentProduct?.name || '',
      quantity: kc.quantity instanceof Prisma.Decimal
        ? kc.quantity.toNumber()
        : Number(kc.quantity || 0),
      saleType: kc.componentProduct?.saleType || 'UNIT',
    })),
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}
