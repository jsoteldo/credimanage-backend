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
exports.GetMovementsQueryDto = exports.GetStockQueryDto = exports.SetMinimumStockDto = exports.TransferInventoryDto = exports.AdjustInventoryDto = exports.AddInventoryDto = void 0;
const class_validator_1 = require("class-validator");
const client_1 = require("@prisma/client");
class AddInventoryDto {
    locationId;
    productId;
    quantity;
    notes;
}
exports.AddInventoryDto = AddInventoryDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)({ message: 'La ubicación es obligatoria' }),
    __metadata("design:type", String)
], AddInventoryDto.prototype, "locationId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)({ message: 'El producto es obligatorio' }),
    __metadata("design:type", String)
], AddInventoryDto.prototype, "productId", void 0);
__decorate([
    (0, class_validator_1.IsInt)({ message: 'La cantidad de inventario debe ser un número entero.' }),
    (0, class_validator_1.Min)(1, { message: 'La cantidad debe ser mayor a 0' }),
    __metadata("design:type", Number)
], AddInventoryDto.prototype, "quantity", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], AddInventoryDto.prototype, "notes", void 0);
class AdjustInventoryDto {
    locationId;
    productId;
    adjustmentQuantity;
    reason;
    notes;
}
exports.AdjustInventoryDto = AdjustInventoryDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)({ message: 'La ubicación es obligatoria' }),
    __metadata("design:type", String)
], AdjustInventoryDto.prototype, "locationId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)({ message: 'El producto es obligatorio' }),
    __metadata("design:type", String)
], AdjustInventoryDto.prototype, "productId", void 0);
__decorate([
    (0, class_validator_1.IsInt)({ message: 'La cantidad de inventario debe ser un número entero.' }),
    __metadata("design:type", Number)
], AdjustInventoryDto.prototype, "adjustmentQuantity", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)({ message: 'El motivo del ajuste es obligatorio' }),
    __metadata("design:type", String)
], AdjustInventoryDto.prototype, "reason", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], AdjustInventoryDto.prototype, "notes", void 0);
class TransferInventoryDto {
    fromLocationId;
    toLocationId;
    productId;
    quantity;
    notes;
}
exports.TransferInventoryDto = TransferInventoryDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)({ message: 'La ubicación de origen es obligatoria' }),
    __metadata("design:type", String)
], TransferInventoryDto.prototype, "fromLocationId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)({ message: 'La ubicación de destino es obligatoria' }),
    __metadata("design:type", String)
], TransferInventoryDto.prototype, "toLocationId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)({ message: 'El producto es obligatorio' }),
    __metadata("design:type", String)
], TransferInventoryDto.prototype, "productId", void 0);
__decorate([
    (0, class_validator_1.IsInt)({ message: 'La cantidad de inventario debe ser un número entero.' }),
    (0, class_validator_1.Min)(1, { message: 'La cantidad a transferir debe ser mayor a 0' }),
    __metadata("design:type", Number)
], TransferInventoryDto.prototype, "quantity", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], TransferInventoryDto.prototype, "notes", void 0);
class SetMinimumStockDto {
    locationId;
    productId;
    minimumStock;
}
exports.SetMinimumStockDto = SetMinimumStockDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)({ message: 'La ubicación es obligatoria' }),
    __metadata("design:type", String)
], SetMinimumStockDto.prototype, "locationId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)({ message: 'El producto es obligatorio' }),
    __metadata("design:type", String)
], SetMinimumStockDto.prototype, "productId", void 0);
__decorate([
    (0, class_validator_1.IsInt)({ message: 'La cantidad de inventario debe ser un número entero.' }),
    (0, class_validator_1.Min)(0, { message: 'El stock mínimo no puede ser negativo' }),
    __metadata("design:type", Number)
], SetMinimumStockDto.prototype, "minimumStock", void 0);
class GetStockQueryDto {
    locationId;
    departmentId;
    q;
    stockState;
}
exports.GetStockQueryDto = GetStockQueryDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], GetStockQueryDto.prototype, "locationId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], GetStockQueryDto.prototype, "departmentId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], GetStockQueryDto.prototype, "q", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], GetStockQueryDto.prototype, "stockState", void 0);
class GetMovementsQueryDto {
    locationId;
    productId;
    type;
    startDate;
    endDate;
    page;
    limit;
}
exports.GetMovementsQueryDto = GetMovementsQueryDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], GetMovementsQueryDto.prototype, "locationId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], GetMovementsQueryDto.prototype, "productId", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(client_1.InventoryMovementType),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], GetMovementsQueryDto.prototype, "type", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], GetMovementsQueryDto.prototype, "startDate", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], GetMovementsQueryDto.prototype, "endDate", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Object)
], GetMovementsQueryDto.prototype, "page", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Object)
], GetMovementsQueryDto.prototype, "limit", void 0);
//# sourceMappingURL=inventory.dto.js.map