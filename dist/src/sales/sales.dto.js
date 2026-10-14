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
exports.GetSalesQueryDto = exports.AnnulSaleDto = exports.UpdateSaleDto = exports.CreateSaleDto = exports.SaleItemDto = exports.SalePaymentDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const client_1 = require("@prisma/client");
class SalePaymentDto {
    method;
    amount;
    reference;
}
exports.SalePaymentDto = SalePaymentDto;
__decorate([
    (0, class_validator_1.IsEnum)(client_1.SalePaymentMethod, {
        message: 'Método de pago inválido (CASH, YAPE, PLIN, CARD, TRANSFER, CREDIT)',
    }),
    __metadata("design:type", String)
], SalePaymentDto.prototype, "method", void 0);
__decorate([
    (0, class_validator_1.IsNumber)({}, { message: 'El importe del pago debe ser numérico' }),
    (0, class_validator_1.IsPositive)({ message: 'El importe del pago debe ser mayor a 0' }),
    __metadata("design:type", Number)
], SalePaymentDto.prototype, "amount", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SalePaymentDto.prototype, "reference", void 0);
class SaleItemDto {
    productId;
    quantity;
}
exports.SaleItemDto = SaleItemDto;
__decorate([
    (0, class_validator_1.IsString)({ message: 'El ID del producto es obligatorio' }),
    (0, class_validator_1.IsNotEmpty)({ message: 'El ID del producto no puede estar vacío' }),
    __metadata("design:type", String)
], SaleItemDto.prototype, "productId", void 0);
__decorate([
    (0, class_validator_1.IsInt)({ message: 'La cantidad de inventario debe ser un número entero.' }),
    (0, class_validator_1.IsPositive)({ message: 'La cantidad de inventario debe ser un número entero.' }),
    __metadata("design:type", Number)
], SaleItemDto.prototype, "quantity", void 0);
class CreateSaleDto {
    storeId;
    clientId;
    items;
    payments;
    cashReceived;
    notes;
    cashSessionId;
}
exports.CreateSaleDto = CreateSaleDto;
__decorate([
    (0, class_validator_1.IsString)({ message: 'La tienda / ubicación es obligatoria' }),
    (0, class_validator_1.IsNotEmpty)({ message: 'La tienda no puede estar vacía' }),
    __metadata("design:type", String)
], CreateSaleDto.prototype, "storeId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], CreateSaleDto.prototype, "clientId", void 0);
__decorate([
    (0, class_validator_1.IsArray)({ message: 'Los items de la venta deben ser una lista' }),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => SaleItemDto),
    __metadata("design:type", Array)
], CreateSaleDto.prototype, "items", void 0);
__decorate([
    (0, class_validator_1.IsArray)({ message: 'Los pagos de la venta deben ser una lista' }),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => SalePaymentDto),
    __metadata("design:type", Array)
], CreateSaleDto.prototype, "payments", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)({}, { message: 'El efectivo recibido debe ser numérico' }),
    (0, class_validator_1.Min)(0, { message: 'El efectivo recibido no puede ser negativo' }),
    __metadata("design:type", Number)
], CreateSaleDto.prototype, "cashReceived", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateSaleDto.prototype, "notes", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateSaleDto.prototype, "cashSessionId", void 0);
class UpdateSaleDto extends CreateSaleDto {
}
exports.UpdateSaleDto = UpdateSaleDto;
class AnnulSaleDto {
    reason;
}
exports.AnnulSaleDto = AnnulSaleDto;
__decorate([
    (0, class_validator_1.IsString)({ message: 'El motivo de anulación es obligatorio' }),
    (0, class_validator_1.IsNotEmpty)({ message: 'Debe especificar el motivo de la anulación' }),
    __metadata("design:type", String)
], AnnulSaleDto.prototype, "reason", void 0);
class GetSalesQueryDto {
    storeId;
    clientId;
    status;
    startDate;
    endDate;
    q;
    limit;
    offset;
}
exports.GetSalesQueryDto = GetSalesQueryDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], GetSalesQueryDto.prototype, "storeId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], GetSalesQueryDto.prototype, "clientId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], GetSalesQueryDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], GetSalesQueryDto.prototype, "startDate", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], GetSalesQueryDto.prototype, "endDate", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], GetSalesQueryDto.prototype, "q", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], GetSalesQueryDto.prototype, "limit", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], GetSalesQueryDto.prototype, "offset", void 0);
//# sourceMappingURL=sales.dto.js.map