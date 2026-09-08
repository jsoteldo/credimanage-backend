"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExcelImporterService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const client_1 = require("@prisma/client");
const XLSX = __importStar(require("xlsx"));
let ExcelImporterService = class ExcelImporterService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    parseBuffer(buffer) {
        try {
            const workbook = XLSX.read(buffer, { type: 'buffer' });
            const firstSheetName = workbook.SheetNames[0];
            if (!firstSheetName) {
                throw new common_1.BadRequestException('El archivo de Excel no contiene hojas');
            }
            const worksheet = workbook.Sheets[firstSheetName];
            const rawData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
            return rawData.map((row) => this.normalizeRowKeys(row));
        }
        catch (err) {
            throw new common_1.BadRequestException(`Error al procesar el archivo Excel: ${err.message}`);
        }
    }
    normalizeRowKeys(raw) {
        const normalized = {};
        for (const [key, value] of Object.entries(raw)) {
            const cleanKey = key
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-z0-9]/g, '');
            if (['codigo', 'sku', 'code'].includes(cleanKey)) {
                normalized.codigo = value;
            }
            else if (['codigobarras', 'codigodebarras', 'barcode', 'barras'].includes(cleanKey)) {
                normalized.codigobarras = value;
            }
            else if (['descripcion', 'nombre', 'producto', 'name', 'desc'].includes(cleanKey)) {
                normalized.descripcion = value;
            }
            else if (['preciocosto', 'costo', 'costprice', 'cost'].includes(cleanKey)) {
                normalized.preciocosto = value;
            }
            else if (['precioventa', 'precio', 'saleprice', 'pvp', 'venta'].includes(cleanKey)) {
                normalized.precioventa = value;
            }
            else if (['preciomayoreo', 'mayoreo', 'wholesaleprice'].includes(cleanKey)) {
                normalized.preciomayoreo = value;
            }
            else if (['invminimo', 'stockminimo', 'minimo', 'minstock'].includes(cleanKey)) {
                normalized.invminimo = value;
            }
            else if (['departamento', 'categoria', 'category', 'dept'].includes(cleanKey)) {
                normalized.departamento = value;
            }
            else if (['existencia', 'stock', 'cantidad', 'qty'].includes(cleanKey)) {
                normalized.existencia = value;
            }
            else {
                normalized[cleanKey] = value;
            }
        }
        return normalized;
    }
    async processRows(rows, businessId = 'default') {
        let createdCount = 0;
        let updatedCount = 0;
        let departmentsCreated = 0;
        const errors = [];
        const existingDepts = await this.prisma.department.findMany({
            where: { businessId },
        });
        const deptMap = new Map();
        for (const d of existingDepts) {
            deptMap.set(d.name.toLowerCase().trim(), d.id);
        }
        for (let index = 0; index < rows.length; index++) {
            const row = rows[index];
            const rowNum = index + 2;
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
            const wholesalePrice = Math.max(0, Number(row.preciomayoreo) || salePrice);
            const defaultMinStock = Math.max(0, Number(row.invminimo) || 0);
            try {
                let departmentId = null;
                const deptName = row.departamento?.toString().trim();
                if (deptName) {
                    const lowerDept = deptName.toLowerCase();
                    if (deptMap.has(lowerDept)) {
                        departmentId = deptMap.get(lowerDept);
                    }
                    else {
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
                const existingProduct = await this.prisma.product.findFirst({
                    where: { businessId, sku },
                });
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
                    await this.prisma.product.update({
                        where: { id: existingProduct.id },
                        data: {
                            name,
                            barcode,
                            departmentId: departmentId ?? existingProduct.departmentId,
                            costPrice: new client_1.Prisma.Decimal(costPrice),
                            salePrice: new client_1.Prisma.Decimal(salePrice),
                            wholesalePrice: new client_1.Prisma.Decimal(wholesalePrice),
                            defaultMinStock: new client_1.Prisma.Decimal(defaultMinStock),
                        },
                    });
                    updatedCount++;
                }
                else {
                    await this.prisma.product.create({
                        data: {
                            businessId,
                            sku,
                            barcode,
                            name,
                            departmentId,
                            saleType: 'UNIT',
                            costPrice: new client_1.Prisma.Decimal(costPrice),
                            salePrice: new client_1.Prisma.Decimal(salePrice),
                            wholesalePrice: new client_1.Prisma.Decimal(wholesalePrice),
                            tracksInventory: true,
                            defaultMinStock: new client_1.Prisma.Decimal(defaultMinStock),
                            active: true,
                        },
                    });
                    createdCount++;
                }
            }
            catch (err) {
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
            pendingStockNotice: 'Nota importante: Las existencias/stock no han sido alteradas en esta versión. El registro de inventario físico mediante movimientos y kardex se activará en la Entrega 2.',
        };
    }
};
exports.ExcelImporterService = ExcelImporterService;
exports.ExcelImporterService = ExcelImporterService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ExcelImporterService);
//# sourceMappingURL=excel-importer.service.js.map