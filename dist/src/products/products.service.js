"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const excel_importer_service_1 = require("./excel-importer.service");
const client_1 = require("@prisma/client");
const product_dto_1 = require("./product.dto");
let ProductsService = class ProductsService {
    prisma;
    excelImporter;
    constructor(prisma, excelImporter) {
        this.prisma = prisma;
        this.excelImporter = excelImporter;
    }
    async getProducts(query) {
        const businessId = query?.businessId || 'default';
        const where = { businessId };
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
        return list.map((p) => (0, product_dto_1.toProductDto)(p));
    }
    async getProductById(id, businessId = 'default') {
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
            throw new common_1.NotFoundException('Producto no encontrado');
        }
        return (0, product_dto_1.toProductDto)(product);
    }
    async createProduct(data) {
        const businessId = data.businessId || 'default';
        const sku = data.sku?.trim();
        if (!sku) {
            throw new common_1.BadRequestException('El código / SKU es obligatorio');
        }
        const name = data.name?.trim();
        if (!name) {
            throw new common_1.BadRequestException('El nombre o descripción es obligatorio');
        }
        const rawBarcode = data.barcode?.trim();
        const barcode = rawBarcode && rawBarcode !== '' ? rawBarcode : null;
        const existingSku = await this.prisma.product.findFirst({
            where: { businessId, sku: { equals: sku, mode: 'insensitive' } },
        });
        if (existingSku) {
            throw new common_1.BadRequestException(`Ya existe un producto con el SKU "${sku}" en este negocio`);
        }
        if (barcode) {
            const existingBarcode = await this.prisma.product.findFirst({
                where: { businessId, barcode },
            });
            if (existingBarcode) {
                throw new common_1.BadRequestException(`Ya existe un producto con el código de barras "${barcode}" en este negocio`);
            }
        }
        if (data.departmentId) {
            const dept = await this.prisma.department.findFirst({
                where: { id: data.departmentId, businessId },
            });
            if (!dept) {
                throw new common_1.BadRequestException('El departamento especificado no existe');
            }
        }
        const saleType = data.saleType || client_1.ProductSaleType.UNIT;
        const isKit = saleType === client_1.ProductSaleType.KIT;
        const tracksInventory = isKit ? false : data.tracksInventory !== false;
        const defaultMinStock = isKit
            ? 0
            : Math.max(0, Number(data.defaultMinStock) || 0);
        const costPrice = Math.max(0, Number(data.costPrice) || 0);
        const salePrice = Math.max(0, Number(data.salePrice) || 0);
        const wholesalePrice = Math.max(0, Number(data.wholesalePrice) || salePrice);
        if (isKit) {
            if (!data.components || data.components.length === 0) {
                throw new common_1.BadRequestException('Un producto tipo KIT debe tener al menos un componente');
            }
            await this.validateComponents(data.components, null, businessId);
        }
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
                    costPrice: new client_1.Prisma.Decimal(costPrice),
                    salePrice: new client_1.Prisma.Decimal(salePrice),
                    wholesalePrice: new client_1.Prisma.Decimal(wholesalePrice),
                    tracksInventory,
                    defaultMinStock: new client_1.Prisma.Decimal(defaultMinStock),
                    active: true,
                },
            });
            if (isKit && data.components && data.components.length > 0) {
                for (const comp of data.components) {
                    await tx.productKitComponent.create({
                        data: {
                            kitProductId: newProduct.id,
                            componentProductId: comp.componentProductId,
                            quantity: new client_1.Prisma.Decimal(Number(comp.quantity)),
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
            return (0, product_dto_1.toProductDto)(complete);
        });
    }
    async updateProduct(id, data) {
        const businessId = data.businessId || 'default';
        const existing = await this.prisma.product.findFirst({
            where: { id, businessId },
            include: { kitComponents: true },
        });
        if (!existing) {
            throw new common_1.NotFoundException('Producto no encontrado');
        }
        const updateData = {};
        if (data.sku !== undefined) {
            const sku = data.sku.trim();
            if (!sku) {
                throw new common_1.BadRequestException('El código / SKU no puede estar vacío');
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
                    throw new common_1.BadRequestException(`Ya existe otro producto con el SKU "${sku}"`);
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
                    throw new common_1.BadRequestException(`Ya existe otro producto con el código de barras "${barcode}"`);
                }
            }
            updateData.barcode = barcode;
        }
        if (data.name !== undefined) {
            const name = data.name.trim();
            if (!name) {
                throw new common_1.BadRequestException('El nombre o descripción no puede estar vacío');
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
                    throw new common_1.BadRequestException('El departamento especificado no existe');
                }
            }
            updateData.departmentId = data.departmentId || null;
        }
        const newSaleType = data.saleType || existing.saleType;
        const isKit = newSaleType === client_1.ProductSaleType.KIT;
        updateData.saleType = newSaleType;
        if (isKit) {
            updateData.tracksInventory = false;
            updateData.defaultMinStock = new client_1.Prisma.Decimal(0);
        }
        else {
            if (data.tracksInventory !== undefined) {
                updateData.tracksInventory = Boolean(data.tracksInventory);
            }
            if (data.defaultMinStock !== undefined) {
                updateData.defaultMinStock = new client_1.Prisma.Decimal(Math.max(0, Number(data.defaultMinStock) || 0));
            }
        }
        if (data.costPrice !== undefined) {
            updateData.costPrice = new client_1.Prisma.Decimal(Math.max(0, Number(data.costPrice) || 0));
        }
        if (data.salePrice !== undefined) {
            updateData.salePrice = new client_1.Prisma.Decimal(Math.max(0, Number(data.salePrice) || 0));
        }
        if (data.wholesalePrice !== undefined) {
            updateData.wholesalePrice = new client_1.Prisma.Decimal(Math.max(0, Number(data.wholesalePrice) || 0));
        }
        if (data.active !== undefined) {
            updateData.active = Boolean(data.active);
        }
        if (isKit) {
            const components = data.components ?? existing.kitComponents;
            if (!components || components.length === 0) {
                throw new common_1.BadRequestException('Un producto tipo KIT debe tener al menos un componente');
            }
            if (data.components) {
                await this.validateComponents(data.components, id, businessId);
            }
        }
        return this.prisma.$transaction(async (tx) => {
            await tx.product.update({
                where: { id },
                data: updateData,
            });
            if (isKit && data.components) {
                await tx.productKitComponent.deleteMany({
                    where: { kitProductId: id },
                });
                for (const comp of data.components) {
                    await tx.productKitComponent.create({
                        data: {
                            kitProductId: id,
                            componentProductId: comp.componentProductId,
                            quantity: new client_1.Prisma.Decimal(Number(comp.quantity)),
                        },
                    });
                }
            }
            else if (!isKit && existing.saleType === client_1.ProductSaleType.KIT) {
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
            return (0, product_dto_1.toProductDto)(complete);
        });
    }
    async deactivateProduct(id, businessId = 'default') {
        const product = await this.prisma.product.findFirst({
            where: { id, businessId },
            include: {
                componentOfKits: {
                    include: { kitProduct: true },
                },
            },
        });
        if (!product) {
            throw new common_1.NotFoundException('Producto no encontrado');
        }
        const activeParentKits = product.componentOfKits.filter((ck) => ck.kitProduct.active);
        if (activeParentKits.length > 0) {
            const parentNames = activeParentKits
                .map((k) => `"${k.kitProduct.name}" (${k.kitProduct.sku})`)
                .join(', ');
            throw new common_1.BadRequestException(`No se puede desactivar este producto porque es componente activo de los siguientes kits: ${parentNames}`);
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
        return (0, product_dto_1.toProductDto)(updated);
    }
    async reactivateProduct(id, businessId = 'default') {
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
        return (0, product_dto_1.toProductDto)(updated);
    }
    async validateComponents(components, currentKitId, businessId) {
        const seen = new Set();
        for (const comp of components) {
            const qty = Number(comp.quantity);
            if (isNaN(qty) || qty <= 0) {
                throw new common_1.BadRequestException('La cantidad de cada componente en un KIT debe ser estrictamente mayor a 0');
            }
            if (currentKitId && comp.componentProductId === currentKitId) {
                throw new common_1.BadRequestException('Un producto KIT no puede contenerse a sí mismo');
            }
            if (seen.has(comp.componentProductId)) {
                throw new common_1.BadRequestException('No se pueden repetir componentes duplicados dentro del mismo KIT');
            }
            seen.add(comp.componentProductId);
            const componentProd = await this.prisma.product.findFirst({
                where: { id: comp.componentProductId, businessId },
            });
            if (!componentProd) {
                throw new common_1.BadRequestException(`El componente con ID "${comp.componentProductId}" no existe en este negocio`);
            }
            if (componentProd.saleType === client_1.ProductSaleType.KIT) {
                throw new common_1.BadRequestException(`El producto "${componentProd.name}" (${componentProd.sku}) es un KIT. En esta entrega no se permiten kits anidados dentro de otros kits.`);
            }
        }
    }
    calculateKitAvailability(components) {
        if (!components || components.length === 0)
            return 0;
        let minKits = Infinity;
        for (const comp of components) {
            if (comp.quantity <= 0)
                continue;
            const possible = Math.floor(comp.availableStock / comp.quantity);
            if (possible < minKits) {
                minKits = possible;
            }
        }
        return minKits === Infinity ? 0 : Math.max(0, minKits);
    }
    async importProductsFile(buffer, businessId = 'default') {
        const rows = this.excelImporter.parseBuffer(buffer);
        return this.excelImporter.processRows(rows, businessId);
    }
    async importProductsRows(rows, businessId = 'default') {
        return this.excelImporter.processRows(rows, businessId);
    }
};
exports.ProductsService = ProductsService;
exports.ProductsService = ProductsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        excel_importer_service_1.ExcelImporterService])
], ProductsService);
//# sourceMappingURL=products.service.js.map