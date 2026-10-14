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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InventoryController = void 0;
const common_1 = require("@nestjs/common");
const inventory_service_1 = require("./inventory.service");
const inventory_dto_1 = require("./inventory.dto");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const permissions_guard_1 = require("../auth/permissions.guard");
const permissions_decorator_1 = require("../auth/permissions.decorator");
let InventoryController = class InventoryController {
    inventoryService;
    constructor(inventoryService) {
        this.inventoryService = inventoryService;
    }
    async getStock(query) {
        return this.inventoryService.getStock(query);
    }
    async getKpis(locationId) {
        return this.inventoryService.getKpis(locationId);
    }
    async getMovements(query) {
        return this.inventoryService.getMovements(query);
    }
    async getProductStockDetails(productId) {
        return this.inventoryService.getProductStockDetails(productId);
    }
    async explodeKitComponents(kitProductId, quantity) {
        const qty = quantity ? parseFloat(quantity) : 1;
        return this.inventoryService.explodeKitComponents(kitProductId, qty);
    }
    async addInventory(dto, req) {
        return this.inventoryService.addInventory(dto, req.user);
    }
    async adjustInventory(dto, req) {
        return this.inventoryService.adjustInventory(dto, req.user);
    }
    async transferInventory(dto, req) {
        return this.inventoryService.transferInventory(dto, req.user);
    }
    async setMinimumStock(dto, req) {
        return this.inventoryService.setMinimumStock(dto, req.user);
    }
};
exports.InventoryController = InventoryController;
__decorate([
    (0, common_1.Get)('stock'),
    (0, permissions_decorator_1.RequirePermissions)('inventory.view'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [inventory_dto_1.GetStockQueryDto]),
    __metadata("design:returntype", Promise)
], InventoryController.prototype, "getStock", null);
__decorate([
    (0, common_1.Get)('kpis'),
    (0, permissions_decorator_1.RequirePermissions)('inventory.view'),
    __param(0, (0, common_1.Query)('locationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], InventoryController.prototype, "getKpis", null);
__decorate([
    (0, common_1.Get)('movements'),
    (0, permissions_decorator_1.RequirePermissions)('inventory.view'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [inventory_dto_1.GetMovementsQueryDto]),
    __metadata("design:returntype", Promise)
], InventoryController.prototype, "getMovements", null);
__decorate([
    (0, common_1.Get)('product/:productId'),
    (0, permissions_decorator_1.RequirePermissions)('inventory.view'),
    __param(0, (0, common_1.Param)('productId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], InventoryController.prototype, "getProductStockDetails", null);
__decorate([
    (0, common_1.Get)('kit/:kitProductId/explode'),
    (0, permissions_decorator_1.RequirePermissions)('inventory.view'),
    __param(0, (0, common_1.Param)('kitProductId')),
    __param(1, (0, common_1.Query)('quantity')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], InventoryController.prototype, "explodeKitComponents", null);
__decorate([
    (0, common_1.Post)('entry'),
    (0, permissions_decorator_1.RequirePermissions)('inventory.entry'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [inventory_dto_1.AddInventoryDto, Object]),
    __metadata("design:returntype", Promise)
], InventoryController.prototype, "addInventory", null);
__decorate([
    (0, common_1.Post)('adjust'),
    (0, permissions_decorator_1.RequirePermissions)('inventory.adjust'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [inventory_dto_1.AdjustInventoryDto, Object]),
    __metadata("design:returntype", Promise)
], InventoryController.prototype, "adjustInventory", null);
__decorate([
    (0, common_1.Post)('transfer'),
    (0, permissions_decorator_1.RequirePermissions)('inventory.transfer'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [inventory_dto_1.TransferInventoryDto, Object]),
    __metadata("design:returntype", Promise)
], InventoryController.prototype, "transferInventory", null);
__decorate([
    (0, common_1.Patch)('minimum-stock'),
    (0, permissions_decorator_1.RequirePermissions)('inventory.min_stock'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [inventory_dto_1.SetMinimumStockDto, Object]),
    __metadata("design:returntype", Promise)
], InventoryController.prototype, "setMinimumStock", null);
exports.InventoryController = InventoryController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permissions_guard_1.PermissionsGuard),
    (0, common_1.Controller)('crediApi/inventory'),
    __metadata("design:paramtypes", [inventory_service_1.InventoryService])
], InventoryController);
//# sourceMappingURL=inventory.controller.js.map