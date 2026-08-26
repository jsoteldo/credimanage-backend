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
exports.TransactionsController = void 0;
const common_1 = require("@nestjs/common");
const transactions_service_1 = require("./transactions.service");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const roles_guard_1 = require("../auth/roles.guard");
const roles_decorator_1 = require("../auth/roles.decorator");
let TransactionsController = class TransactionsController {
    transactionsService;
    constructor(transactionsService) {
        this.transactionsService = transactionsService;
    }
    async addCreditPurchase(id, body, req) {
        return this.transactionsService.addCreditPurchase(id, body, req.user);
    }
    async createLoanCredit(id, body, req) {
        return this.transactionsService.createLoanCredit(id, body, req.user);
    }
    async getClientLoans(id) {
        return this.transactionsService.getClientLoans(id);
    }
    async getLoanById(id) {
        return this.transactionsService.getLoanById(id);
    }
    async annulLoan(id, reason, req) {
        return this.transactionsService.annulLoan(id, reason, req.user);
    }
    async registerPayment(id, body, req) {
        return this.transactionsService.registerPayment(id, body, req.user);
    }
    async annulPayment(id, reason, req) {
        return this.transactionsService.annulPayment(id, reason, req.user);
    }
    async getPendingPayments() {
        return this.transactionsService.getPendingPayments();
    }
    async approvePayment(id, req) {
        return this.transactionsService.approvePayment(id, req.user);
    }
    async rejectPayment(id, reason, req) {
        return this.transactionsService.rejectPayment(id, reason, req.user);
    }
    async getPaymentsHistory(dateFilter, startDate, endDate, query) {
        return this.transactionsService.getPaymentsHistory({ dateFilter, startDate, endDate, query });
    }
    async getPurchasesHistory(dateFilter, startDate, endDate, query) {
        return this.transactionsService.getPurchasesHistory({ dateFilter, startDate, endDate, query });
    }
};
exports.TransactionsController = TransactionsController;
__decorate([
    (0, common_1.Post)('crediApi/clients/:id/credit-purchase'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], TransactionsController.prototype, "addCreditPurchase", null);
__decorate([
    (0, common_1.Post)('crediApi/clients/:id/loans'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], TransactionsController.prototype, "createLoanCredit", null);
__decorate([
    (0, common_1.Get)('crediApi/clients/:id/loans'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], TransactionsController.prototype, "getClientLoans", null);
__decorate([
    (0, common_1.Get)('crediApi/loans/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], TransactionsController.prototype, "getLoanById", null);
__decorate([
    (0, roles_decorator_1.Roles)('Administrador'),
    (0, common_1.Post)('crediApi/loans/:id/annul'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)('reason')),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], TransactionsController.prototype, "annulLoan", null);
__decorate([
    (0, common_1.Post)('crediApi/clients/:id/payment'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], TransactionsController.prototype, "registerPayment", null);
__decorate([
    (0, roles_decorator_1.Roles)('Administrador'),
    (0, common_1.Post)('crediApi/payments/:id/annul'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)('reason')),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], TransactionsController.prototype, "annulPayment", null);
__decorate([
    (0, roles_decorator_1.Roles)('Administrador'),
    (0, common_1.Get)('crediApi/payments/pending'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], TransactionsController.prototype, "getPendingPayments", null);
__decorate([
    (0, roles_decorator_1.Roles)('Administrador'),
    (0, common_1.Post)('crediApi/payments/:id/approve'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], TransactionsController.prototype, "approvePayment", null);
__decorate([
    (0, roles_decorator_1.Roles)('Administrador'),
    (0, common_1.Post)('crediApi/payments/:id/reject'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)('reason')),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], TransactionsController.prototype, "rejectPayment", null);
__decorate([
    (0, common_1.Get)('crediApi/payments/history'),
    __param(0, (0, common_1.Query)('dateFilter')),
    __param(1, (0, common_1.Query)('startDate')),
    __param(2, (0, common_1.Query)('endDate')),
    __param(3, (0, common_1.Query)('q')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", Promise)
], TransactionsController.prototype, "getPaymentsHistory", null);
__decorate([
    (0, common_1.Get)('crediApi/purchases/history'),
    __param(0, (0, common_1.Query)('dateFilter')),
    __param(1, (0, common_1.Query)('startDate')),
    __param(2, (0, common_1.Query)('endDate')),
    __param(3, (0, common_1.Query)('q')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", Promise)
], TransactionsController.prototype, "getPurchasesHistory", null);
exports.TransactionsController = TransactionsController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [transactions_service_1.TransactionsService])
], TransactionsController);
//# sourceMappingURL=transactions.controller.js.map