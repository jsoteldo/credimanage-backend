"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateProductDto = exports.CreateProductDto = void 0;
exports.toProductDto = toProductDto;
const client_1 = require("@prisma/client");
class CreateProductDto {
    sku;
    barcode;
    name;
    description;
    departmentId;
    saleType;
    costPrice;
    salePrice;
    wholesalePrice;
    tracksInventory;
    defaultMinStock;
    components;
    businessId;
}
exports.CreateProductDto = CreateProductDto;
class UpdateProductDto {
    sku;
    barcode;
    name;
    description;
    departmentId;
    saleType;
    costPrice;
    salePrice;
    wholesalePrice;
    tracksInventory;
    defaultMinStock;
    components;
    active;
    businessId;
}
exports.UpdateProductDto = UpdateProductDto;
function toProductDto(product) {
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
        costPrice: product.costPrice instanceof client_1.Prisma.Decimal
            ? product.costPrice.toNumber()
            : Number(product.costPrice || 0),
        salePrice: product.salePrice instanceof client_1.Prisma.Decimal
            ? product.salePrice.toNumber()
            : Number(product.salePrice || 0),
        wholesalePrice: product.wholesalePrice instanceof client_1.Prisma.Decimal
            ? product.wholesalePrice.toNumber()
            : Number(product.wholesalePrice || 0),
        tracksInventory: product.tracksInventory,
        defaultMinStock: product.defaultMinStock instanceof client_1.Prisma.Decimal
            ? product.defaultMinStock.toNumber()
            : Number(product.defaultMinStock || 0),
        active: product.active,
        components: product.kitComponents?.map((kc) => ({
            id: kc.id,
            componentProductId: kc.componentProductId,
            componentSku: kc.componentProduct?.sku || '',
            componentName: kc.componentProduct?.name || '',
            quantity: kc.quantity instanceof client_1.Prisma.Decimal
                ? kc.quantity.toNumber()
                : Number(kc.quantity || 0),
            saleType: kc.componentProduct?.saleType || 'UNIT',
        })),
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
    };
}
//# sourceMappingURL=product.dto.js.map