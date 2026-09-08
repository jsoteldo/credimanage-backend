import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import * as XLSX from 'xlsx';

export interface RawImportRow {
  codigo?: string | number;
  codigobarras?: string | number;
  descripcion?: string;
  preciocosto?: number | string;
  precioventa?: number | string;
  preciomayoreo?: number | string;
  invminimo?: number | string;
  departamento?: string;
  existencia?: number | string;
  [key: string]: any;
}

export interface ImportResult {
  success: boolean;
  totalRowsProcessed: number;
  createdCount: number;
  updatedCount: number;
  departmentsCreated: number;
  errors: { row: number; error: string; data?: any }[];
  pendingStockNotice: string;
}

@Injectable()
export class ExcelImporterService {
  constructor(private prisma: PrismaService) {}

  /**
   * Parses an Excel or CSV file buffer into normalized row objects
   */
  parseBuffer(buffer: Buffer): RawImportRow[] {
    try {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        throw new BadRequestException('El archivo de Excel no contiene hojas');
      }

      const worksheet = workbook.Sheets[firstSheetName];
      const rawData: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

      return rawData.map((row) => this.normalizeRowKeys(row));
    } catch (err: any) {
      throw new BadRequestException(
        `Error al procesar el archivo Excel: ${err.message}`,
      );
    }
  }

  /**
   * Normalizes keys so differences in capitalization or accents are resolved
   */
  private normalizeRowKeys(raw: Record<string, any>): RawImportRow {
    const normalized: Record<string, any> = {};
    for (const [key, value] of Object.entries(raw)) {
      const cleanKey = key
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '');

      if (['codigo', 'sku', 'code'].includes(cleanKey)) {
        normalized.codigo = value;
      } else if (
        ['codigobarras', 'codigodebarras', 'barcode', 'barras'].includes(cleanKey)
      ) {
        normalized.codigobarras = value;
      } else if (
        ['descripcion', 'nombre', 'producto', 'name', 'desc'].includes(cleanKey)
      ) {
        normalized.descripcion = value;
      } else if (
        ['preciocosto', 'costo', 'costprice', 'cost'].includes(cleanKey)
      ) {
        normalized.preciocosto = value;
      } else if (
        ['precioventa', 'precio', 'saleprice', 'pvp', 'venta'].includes(cleanKey)
      ) {
        normalized.precioventa = value;
      } else if (
        ['preciomayoreo', 'mayoreo', 'wholesaleprice'].includes(cleanKey)
      ) {
        normalized.preciomayoreo = value;
      } else if (
        ['invminimo', 'stockminimo', 'minimo', 'minstock'].includes(cleanKey)
      ) {
        normalized.invminimo = value;
      } else if (
        ['departamento', 'categoria', 'category', 'dept'].includes(cleanKey)
      ) {
        normalized.departamento = value;
      } else if (
        ['existencia', 'stock', 'cantidad', 'qty'].includes(cleanKey)
      ) {
        normalized.existencia = value;
      } else {
        normalized[cleanKey] = value;
      }
    }
    return normalized;
  }

  /**
   * Executes the import logic in the database:
   * - Creates or updates products
   * - Creates departments on-the-fly
   * - Strictly does NOT alter physical stock
   */
  async processRows(
    rows: RawImportRow[],
    businessId = 'default',
  ): Promise<ImportResult> {
    let createdCount = 0;
    let updatedCount = 0;
    let departmentsCreated = 0;
    const errors: { row: number; error: string; data?: any }[] = [];

    // Cache of existing departments by lowercase name
    const existingDepts = await this.prisma.department.findMany({
      where: { businessId },
    });
    const deptMap = new Map<string, string>();
    for (const d of existingDepts) {
      deptMap.set(d.name.toLowerCase().trim(), d.id);
    }

    for (let index = 0; index < rows.length; index++) {
      const row = rows[index];
      const rowNum = index + 2; // Header is row 1

      const sku = row.codigo?.toString().trim();
      const name = row.descripcion?.toString().trim();

      if (!sku) {
        errors.push({
          row: rowNum,
          error: 'Código / SKU ausente o vacío',
          data: row,
        });
        continue;
      }

      if (!name) {
        errors.push({
          row: rowNum,
          error: `Descripción ausente para el SKU "${sku}"`,
          data: row,
        });
        continue;
      }

      const rawBarcode = row.codigobarras?.toString().trim();
      const barcode = rawBarcode && rawBarcode !== '' ? rawBarcode : null;

      const costPrice = Math.max(0, Number(row.preciocosto) || 0);
      const salePrice = Math.max(0, Number(row.precioventa) || 0);
      const wholesalePrice = Math.max(
        0,
        Number(row.preciomayoreo) || salePrice,
      );
      const defaultMinStock = Math.max(0, Number(row.invminimo) || 0);

      try {
        // Resolve or create department if provided
        let departmentId: string | null = null;
        const deptName = row.departamento?.toString().trim();
        if (deptName) {
          const lowerDept = deptName.toLowerCase();
          if (deptMap.has(lowerDept)) {
            departmentId = deptMap.get(lowerDept)!;
          } else {
            // Create department automatically
            const newDept = await this.prisma.department.create({
              data: {
                businessId,
                name: deptName,
                active: true,
              },
            });
            departmentId = newDept.id;
            deptMap.set(lowerDept, departmentId);
            departmentsCreated++;
          }
        }

        // Check if product with SKU already exists in business
        const existingProduct = await this.prisma.product.findFirst({
          where: { businessId, sku },
        });

        // Barcode conflict check with other products
        if (barcode) {
          const barcodeConflict = await this.prisma.product.findFirst({
            where: {
              businessId,
              barcode,
              id: existingProduct ? { not: existingProduct.id } : undefined,
            },
          });
          if (barcodeConflict) {
            errors.push({
              row: rowNum,
              error: `El código de barras "${barcode}" ya pertenece a otro producto (${barcodeConflict.sku})`,
              data: row,
            });
            continue;
          }
        }

        if (existingProduct) {
          // UPDATE existing product
          await this.prisma.product.update({
            where: { id: existingProduct.id },
            data: {
              name,
              barcode,
              departmentId: departmentId ?? existingProduct.departmentId,
              costPrice: new Prisma.Decimal(costPrice),
              salePrice: new Prisma.Decimal(salePrice),
              wholesalePrice: new Prisma.Decimal(wholesalePrice),
              defaultMinStock: new Prisma.Decimal(defaultMinStock),
            },
          });
          updatedCount++;
        } else {
          // CREATE new product
          await this.prisma.product.create({
            data: {
              businessId,
              sku,
              barcode,
              name,
              departmentId,
              saleType: 'UNIT',
              costPrice: new Prisma.Decimal(costPrice),
              salePrice: new Prisma.Decimal(salePrice),
              wholesalePrice: new Prisma.Decimal(wholesalePrice),
              tracksInventory: true,
              defaultMinStock: new Prisma.Decimal(defaultMinStock),
              active: true,
            },
          });
          createdCount++;
        }
      } catch (err: any) {
        errors.push({
          row: rowNum,
          error: `Error al guardar producto: ${err.message}`,
          data: row,
        });
      }
    }

    return {
      success: errors.length === 0,
      totalRowsProcessed: rows.length,
      createdCount,
      updatedCount,
      departmentsCreated,
      errors,
      pendingStockNotice:
        'Nota importante: Las existencias/stock no han sido alteradas en esta versión. El registro de inventario físico mediante movimientos y kardex se activará en la Entrega 2.',
    };
  }
}
