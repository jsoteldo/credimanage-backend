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
exports.CashRegistersDirectController = exports.StoreCashRegistersController = exports.ReceiptSalesController = exports.CashController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const cash_service_1 = require("./cash.service");
const cash_dto_1 = require("./cash.dto");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const permissions_guard_1 = require("../auth/permissions.guard");
const permissions_decorator_1 = require("../auth/permissions.decorator");
const roles_decorator_1 = require("../auth/roles.decorator");
const roles_guard_1 = require("../auth/roles.guard");
let CashController = class CashController {
    cashService;
    constructor(cashService) {
        this.cashService = cashService;
    }
    async createRegister(dto, req) {
        return this.cashService.createCashRegister(dto, req.user);
    }
    async getRegisters(storeId) {
        return this.cashService.getCashRegisters(storeId);
    }
    async updateRegister(id, dto, req) {
        return this.cashService.updateCashRegister(id, dto, req.user);
    }
    async updateRegisterStatus(id, status, req) {
        return this.cashService.updateCashRegister(id, { status }, req.user);
    }
    async getCurrentSession(storeId, req) {
        return this.cashService.getCurrentSession(req.user, storeId);
    }
    async openSession(dto, req) {
        return this.cashService.openSession(dto, req.user);
    }
    async closeSession(id, dto, req) {
        return this.cashService.closeSession(id, dto, req.user);
    }
    async getSessionsHistory(query) {
        return this.cashService.getSessionsHistory(query);
    }
    async getSessionById(id) {
        return this.cashService.getSessionById(id);
    }
    async getSessionSummary(id) {
        return this.cashService.calculateSessionSummary(id);
    }
    async addManualMovement(id, dto, req) {
        return this.cashService.addManualMovement(id, dto, req.user);
    }
    async getMovements(query) {
        return this.cashService.getMovements(query);
    }
    async getReceiptConfig(storeId) {
        return this.cashService.getReceiptConfig(storeId);
    }
    async updateReceiptConfig(dto, storeId, req) {
        return this.cashService.updateReceiptConfig(dto, req.user, storeId);
    }
};
exports.CashController = CashController;
__decorate([
    (0, common_1.Post)('registers'),
    (0, roles_decorator_1.Roles)('Administrador'),
    (0, permissions_decorator_1.RequirePermissions)('cash.manage'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [cash_dto_1.CreateCashRegisterDto, Object]),
    __metadata("design:returntype", Promise)
], CashController.prototype, "createRegister", null);
__decorate([
    (0, common_1.Get)('registers'),
    __param(0, (0, common_1.Query)('storeId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CashController.prototype, "getRegisters", null);
__decorate([
    (0, common_1.Put)('registers/:id'),
    (0, roles_decorator_1.Roles)('Administrador'),
    (0, permissions_decorator_1.RequirePermissions)('cash.manage'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, cash_dto_1.UpdateCashRegisterDto, Object]),
    __metadata("design:returntype", Promise)
], CashController.prototype, "updateRegister", null);
__decorate([
    (0, common_1.Patch)('registers/:id/status'),
    (0, roles_decorator_1.Roles)('Administrador'),
    (0, permissions_decorator_1.RequirePermissions)('cash.manage'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)('status')),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], CashController.prototype, "updateRegisterStatus", null);
__decorate([
    (0, common_1.Get)('sessions/current'),
    __param(0, (0, common_1.Query)('storeId')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], CashController.prototype, "getCurrentSession", null);
__decorate([
    (0, common_1.Post)('sessions/open'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [cash_dto_1.OpenCashSessionDto, Object]),
    __metadata("design:returntype", Promise)
], CashController.prototype, "openSession", null);
__decorate([
    (0, common_1.Post)('sessions/:id/close'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, cash_dto_1.CloseCashSessionDto, Object]),
    __metadata("design:returntype", Promise)
], CashController.prototype, "closeSession", null);
__decorate([
    (0, common_1.Get)('sessions'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [cash_dto_1.GetCashSessionsQueryDto]),
    __metadata("design:returntype", Promise)
], CashController.prototype, "getSessionsHistory", null);
__decorate([
    (0, common_1.Get)('sessions/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CashController.prototype, "getSessionById", null);
__decorate([
    (0, common_1.Get)('sessions/:id/summary'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CashController.prototype, "getSessionSummary", null);
__decorate([
    (0, common_1.Post)('sessions/:id/movements'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, cash_dto_1.CreateCashMovementDto, Object]),
    __metadata("design:returntype", Promise)
], CashController.prototype, "addManualMovement", null);
__decorate([
    (0, common_1.Get)('movements'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [cash_dto_1.GetCashMovementsQueryDto]),
    __metadata("design:returntype", Promise)
], CashController.prototype, "getMovements", null);
__decorate([
    (0, common_1.Get)('receipt-config'),
    __param(0, (0, common_1.Query)('storeId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CashController.prototype, "getReceiptConfig", null);
__decorate([
    (0, common_1.Put)('receipt-config'),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('Administrador'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Query)('storeId')),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [cash_dto_1.ReceiptConfigDto, String, Object]),
    __metadata("design:returntype", Promise)
], CashController.prototype, "updateReceiptConfig", null);
exports.CashController = CashController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard, permissions_guard_1.PermissionsGuard),
    (0, common_1.Controller)(['crediApi/cash', 'api/cash']),
    __metadata("design:paramtypes", [cash_service_1.CashService])
], CashController);
let ReceiptSalesController = class ReceiptSalesController {
    cashService;
    constructor(cashService) {
        this.cashService = cashService;
    }
    async getSaleReceipt(saleId) {
        return this.cashService.getReceiptBySaleId(saleId);
    }
    async reprintSaleReceipt(saleId, req) {
        return this.cashService.reprintReceipt(saleId, req.user);
    }
};
exports.ReceiptSalesController = ReceiptSalesController;
__decorate([
    (0, common_1.Get)(':saleId/receipt'),
    __param(0, (0, common_1.Param)('saleId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ReceiptSalesController.prototype, "getSaleReceipt", null);
__decorate([
    (0, common_1.Post)(':saleId/receipt/reprint'),
    __param(0, (0, common_1.Param)('saleId')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ReceiptSalesController.prototype, "reprintSaleReceipt", null);
exports.ReceiptSalesController = ReceiptSalesController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permissions_guard_1.PermissionsGuard),
    (0, common_1.Controller)(['crediApi/sales', 'api/sales']),
    __metadata("design:paramtypes", [cash_service_1.CashService])
], ReceiptSalesController);
let StoreCashRegistersController = class StoreCashRegistersController {
    cashService;
    constructor(cashService) {
        this.cashService = cashService;
    }
    async getRegisters(storeId) {
        return this.cashService.getCashRegisters(storeId);
    }
    async createRegister(storeId, dto, req) {
        return this.cashService.createCashRegister({ ...dto, storeId }, req.user);
    }
};
exports.StoreCashRegistersController = StoreCashRegistersController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Param)('storeId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], StoreCashRegistersController.prototype, "getRegisters", null);
__decorate([
    (0, common_1.Post)(),
    (0, roles_decorator_1.Roles)('Administrador'),
    (0, permissions_decorator_1.RequirePermissions)('cash.manage'),
    __param(0, (0, common_1.Param)('storeId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, cash_dto_1.CreateCashRegisterDto, Object]),
    __metadata("design:returntype", Promise)
], StoreCashRegistersController.prototype, "createRegister", null);
exports.StoreCashRegistersController = StoreCashRegistersController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard, permissions_guard_1.PermissionsGuard),
    (0, common_1.Controller)(['crediApi/stores/:storeId/cash-registers', 'api/stores/:storeId/cash-registers']),
    __metadata("design:paramtypes", [cash_service_1.CashService])
], StoreCashRegistersController);
let CashRegistersDirectController = class CashRegistersDirectController {
    cashService;
    constructor(cashService) {
        this.cashService = cashService;
    }
    async getRegisters(storeId) {
        return this.cashService.getCashRegisters(storeId);
    }
    async updateRegister(id, dto, req) {
        return this.cashService.updateCashRegister(id, dto, req.user);
    }
    async updateRegisterStatus(id, status, req) {
        return this.cashService.updateCashRegister(id, { status }, req.user);
    }
};
exports.CashRegistersDirectController = CashRegistersDirectController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('storeId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CashRegistersDirectController.prototype, "getRegisters", null);
__decorate([
    (0, common_1.Put)(':id'),
    (0, roles_decorator_1.Roles)('Administrador'),
    (0, permissions_decorator_1.RequirePermissions)('cash.manage'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, cash_dto_1.UpdateCashRegisterDto, Object]),
    __metadata("design:returntype", Promise)
], CashRegistersDirectController.prototype, "updateRegister", null);
__decorate([
    (0, common_1.Patch)(':id/status'),
    (0, roles_decorator_1.Roles)('Administrador'),
    (0, permissions_decorator_1.RequirePermissions)('cash.manage'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)('status')),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], CashRegistersDirectController.prototype, "updateRegisterStatus", null);
exports.CashRegistersDirectController = CashRegistersDirectController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard, permissions_guard_1.PermissionsGuard),
    (0, common_1.Controller)(['crediApi/cash-registers', 'api/cash-registers']),
    __metadata("design:paramtypes", [cash_service_1.CashService])
], CashRegistersDirectController);
//# sourceMappingURL=cash.controller.js.map