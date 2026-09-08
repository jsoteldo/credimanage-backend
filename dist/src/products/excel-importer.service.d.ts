import { PrismaService } from '../prisma/prisma.service';
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
    errors: {
        row: number;
        error: string;
        data?: any;
    }[];
    pendingStockNotice: string;
}
export declare class ExcelImporterService {
    private prisma;
    constructor(prisma: PrismaService);
    parseBuffer(buffer: Buffer): RawImportRow[];
    private normalizeRowKeys;
    processRows(rows: RawImportRow[], businessId?: string): Promise<ImportResult>;
}
