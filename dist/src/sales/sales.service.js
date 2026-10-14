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
exports.SalesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const audit_service_1 = require("../audit/audit.service");
const balance_sync_service_1 = require("../transactions/balance-sync.service");
const client_1 = require("@prisma/client");
const cash_service_1 = require("../cash/cash.service");
let SalesService = class SalesService {
    prisma;
    auditService;
    balanceSyncService;
    cashService;
    constructor(prisma, auditService, balanceSyncService, cashService) {
        this.prisma = prisma;
        this.auditService = auditService;
        this.balanceSyncService = balanceSyncService;
        this.cashService = cashService;
    }
    async generateSaleNumber(tx) {
        const lastSale = await tx.sale.findFirst({
            orderBy: { createdAt: 'desc' },
            select: { saleNumber: true },
        });
        if (!lastSale || !lastSale.saleNumber) {
            return 'VEN-0001';
        }
        const match = lastSale.saleNumber.match(/VEN-(\d+)/);
        if (!match) {
            const count = await tx.sale.count();
            return `VEN-${String(count + 1).padStart(4, '0')}`;
        }
        const nextSeq = parseInt(match[1], 10) + 1;
        return `VEN-${String(nextSeq).padStart(4, '0')}`;
    }
    async createSale(dto, user, businessId = 'default') {
        if (!dto.items || dto.items.length === 0) {
            throw new common_1.BadRequestException('La venta debe contener al menos un producto');
        }
        if (!dto.payments || dto.payments.length === 0) {
            throw new common_1.BadRequestException('Debe registrar al menos un método de pago');
        }
        const store = await this.prisma.location.findFirst({
            where: { id: dto.storeId, businessId, active: true },
        });
        if (!store) {
            throw new common_1.NotFoundException('Tienda no encontrada o inactiva');
        }
        let activeCashSession = null;
        if (dto.cashSessionId) {
            activeCashSession = await this.prisma.cashSession.findFirst({
                where: {
                    id: dto.cashSessionId,
                    storeId: dto.storeId,
                    businessId,
                    status: client_1.CashSessionStatus.OPEN,
                },
            });
            if (!activeCashSession) {
                throw new common_1.BadRequestException('El turno de caja especificado no existe o no se encuentra abierto para esta tienda.');
            }
        }
        else {
            if (user?.id) {
                activeCashSession = await this.prisma.cashSession.findFirst({
                    where: {
                        storeId: dto.storeId,
                        businessId,
                        status: client_1.CashSessionStatus.OPEN,
                        openedByUserId: user.id,
                    },
                });
            }
            if (!activeCashSession) {
                activeCashSession = await this.prisma.cashSession.findFirst({
                    where: {
                        storeId: dto.storeId,
                        businessId,
                        status: client_1.CashSessionStatus.OPEN,
                    },
                });
            }
        }
        if (!activeCashSession) {
            throw new common_1.BadRequestException('No existe una caja abierta. Debes abrir un turno antes de registrar ventas.');
        }
        const aggregatedItemsMap = new Map();
        for (const it of dto.items) {
            if (typeof it.quantity !== 'number' ||
                !Number.isFinite(it.quantity) ||
                !Number.isInteger(it.quantity)) {
                throw new common_1.BadRequestException('La cantidad de inventario debe ser un número entero.');
            }
            if (it.quantity <= 0) {
                throw new common_1.BadRequestException('La cantidad de cada producto debe ser mayor a 0');
            }
            const cur = aggregatedItemsMap.get(it.productId) || 0;
            aggregatedItemsMap.set(it.productId, cur + it.quantity);
        }
        const distinctProductIds = Array.from(aggregatedItemsMap.keys());
        const products = await this.prisma.product.findMany({
            where: {
                id: { in: distinctProductIds },
                businessId,
            },
            include: {
                kitComponents: {
                    include: {
                        componentProduct: true,
                    },
                },
            },
        });
        if (products.length !== distinctProductIds.length) {
            throw new common_1.BadRequestException('Uno o más productos no existen en el sistema');
        }
        for (const p of products) {
            if (!p.active) {
                throw new common_1.BadRequestException(`El producto "${p.name}" (${p.sku}) está inactivo y no puede venderse`);
            }
            if (p.saleType === client_1.ProductSaleType.KIT) {
                if (!p.kitComponents || p.kitComponents.length === 0) {
                    throw new common_1.BadRequestException(`El Kit "${p.name}" no tiene componentes configurados y no puede venderse`);
                }
                for (const comp of p.kitComponents) {
                    if (!comp.componentProduct || !comp.componentProduct.active) {
                        throw new common_1.BadRequestException(`El Kit "${p.name}" contiene el componente "${comp.componentProduct?.name || comp.componentProductId}" que está inactivo. No se puede vender.`);
                    }
                }
            }
        }
        const productMap = new Map();
        products.forEach((p) => productMap.set(p.id, p));
        let subtotal = 0;
        const computedItems = [];
        for (const [prodId, qty] of aggregatedItemsMap.entries()) {
            const prod = productMap.get(prodId);
            const unitPrice = Number(prod.salePrice);
            const lineTotal = Math.round(unitPrice * qty * 100) / 100;
            subtotal = Math.round((subtotal + lineTotal) * 100) / 100;
            computedItems.push({
                productId: prod.id,
                product: prod,
                quantity: qty,
                unitPrice,
                lineTotal,
            });
        }
        const cardPayments = dto.payments.filter((p) => p.method === client_1.SalePaymentMethod.CARD);
        const cardAmount = cardPayments.reduce((sum, p) => sum + p.amount, 0);
        const cardSurcharge = Math.round(cardAmount * 0.05 * 100) / 100;
        const total = Math.round((subtotal + cardSurcharge) * 100) / 100;
        let paymentSum = 0;
        let creditAmount = 0;
        let cashAmount = 0;
        for (const pay of dto.payments) {
            if (pay.amount <= 0) {
                throw new common_1.BadRequestException('El monto de cada pago debe ser mayor a 0');
            }
            const roundedAmount = Math.round(pay.amount * 100) / 100;
            paymentSum = Math.round((paymentSum + roundedAmount) * 100) / 100;
            if (pay.method === client_1.SalePaymentMethod.CREDIT) {
                creditAmount = Math.round((creditAmount + roundedAmount) * 100) / 100;
            }
            if (pay.method === client_1.SalePaymentMethod.CASH) {
                cashAmount = Math.round((cashAmount + roundedAmount) * 100) / 100;
            }
        }
        const isMatchingSubtotal = Math.abs(paymentSum - subtotal) <= 0.01;
        const isMatchingTotal = Math.abs(paymentSum - total) <= 0.01;
        if (!isMatchingSubtotal && !isMatchingTotal) {
            const diff = Math.round((subtotal - paymentSum) * 100) / 100;
            if (diff > 0) {
                throw new common_1.BadRequestException(`Faltan S/ ${diff.toFixed(2)} para completar el total de la venta`);
            }
            else {
                throw new common_1.BadRequestException(`La suma de los pagos (S/ ${paymentSum.toFixed(2)}) excede el total de la venta (S/ ${subtotal.toFixed(2)})`);
            }
        }
        let cashReceived = null;
        let cashChange = null;
        if (cashAmount > 0) {
            if (dto.cashReceived !== undefined && dto.cashReceived !== null) {
                if (dto.cashReceived < cashAmount) {
                    throw new common_1.BadRequestException(`El efectivo recibido (S/ ${dto.cashReceived.toFixed(2)}) no cubre el importe en efectivo (S/ ${cashAmount.toFixed(2)})`);
                }
                cashReceived = Math.round(dto.cashReceived * 100) / 100;
                cashChange = Math.round((cashReceived - cashAmount) * 100) / 100;
            }
            else {
                cashReceived = cashAmount;
                cashChange = 0;
            }
        }
        let clientRecord = null;
        if (creditAmount > 0) {
            if (!dto.clientId) {
                throw new common_1.BadRequestException('Selecciona un cliente para registrar una venta a crédito.');
            }
            clientRecord = await this.prisma.client.findUnique({
                where: { id: dto.clientId },
            });
            if (!clientRecord) {
                throw new common_1.NotFoundException('Cliente seleccionado no encontrado');
            }
            if (clientRecord.status === 'Desactivado') {
                throw new common_1.BadRequestException('El cliente seleccionado está desactivado');
            }
            const currentDailyDebt = clientRecord.dailyDebtBalance != null
                ? Math.max(0, Number(clientRecord.dailyDebtBalance))
                : Math.max(0, clientRecord.currentBalance);
            if (clientRecord.creditLimit > 0) {
                const projectedDailyDebt = currentDailyDebt + creditAmount;
                if (projectedDailyDebt > clientRecord.creditLimit) {
                    throw new common_1.BadRequestException(`Límite de crédito excedido. Límite: S/ ${clientRecord.creditLimit.toFixed(2)}, Deuda actual: S/ ${currentDailyDebt.toFixed(2)}, Exceso: S/ ${(projectedDailyDebt - clientRecord.creditLimit).toFixed(2)}`);
                }
            }
        }
        else if (dto.clientId) {
            clientRecord = await this.prisma.client.findUnique({
                where: { id: dto.clientId },
            });
        }
        let paymentStatus = 'PAID';
        if (creditAmount > 0) {
            paymentStatus = creditAmount === total ? 'CREDIT' : 'MIXED';
        }
        else if (dto.payments.length > 1) {
            paymentStatus = 'MIXED';
        }
        const physicalDeductions = new Map();
        for (const item of computedItems) {
            if (item.product.saleType === client_1.ProductSaleType.KIT) {
                for (const comp of item.product.kitComponents) {
                    const compDeduction = Number(comp.quantity) * item.quantity;
                    const existing = physicalDeductions.get(comp.componentProductId);
                    const currentQty = existing ? existing.quantityToDeduct : 0;
                    physicalDeductions.set(comp.componentProductId, {
                        productId: comp.componentProductId,
                        productName: comp.componentProduct.name,
                        sku: comp.componentProduct.sku,
                        quantityToDeduct: currentQty + compDeduction,
                        reason: `Venta Kit "${item.product.name}" (${item.quantity} kit${item.quantity > 1 ? 's' : ''})`,
                    });
                }
            }
            else {
                const existing = physicalDeductions.get(item.productId);
                const currentQty = existing ? existing.quantityToDeduct : 0;
                physicalDeductions.set(item.productId, {
                    productId: item.productId,
                    productName: item.product.name,
                    sku: item.product.sku,
                    quantityToDeduct: currentQty + item.quantity,
                    reason: `Venta directa`,
                });
            }
        }
        const userName = user.name || user.email || 'Cajero';
        const result = await this.prisma.$transaction(async (tx) => {
            const saleNumber = await this.generateSaleNumber(tx);
            const sale = await tx.sale.create({
                data: {
                    businessId,
                    saleNumber,
                    storeId: dto.storeId,
                    cashSessionId: activeCashSession.id,
                    clientId: dto.clientId || null,
                    status: client_1.SaleStatus.COMPLETED,
                    subtotal: new client_1.Prisma.Decimal(subtotal),
                    cardSurcharge: cardSurcharge > 0 ? new client_1.Prisma.Decimal(cardSurcharge) : new client_1.Prisma.Decimal(0),
                    total: new client_1.Prisma.Decimal(total),
                    paymentStatus,
                    cashReceived: cashReceived !== null ? new client_1.Prisma.Decimal(cashReceived) : null,
                    cashChange: cashChange !== null ? new client_1.Prisma.Decimal(cashChange) : null,
                    notes: dto.notes?.trim() || null,
                    createdBy: userName,
                    completedAt: new Date(),
                },
            });
            for (const item of computedItems) {
                await tx.saleItem.create({
                    data: {
                        saleId: sale.id,
                        productId: item.productId,
                        productCodeSnapshot: item.product.sku || item.product.barcode || item.product.name,
                        productNameSnapshot: item.product.name,
                        quantity: item.quantity,
                        unitPrice: new client_1.Prisma.Decimal(item.unitPrice),
                        lineTotal: new client_1.Prisma.Decimal(item.lineTotal),
                        productType: item.product.saleType,
                    },
                });
            }
            for (const pay of dto.payments) {
                const roundedAmount = Math.round(pay.amount * 100) / 100;
                await tx.salePayment.create({
                    data: {
                        saleId: sale.id,
                        method: pay.method,
                        amount: new client_1.Prisma.Decimal(roundedAmount),
                        reference: pay.reference?.trim() || null,
                    },
                });
                if (pay.method !== client_1.SalePaymentMethod.CREDIT) {
                    const cardRowSurcharge = pay.method === client_1.SalePaymentMethod.CARD
                        ? Math.round(pay.amount * 0.05 * 100) / 100
                        : 0;
                    const cashMovementAmount = Math.round((roundedAmount + cardRowSurcharge) * 100) / 100;
                    await tx.cashMovement.create({
                        data: {
                            businessId,
                            cashSessionId: activeCashSession.id,
                            storeId: dto.storeId,
                            cashRegisterId: activeCashSession.cashRegisterId,
                            saleId: sale.id,
                            type: client_1.CashMovementType.SALE,
                            paymentMethod: pay.method,
                            amount: new client_1.Prisma.Decimal(cashMovementAmount),
                            referenceType: 'Sale',
                            referenceId: sale.id,
                            description: pay.method === client_1.SalePaymentMethod.CARD && cardRowSurcharge > 0
                                ? `Venta POS ${saleNumber} (CARD) (+S/ ${cardRowSurcharge.toFixed(2)} recargo 5%)`
                                : `Venta POS ${saleNumber} (${pay.method})`,
                            createdByUserId: user.id || 'system',
                        },
                    });
                }
            }
            const receiptConfig = await this.cashService.getReceiptConfig(dto.storeId, businessId);
            const receiptNumInfo = await this.cashService.generateNextReceiptNumber(tx, receiptConfig.series || 'B001', businessId);
            await tx.receipt.create({
                data: {
                    businessId,
                    saleId: sale.id,
                    number: receiptNumInfo.number,
                    series: receiptNumInfo.series,
                    sequence: receiptNumInfo.sequence,
                    configSnapshot: receiptConfig,
                    notes: dto.notes?.trim() || null,
                },
            });
            const stockWarnings = [];
            for (const deduction of physicalDeductions.values()) {
                let stockRecord = await tx.inventoryStock.findUnique({
                    where: {
                        locationId_productId: {
                            locationId: dto.storeId,
                            productId: deduction.productId,
                        },
                    },
                });
                const previousStock = stockRecord ? Number(stockRecord.quantity) : 0;
                const newStock = previousStock - deduction.quantityToDeduct;
                if (newStock < 0) {
                    stockWarnings.push(`Esta venta dejó el producto "${deduction.productName}" con stock negativo (${newStock} unidades) en ${store.name}.`);
                }
                if (stockRecord) {
                    await tx.inventoryStock.update({
                        where: { id: stockRecord.id },
                        data: {
                            quantity: newStock,
                        },
                    });
                }
                else {
                    const prodObj = await tx.product.findUnique({
                        where: { id: deduction.productId },
                        select: { defaultMinStock: true },
                    });
                    const minStock = prodObj?.defaultMinStock ? Number(prodObj.defaultMinStock) : 0;
                    await tx.inventoryStock.create({
                        data: {
                            locationId: dto.storeId,
                            productId: deduction.productId,
                            quantity: newStock,
                            minimumStock: minStock,
                        },
                    });
                }
                await tx.inventoryMovement.create({
                    data: {
                        locationId: dto.storeId,
                        productId: deduction.productId,
                        type: client_1.InventoryMovementType.SALE,
                        quantity: -deduction.quantityToDeduct,
                        previousStock: previousStock,
                        newStock: newStock,
                        referenceType: 'SALE',
                        referenceId: sale.id,
                        reason: deduction.reason,
                        notes: `Venta POS ${saleNumber}`,
                        createdBy: userName,
                    },
                });
            }
            let syncedBalances = null;
            if (creditAmount > 0 && dto.clientId) {
                const creditPurchase = await tx.creditPurchase.create({
                    data: {
                        clientId: dto.clientId,
                        date: new Date(),
                        isBaselineMovement: false,
                        product: `Venta POS ${saleNumber}`,
                        unitPrice: creditAmount,
                        quantity: 1,
                        amount: creditAmount,
                        ticketNumber: saleNumber,
                        registeredBy: userName,
                        status: 'Activo',
                        debtType: 'simple',
                        saleId: sale.id,
                    },
                });
                syncedBalances = await this.balanceSyncService.syncClientBalances(dto.clientId, tx);
            }
            return {
                sale,
                stockWarnings,
                syncedBalances,
            };
        });
        await this.auditService.logAudit(user.id, userName, user.role || 'Cajero', 'SALE_CREATED', `Venta ${result.sale.saleNumber} confirmada por S/ ${total.toFixed(2)} en "${store.name}". Métodos: ${dto.payments.map((p) => p.method).join(', ')}.`, result.sale.id);
        return this.getSaleById(result.sale.id, result.stockWarnings);
    }
    async getSaleById(id, warnings) {
        const sale = await this.prisma.sale.findUnique({
            where: { id },
            include: {
                store: {
                    select: {
                        id: true,
                        name: true,
                        code: true,
                        type: true,
                    },
                },
                client: {
                    select: {
                        id: true,
                        name: true,
                        clientNumber: true,
                        phone: true,
                        dailyDebtBalance: true,
                        bankDebtBalance: true,
                        currentBalance: true,
                        creditLimit: true,
                    },
                },
                items: {
                    orderBy: { createdAt: 'asc' },
                },
                payments: {
                    orderBy: { createdAt: 'asc' },
                },
                receipt: true,
                cashSession: {
                    include: {
                        cashRegister: true,
                    },
                },
            },
        });
        if (!sale) {
            throw new common_1.NotFoundException('Venta no encontrada');
        }
        return {
            id: sale.id,
            saleNumber: sale.saleNumber,
            businessId: sale.businessId,
            storeId: sale.storeId,
            storeName: sale.store.name,
            storeCode: sale.store.code,
            cashSessionId: sale.cashSessionId,
            cashRegisterName: sale.cashSession?.cashRegister?.name || null,
            receipt: sale.receipt
                ? {
                    id: sale.receipt.id,
                    number: sale.receipt.number,
                    series: sale.receipt.series,
                    sequence: sale.receipt.sequence,
                    configSnapshot: sale.receipt.configSnapshot,
                    reprintedCount: sale.receipt.reprintedCount,
                    lastReprintedAt: sale.receipt.lastReprintedAt,
                    createdAt: sale.receipt.createdAt,
                }
                : null,
            clientId: sale.clientId,
            clientName: sale.client?.name || 'Consumidor Final',
            clientNumber: sale.client?.clientNumber || null,
            clientPhone: sale.client?.phone || null,
            status: sale.status,
            subtotal: Number(sale.subtotal),
            cardSurcharge: sale.cardSurcharge !== null && sale.cardSurcharge !== undefined ? Number(sale.cardSurcharge) : 0,
            total: Number(sale.total),
            paymentStatus: sale.paymentStatus,
            cashReceived: sale.cashReceived !== null ? Number(sale.cashReceived) : null,
            cashChange: sale.cashChange !== null ? Number(sale.cashChange) : null,
            notes: sale.notes,
            createdBy: sale.createdBy,
            createdAt: sale.createdAt,
            completedAt: sale.completedAt,
            annulledAt: sale.annulledAt,
            annulledBy: sale.annulledBy,
            annulReason: sale.annulReason,
            items: sale.items.map((item) => ({
                id: item.id,
                productId: item.productId,
                productCode: item.productCodeSnapshot,
                productName: item.productNameSnapshot,
                quantity: Number(item.quantity),
                unitPrice: Number(item.unitPrice),
                lineTotal: Number(item.lineTotal),
                productType: item.productType,
            })),
            payments: sale.payments.map((pay) => ({
                id: pay.id,
                method: pay.method,
                amount: Number(pay.amount),
                reference: pay.reference,
                createdAt: pay.createdAt,
            })),
            client: sale.client
                ? {
                    id: sale.client.id,
                    name: sale.client.name,
                    clientNumber: sale.client.clientNumber,
                    dailyDebtBalance: sale.client.dailyDebtBalance ? Number(sale.client.dailyDebtBalance) : 0,
                    bankDebtBalance: sale.client.bankDebtBalance ? Number(sale.client.bankDebtBalance) : 0,
                    currentBalance: Number(sale.client.currentBalance),
                    availableCredit: Number(sale.client.creditLimit) > 0
                        ? Math.max(0, Number(sale.client.creditLimit) -
                            (Math.max(0, Number(sale.client.dailyDebtBalance || 0)) +
                                Number(sale.client.bankDebtBalance || 0)))
                        : null,
                    creditLimit: Number(sale.client.creditLimit),
                }
                : null,
            warnings: warnings || [],
        };
    }
    async getSales(query, businessId = 'default') {
        const { storeId, clientId, status, startDate, endDate, q } = query;
        const limit = Math.max(1, Math.min(500, parseInt(String(query.limit ?? 50), 10) || 50));
        const offset = Math.max(0, parseInt(String(query.offset ?? 0), 10) || 0);
        const where = {
            businessId,
        };
        if (storeId && storeId !== 'all') {
            where.storeId = storeId;
        }
        if (clientId && clientId !== 'all') {
            where.clientId = clientId;
        }
        if (status && status !== 'ALL' && status !== 'todos') {
            where.status = status;
        }
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) {
                where.createdAt.gte = new Date(`${startDate}T00:00:00.000Z`);
            }
            if (endDate) {
                where.createdAt.lte = new Date(`${endDate}T23:59:59.999Z`);
            }
        }
        if (q && q.trim()) {
            const search = q.trim();
            where.OR = [
                { saleNumber: { contains: search, mode: 'insensitive' } },
                { client: { name: { contains: search, mode: 'insensitive' } } },
                { client: { clientNumber: { contains: search, mode: 'insensitive' } } },
                { createdBy: { contains: search, mode: 'insensitive' } },
                {
                    items: {
                        some: {
                            productNameSnapshot: { contains: search, mode: 'insensitive' },
                        },
                    },
                },
            ];
        }
        const [totalCount, sales] = await Promise.all([
            this.prisma.sale.count({ where }),
            this.prisma.sale.findMany({
                where,
                include: {
                    store: {
                        select: { id: true, name: true, code: true },
                    },
                    client: {
                        select: { id: true, name: true, clientNumber: true },
                    },
                    payments: {
                        select: { method: true, amount: true },
                    },
                    items: {
                        select: { id: true, productNameSnapshot: true, quantity: true, unitPrice: true, lineTotal: true },
                    },
                    receipt: {
                        select: { number: true },
                    },
                },
                orderBy: { createdAt: 'desc' },
                take: limit,
                skip: offset,
            }),
        ]);
        return {
            total: totalCount,
            limit,
            offset,
            sales: sales.map((sale) => ({
                id: sale.id,
                saleNumber: sale.saleNumber,
                storeId: sale.storeId,
                storeName: sale.store?.name || 'Tienda Principal',
                clientId: sale.clientId,
                clientName: sale.client?.name || 'Consumidor Final',
                clientNumber: sale.client?.clientNumber || null,
                status: sale.status,
                subtotal: Number(sale.subtotal),
                cardSurcharge: sale.cardSurcharge !== null && sale.cardSurcharge !== undefined ? Number(sale.cardSurcharge) : 0,
                total: Number(sale.total),
                paymentStatus: sale.paymentStatus,
                cashReceived: sale.cashReceived !== null ? Number(sale.cashReceived) : null,
                cashChange: sale.cashChange !== null ? Number(sale.cashChange) : null,
                createdBy: sale.createdBy,
                createdAt: sale.createdAt,
                completedAt: sale.completedAt,
                annulledAt: sale.annulledAt,
                annulledBy: sale.annulledBy,
                annulReason: sale.annulReason,
                cashSessionId: sale.cashSessionId,
                receiptNumber: sale.receipt?.number || null,
                payments: sale.payments.map((p) => ({
                    method: p.method,
                    amount: Number(p.amount),
                })),
                itemsCount: sale.items.length,
            })),
        };
    }
    async annulSale(id, dto, user) {
        if (!dto.reason || !dto.reason.trim()) {
            throw new common_1.BadRequestException('Debe especificar el motivo de la anulación');
        }
        const sale = await this.prisma.sale.findUnique({
            where: { id },
            include: {
                store: true,
                items: true,
                payments: true,
                creditPurchases: true,
            },
        });
        if (!sale) {
            throw new common_1.NotFoundException('Venta no encontrada');
        }
        if (sale.status === client_1.SaleStatus.ANULLED) {
            throw new common_1.BadRequestException('Esta venta ya se encuentra anulada');
        }
        const userName = user.name || user.email || 'Administrador';
        const financialPayments = sale.payments.filter((p) => p.method !== client_1.SalePaymentMethod.CREDIT);
        let targetCashSession = null;
        if (financialPayments.length > 0) {
            if (sale.cashSessionId) {
                const originalSession = await this.prisma.cashSession.findUnique({
                    where: { id: sale.cashSessionId },
                });
                if (originalSession && originalSession.status === client_1.CashSessionStatus.OPEN) {
                    targetCashSession = originalSession;
                }
            }
            if (!targetCashSession) {
                if (user?.id) {
                    targetCashSession = await this.prisma.cashSession.findFirst({
                        where: {
                            storeId: sale.storeId,
                            businessId: sale.businessId,
                            status: client_1.CashSessionStatus.OPEN,
                            openedByUserId: user.id,
                        },
                    });
                }
                if (!targetCashSession) {
                    targetCashSession = await this.prisma.cashSession.findFirst({
                        where: {
                            storeId: sale.storeId,
                            businessId: sale.businessId,
                            status: client_1.CashSessionStatus.OPEN,
                        },
                    });
                }
                if (!targetCashSession) {
                    throw new common_1.BadRequestException('La venta original pertenece a un turno cerrado o histórico y requiere reversión financiera. No existe un turno de caja abierto actualmente en esta tienda. Debes abrir caja antes de completar la anulación.');
                }
            }
        }
        const itemsToRestore = new Map();
        for (const item of sale.items) {
            if (item.productType === client_1.ProductSaleType.KIT) {
                const kitComps = await this.prisma.productKitComponent.findMany({
                    where: { kitProductId: item.productId },
                });
                for (const comp of kitComps) {
                    const qtyToRestore = Number(comp.quantity) * Number(item.quantity);
                    const current = itemsToRestore.get(comp.componentProductId) || 0;
                    itemsToRestore.set(comp.componentProductId, current + qtyToRestore);
                }
            }
            else {
                const qtyToRestore = Number(item.quantity);
                const current = itemsToRestore.get(item.productId) || 0;
                itemsToRestore.set(item.productId, current + qtyToRestore);
            }
        }
        await this.prisma.$transaction(async (tx) => {
            await tx.sale.update({
                where: { id: sale.id },
                data: {
                    status: client_1.SaleStatus.ANULLED,
                    annulledAt: new Date(),
                    annulledBy: userName,
                    annulReason: dto.reason.trim(),
                },
            });
            for (const [productId, quantityToRestore] of itemsToRestore.entries()) {
                const stockRecord = await tx.inventoryStock.findUnique({
                    where: {
                        locationId_productId: {
                            locationId: sale.storeId,
                            productId,
                        },
                    },
                });
                const previousStock = stockRecord ? Number(stockRecord.quantity) : 0;
                const newStock = previousStock + quantityToRestore;
                if (stockRecord) {
                    await tx.inventoryStock.update({
                        where: { id: stockRecord.id },
                        data: {
                            quantity: newStock,
                        },
                    });
                }
                else {
                    await tx.inventoryStock.create({
                        data: {
                            locationId: sale.storeId,
                            productId,
                            quantity: newStock,
                            minimumStock: 0,
                        },
                    });
                }
                await tx.inventoryMovement.create({
                    data: {
                        locationId: sale.storeId,
                        productId,
                        type: client_1.InventoryMovementType.SALE_REVERSAL,
                        quantity: quantityToRestore,
                        previousStock: previousStock,
                        newStock: newStock,
                        referenceType: 'SALE_REVERSAL',
                        referenceId: sale.id,
                        reason: `Anulación de venta ${sale.saleNumber}: ${dto.reason.trim()}`,
                        notes: `Restauración de stock por anulación`,
                        createdBy: userName,
                    },
                });
            }
            if (sale.clientId) {
                const creditPurchases = await tx.creditPurchase.findMany({
                    where: { saleId: sale.id },
                });
                for (const cp of creditPurchases) {
                    if (cp.status !== 'Anulado') {
                        await tx.creditPurchase.update({
                            where: { id: cp.id },
                            data: {
                                status: 'Anulado',
                                annulledAt: new Date(),
                                annulledBy: userName,
                                annulmentReason: dto.reason.trim(),
                            },
                        });
                    }
                }
                if (creditPurchases.length > 0) {
                    await this.balanceSyncService.syncClientBalances(sale.clientId, tx);
                }
            }
            if (financialPayments.length > 0 && targetCashSession) {
                for (const pay of financialPayments) {
                    const payAmt = Math.round(Number(pay.amount) * 100) / 100;
                    const cardRowSurcharge = pay.method === client_1.SalePaymentMethod.CARD && sale.cardSurcharge
                        ? Number(sale.cardSurcharge)
                        : 0;
                    const reversalAmt = Math.round((payAmt + cardRowSurcharge) * 100) / 100;
                    await tx.cashMovement.create({
                        data: {
                            businessId: sale.businessId,
                            cashSessionId: targetCashSession.id,
                            storeId: sale.storeId,
                            cashRegisterId: targetCashSession.cashRegisterId,
                            saleId: sale.id,
                            type: client_1.CashMovementType.SALE_REVERSAL,
                            paymentMethod: pay.method,
                            amount: new client_1.Prisma.Decimal(-reversalAmt),
                            referenceType: 'Sale',
                            referenceId: sale.id,
                            description: sale.cashSessionId === targetCashSession.id
                                ? `Anulación de venta ${sale.saleNumber}`
                                : `Anulación de venta histórica ${sale.saleNumber} (Turno origen: ${sale.cashSessionId || 'Sin turno'})`,
                            notes: dto.reason.trim(),
                            createdByUserId: user.id || 'system',
                        },
                    });
                }
            }
        });
        await this.auditService.logAudit(user.id, userName, user.role || 'Administrador', 'SALE_ANNULLED', `Venta ${sale.saleNumber} anulada por ${userName}. Motivo: ${dto.reason.trim()}. Importe: S/ ${Number(sale.total).toFixed(2)}.`, sale.id);
        return this.getSaleById(sale.id);
    }
    async updateSale(id, dto, user, businessId = 'default') {
        const existingSale = await this.prisma.sale.findUnique({
            where: { id },
            include: {
                items: true,
                payments: true,
                creditPurchases: true,
                cashMovements: true,
                receipt: true,
                store: true,
            },
        });
        if (!existingSale) {
            throw new common_1.NotFoundException('Venta no encontrada');
        }
        if (existingSale.status === client_1.SaleStatus.ANULLED) {
            throw new common_1.BadRequestException('No se puede editar una venta anulada');
        }
        if (!dto.items || dto.items.length === 0) {
            throw new common_1.BadRequestException('La venta debe contener al menos un producto');
        }
        if (!dto.payments || dto.payments.length === 0) {
            throw new common_1.BadRequestException('Debe registrar al menos un método de pago');
        }
        const store = await this.prisma.location.findFirst({
            where: { id: dto.storeId, businessId, active: true },
        });
        if (!store) {
            throw new common_1.NotFoundException('Tienda no encontrada o inactiva');
        }
        let targetCashSession = null;
        if (dto.cashSessionId) {
            targetCashSession = await this.prisma.cashSession.findFirst({
                where: {
                    id: dto.cashSessionId,
                    storeId: dto.storeId,
                    businessId,
                    status: client_1.CashSessionStatus.OPEN,
                },
            });
        }
        if (!targetCashSession && existingSale.cashSessionId) {
            targetCashSession = await this.prisma.cashSession.findFirst({
                where: {
                    id: existingSale.cashSessionId,
                    storeId: dto.storeId,
                    businessId,
                    status: client_1.CashSessionStatus.OPEN,
                },
            });
        }
        if (!targetCashSession) {
            if (user?.id) {
                targetCashSession = await this.prisma.cashSession.findFirst({
                    where: {
                        storeId: dto.storeId,
                        businessId,
                        status: client_1.CashSessionStatus.OPEN,
                        openedByUserId: user.id,
                    },
                });
            }
            if (!targetCashSession) {
                targetCashSession = await this.prisma.cashSession.findFirst({
                    where: {
                        storeId: dto.storeId,
                        businessId,
                        status: client_1.CashSessionStatus.OPEN,
                    },
                });
            }
        }
        if (!targetCashSession) {
            throw new common_1.BadRequestException('No existe una caja abierta en esta tienda. Debes abrir un turno antes de actualizar ventas.');
        }
        const aggregatedItemsMap = new Map();
        for (const it of dto.items) {
            if (typeof it.quantity !== 'number' ||
                !Number.isFinite(it.quantity) ||
                !Number.isInteger(it.quantity)) {
                throw new common_1.BadRequestException('La cantidad de inventario debe ser un número entero.');
            }
            if (it.quantity <= 0) {
                throw new common_1.BadRequestException('La cantidad de cada producto debe ser mayor a 0');
            }
            const cur = aggregatedItemsMap.get(it.productId) || 0;
            aggregatedItemsMap.set(it.productId, cur + it.quantity);
        }
        const distinctProductIds = Array.from(aggregatedItemsMap.keys());
        const products = await this.prisma.product.findMany({
            where: {
                id: { in: distinctProductIds },
                businessId,
            },
            include: {
                kitComponents: {
                    include: {
                        componentProduct: true,
                    },
                },
            },
        });
        if (products.length !== distinctProductIds.length) {
            throw new common_1.BadRequestException('Uno o más productos no existen en el sistema');
        }
        for (const p of products) {
            if (!p.active) {
                throw new common_1.BadRequestException(`El producto "${p.name}" (${p.sku}) está inactivo y no puede venderse`);
            }
            if (p.saleType === client_1.ProductSaleType.KIT) {
                if (!p.kitComponents || p.kitComponents.length === 0) {
                    throw new common_1.BadRequestException(`El Kit "${p.name}" no tiene componentes configurados y no puede venderse`);
                }
                for (const comp of p.kitComponents) {
                    if (!comp.componentProduct || !comp.componentProduct.active) {
                        throw new common_1.BadRequestException(`El Kit "${p.name}" contiene el componente "${comp.componentProduct?.name || comp.componentProductId}" que está inactivo. No se puede vender.`);
                    }
                }
            }
        }
        const productMap = new Map();
        products.forEach((p) => productMap.set(p.id, p));
        let subtotal = 0;
        const computedItems = [];
        for (const [prodId, qty] of aggregatedItemsMap.entries()) {
            const prod = productMap.get(prodId);
            const unitPrice = Number(prod.salePrice);
            const lineTotal = Math.round(unitPrice * qty * 100) / 100;
            subtotal = Math.round((subtotal + lineTotal) * 100) / 100;
            computedItems.push({
                productId: prod.id,
                product: prod,
                quantity: qty,
                unitPrice,
                lineTotal,
            });
        }
        const cardPayments = dto.payments.filter((p) => p.method === client_1.SalePaymentMethod.CARD);
        const cardAmount = cardPayments.reduce((sum, p) => sum + p.amount, 0);
        const cardSurcharge = Math.round(cardAmount * 0.05 * 100) / 100;
        const total = Math.round((subtotal + cardSurcharge) * 100) / 100;
        let paymentSum = 0;
        let creditAmount = 0;
        let cashAmount = 0;
        for (const pay of dto.payments) {
            if (pay.amount <= 0) {
                throw new common_1.BadRequestException('El monto de cada pago debe ser mayor a 0');
            }
            const roundedAmount = Math.round(pay.amount * 100) / 100;
            paymentSum = Math.round((paymentSum + roundedAmount) * 100) / 100;
            if (pay.method === client_1.SalePaymentMethod.CREDIT) {
                creditAmount = Math.round((creditAmount + roundedAmount) * 100) / 100;
            }
            if (pay.method === client_1.SalePaymentMethod.CASH) {
                cashAmount = Math.round((cashAmount + roundedAmount) * 100) / 100;
            }
        }
        const isMatchingSubtotal = Math.abs(paymentSum - subtotal) <= 0.01;
        const isMatchingTotal = Math.abs(paymentSum - total) <= 0.01;
        if (!isMatchingSubtotal && !isMatchingTotal) {
            const diff = Math.round((subtotal - paymentSum) * 100) / 100;
            if (diff > 0) {
                throw new common_1.BadRequestException(`Faltan S/ ${diff.toFixed(2)} para completar los pagos de la venta (Subtotal: S/ ${subtotal.toFixed(2)}, Pagos: S/ ${paymentSum.toFixed(2)})`);
            }
            else {
                throw new common_1.BadRequestException(`La suma de los pagos (S/ ${paymentSum.toFixed(2)}) excede el total de la venta (S/ ${subtotal.toFixed(2)})`);
            }
        }
        let cashReceived = null;
        let cashChange = null;
        if (cashAmount > 0) {
            if (dto.cashReceived !== undefined && dto.cashReceived !== null) {
                if (dto.cashReceived < cashAmount) {
                    throw new common_1.BadRequestException(`El efectivo recibido (S/ ${dto.cashReceived.toFixed(2)}) no cubre el importe en efectivo (S/ ${cashAmount.toFixed(2)})`);
                }
                cashReceived = Math.round(dto.cashReceived * 100) / 100;
                cashChange = Math.round((cashReceived - cashAmount) * 100) / 100;
            }
            else {
                cashReceived = cashAmount;
                cashChange = 0;
            }
        }
        let clientRecord = null;
        const previousCreditOnSale = existingSale.payments
            .filter((p) => p.method === client_1.SalePaymentMethod.CREDIT)
            .reduce((sum, p) => sum + Number(p.amount), 0);
        if (creditAmount > 0) {
            if (!dto.clientId) {
                throw new common_1.BadRequestException('Selecciona un cliente para registrar una venta a crédito.');
            }
            clientRecord = await this.prisma.client.findUnique({
                where: { id: dto.clientId },
            });
            if (!clientRecord) {
                throw new common_1.NotFoundException('Cliente seleccionado no encontrado');
            }
            if (clientRecord.status === 'Desactivado') {
                throw new common_1.BadRequestException('El cliente seleccionado está desactivado');
            }
            const currentDailyDebt = clientRecord.dailyDebtBalance != null
                ? Math.max(0, Number(clientRecord.dailyDebtBalance))
                : Math.max(0, clientRecord.currentBalance);
            const offset = dto.clientId === existingSale.clientId ? previousCreditOnSale : 0;
            const projectedDailyDebt = Math.max(0, currentDailyDebt - offset) + creditAmount;
            if (clientRecord.creditLimit > 0 && projectedDailyDebt > clientRecord.creditLimit) {
                throw new common_1.BadRequestException(`Límite de crédito excedido. Límite: S/ ${clientRecord.creditLimit.toFixed(2)}, Deuda proyectada: S/ ${projectedDailyDebt.toFixed(2)}, Exceso: S/ ${(projectedDailyDebt - clientRecord.creditLimit).toFixed(2)}`);
            }
        }
        else if (dto.clientId) {
            clientRecord = await this.prisma.client.findUnique({
                where: { id: dto.clientId },
            });
        }
        let paymentStatus = 'PAID';
        if (creditAmount > 0) {
            paymentStatus = creditAmount === total ? 'CREDIT' : 'MIXED';
        }
        else if (dto.payments.length > 1) {
            paymentStatus = 'MIXED';
        }
        const newPhysicalDeductions = new Map();
        for (const item of computedItems) {
            if (item.product.saleType === client_1.ProductSaleType.KIT) {
                for (const comp of item.product.kitComponents) {
                    const compDeduction = Number(comp.quantity) * item.quantity;
                    const existing = newPhysicalDeductions.get(comp.componentProductId);
                    const currentQty = existing ? existing.quantityToDeduct : 0;
                    newPhysicalDeductions.set(comp.componentProductId, {
                        productId: comp.componentProductId,
                        productName: comp.componentProduct.name,
                        sku: comp.componentProduct.sku,
                        quantityToDeduct: currentQty + compDeduction,
                        reason: `Venta Kit "${item.product.name}" (${item.quantity} kit${item.quantity > 1 ? 's' : ''})`,
                    });
                }
            }
            else {
                const existing = newPhysicalDeductions.get(item.productId);
                const currentQty = existing ? existing.quantityToDeduct : 0;
                newPhysicalDeductions.set(item.productId, {
                    productId: item.productId,
                    productName: item.product.name,
                    sku: item.product.sku,
                    quantityToDeduct: currentQty + item.quantity,
                    reason: `Venta directa`,
                });
            }
        }
        const previousPhysicalDeductions = new Map();
        for (const item of existingSale.items) {
            if (item.productType === client_1.ProductSaleType.KIT) {
                const kitComps = await this.prisma.productKitComponent.findMany({
                    where: { kitProductId: item.productId },
                });
                for (const comp of kitComps) {
                    const qtyToRestore = Number(comp.quantity) * Number(item.quantity);
                    const current = previousPhysicalDeductions.get(comp.componentProductId) || 0;
                    previousPhysicalDeductions.set(comp.componentProductId, current + qtyToRestore);
                }
            }
            else {
                const qtyToRestore = Number(item.quantity);
                const current = previousPhysicalDeductions.get(item.productId) || 0;
                previousPhysicalDeductions.set(item.productId, current + qtyToRestore);
            }
        }
        const userName = user.name || user.email || 'Cajero';
        const stockWarnings = [];
        await this.prisma.$transaction(async (tx) => {
            for (const [prodId, qtyToRestore] of previousPhysicalDeductions.entries()) {
                const stockRecord = await tx.inventoryStock.findUnique({
                    where: {
                        locationId_productId: {
                            locationId: existingSale.storeId,
                            productId: prodId,
                        },
                    },
                });
                if (stockRecord) {
                    await tx.inventoryStock.update({
                        where: { id: stockRecord.id },
                        data: {
                            quantity: Number(stockRecord.quantity) + qtyToRestore,
                        },
                    });
                }
            }
            await tx.inventoryMovement.deleteMany({
                where: {
                    referenceType: 'SALE',
                    referenceId: existingSale.id,
                },
            });
            for (const deduction of newPhysicalDeductions.values()) {
                let stockRecord = await tx.inventoryStock.findUnique({
                    where: {
                        locationId_productId: {
                            locationId: dto.storeId,
                            productId: deduction.productId,
                        },
                    },
                });
                const previousStock = stockRecord ? Number(stockRecord.quantity) : 0;
                const newStock = previousStock - deduction.quantityToDeduct;
                if (newStock < 0) {
                    stockWarnings.push(`Esta venta dejó el producto "${deduction.productName}" con stock negativo (${newStock} unidades) en ${store.name}.`);
                }
                if (stockRecord) {
                    await tx.inventoryStock.update({
                        where: { id: stockRecord.id },
                        data: {
                            quantity: newStock,
                        },
                    });
                }
                else {
                    const prodObj = await tx.product.findUnique({
                        where: { id: deduction.productId },
                        select: { defaultMinStock: true },
                    });
                    const minStock = prodObj?.defaultMinStock ? Number(prodObj.defaultMinStock) : 0;
                    await tx.inventoryStock.create({
                        data: {
                            locationId: dto.storeId,
                            productId: deduction.productId,
                            quantity: newStock,
                            minimumStock: minStock,
                        },
                    });
                }
                await tx.inventoryMovement.create({
                    data: {
                        locationId: dto.storeId,
                        productId: deduction.productId,
                        type: client_1.InventoryMovementType.SALE,
                        quantity: -deduction.quantityToDeduct,
                        previousStock,
                        newStock,
                        referenceType: 'SALE',
                        referenceId: existingSale.id,
                        reason: deduction.reason,
                        notes: `Venta POS ${existingSale.saleNumber} (Actualizada)`,
                        createdBy: userName,
                    },
                });
            }
            await tx.sale.update({
                where: { id: existingSale.id },
                data: {
                    storeId: dto.storeId,
                    cashSessionId: targetCashSession.id,
                    clientId: dto.clientId || null,
                    subtotal: new client_1.Prisma.Decimal(subtotal),
                    cardSurcharge: cardSurcharge > 0 ? new client_1.Prisma.Decimal(cardSurcharge) : new client_1.Prisma.Decimal(0),
                    total: new client_1.Prisma.Decimal(total),
                    paymentStatus,
                    cashReceived: cashReceived !== null ? new client_1.Prisma.Decimal(cashReceived) : null,
                    cashChange: cashChange !== null ? new client_1.Prisma.Decimal(cashChange) : null,
                    notes: dto.notes?.trim() || null,
                    completedAt: new Date(),
                },
            });
            await tx.saleItem.deleteMany({
                where: { saleId: existingSale.id },
            });
            for (const item of computedItems) {
                await tx.saleItem.create({
                    data: {
                        saleId: existingSale.id,
                        productId: item.productId,
                        productCodeSnapshot: item.product.sku || item.product.barcode || item.product.name,
                        productNameSnapshot: item.product.name,
                        quantity: item.quantity,
                        unitPrice: new client_1.Prisma.Decimal(item.unitPrice),
                        lineTotal: new client_1.Prisma.Decimal(item.lineTotal),
                        productType: item.product.saleType,
                    },
                });
            }
            await tx.salePayment.deleteMany({
                where: { saleId: existingSale.id },
            });
            await tx.cashMovement.deleteMany({
                where: { saleId: existingSale.id },
            });
            for (const pay of dto.payments) {
                const roundedAmount = Math.round(pay.amount * 100) / 100;
                await tx.salePayment.create({
                    data: {
                        saleId: existingSale.id,
                        method: pay.method,
                        amount: new client_1.Prisma.Decimal(roundedAmount),
                        reference: pay.reference?.trim() || null,
                    },
                });
                if (pay.method !== client_1.SalePaymentMethod.CREDIT) {
                    const cardRowSurcharge = pay.method === client_1.SalePaymentMethod.CARD
                        ? Math.round(pay.amount * 0.05 * 100) / 100
                        : 0;
                    const cashMovementAmount = Math.round((roundedAmount + cardRowSurcharge) * 100) / 100;
                    await tx.cashMovement.create({
                        data: {
                            businessId,
                            cashSessionId: targetCashSession.id,
                            storeId: dto.storeId,
                            cashRegisterId: targetCashSession.cashRegisterId,
                            saleId: existingSale.id,
                            type: client_1.CashMovementType.SALE,
                            paymentMethod: pay.method,
                            amount: new client_1.Prisma.Decimal(cashMovementAmount),
                            referenceType: 'Sale',
                            referenceId: existingSale.id,
                            description: pay.method === client_1.SalePaymentMethod.CARD && cardRowSurcharge > 0
                                ? `Venta POS ${existingSale.saleNumber} (CARD) (+S/ ${cardRowSurcharge.toFixed(2)} recargo 5%)`
                                : `Venta POS ${existingSale.saleNumber} (${pay.method})`,
                            createdByUserId: user.id || 'system',
                        },
                    });
                }
            }
            await tx.creditPurchase.deleteMany({
                where: { saleId: existingSale.id },
            });
            if (creditAmount > 0 && dto.clientId) {
                await tx.creditPurchase.create({
                    data: {
                        clientId: dto.clientId,
                        date: new Date(),
                        isBaselineMovement: false,
                        product: `Venta POS ${existingSale.saleNumber}`,
                        unitPrice: creditAmount,
                        quantity: 1,
                        amount: creditAmount,
                        ticketNumber: existingSale.saleNumber,
                        registeredBy: userName,
                        status: 'Activo',
                        debtType: 'simple',
                        saleId: existingSale.id,
                    },
                });
            }
            if (existingSale.clientId) {
                await this.balanceSyncService.syncClientBalances(existingSale.clientId, tx);
            }
            if (dto.clientId && dto.clientId !== existingSale.clientId) {
                await this.balanceSyncService.syncClientBalances(dto.clientId, tx);
            }
            if (existingSale.receipt) {
                await tx.receipt.update({
                    where: { id: existingSale.receipt.id },
                    data: {
                        notes: dto.notes?.trim() || null,
                    },
                });
            }
        });
        await this.auditService.logAudit(user.id, userName, user.role || 'Cajero', 'SALE_UPDATED', `Venta ${existingSale.saleNumber} editada y actualizada por S/ ${total.toFixed(2)} en "${store.name}". Métodos: ${dto.payments.map((p) => p.method).join(', ')}.`, existingSale.id);
        return this.getSaleById(existingSale.id, stockWarnings);
    }
};
exports.SalesService = SalesService;
exports.SalesService = SalesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService,
        balance_sync_service_1.BalanceSyncService,
        cash_service_1.CashService])
], SalesService);
//# sourceMappingURL=sales.service.js.map