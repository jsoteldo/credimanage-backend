import {
  Injectable,
  BadRequestException,
  NotFoundException,
  HttpException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  BalanceSyncService,
  validatePaymentAllocations,
} from './balance-sync.service';
import {
  PaymentMethod,
  OperationStatus,
  PaymentPeriod,
  Prisma,
} from '@prisma/client';
import { toClientDto } from '../clients/client.dto';

@Injectable()
export class TransactionsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private balanceSyncService: BalanceSyncService,
  ) {}

  private mapClient(c: any) {
    return toClientDto(c);
  }

  // Helpers to map date filters
  private getDateFilterRange(
    dateFilter = 'today',
    startDate?: string,
    endDate?: string,
  ) {
    const start = new Date();
    const end = new Date();

    if (dateFilter === 'today') {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      return { gte: start, lte: end };
    } else if (dateFilter === 'yesterday') {
      start.setDate(start.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      end.setDate(end.getDate() - 1);
      end.setHours(23, 59, 59, 999);
      return { gte: start, lte: end };
    } else if (dateFilter === 'last7') {
      start.setDate(start.getDate() - 7);
      start.setHours(0, 0, 0, 0);
      return { gte: start };
    } else if (dateFilter === 'thismonth') {
      const year = start.getFullYear();
      const month = start.getMonth();
      const firstDay = new Date(year, month, 1, 0, 0, 0, 0);
      const lastDay = new Date(year, month + 1, 0, 23, 59, 59, 999);
      return { gte: firstDay, lte: lastDay };
    } else if (dateFilter === 'custom' && startDate) {
      const startCustom = new Date(`${startDate}T00:00:00`);
      const endCustom = endDate
        ? new Date(`${endDate}T23:59:59`)
        : new Date(`${startDate}T23:59:59`);
      return { gte: startCustom, lte: endCustom };
    }

    // Default to all time
    return undefined;
  }

  async addCreditPurchase(clientId: string, data: any, user: any) {
    return this.prisma.$transaction(async (tx) => {
      const client = await tx.client.findUnique({
        where: { id: clientId },
      });
      if (!client) {
        throw new NotFoundException('Cliente no encontrado');
      }

      const price = parseFloat(data.unitPrice) || 0;
      const qty = parseInt(data.quantity, 10) || 1;
      const totalAmount = Math.round(price * qty * 100) / 100;

      if (totalAmount <= 0) {
        throw new BadRequestException(
          'El importe total de la compra debe ser mayor a S/ 0.00',
        );
      }

      // Credit limit check for purchases (isolated from bank loans)
      const currentDailyDebt =
        client.dailyDebtBalance != null
          ? Math.max(0, Number(client.dailyDebtBalance))
          : Math.max(0, client.currentBalance);

      if (client.creditLimit > 0) {
        const projectedDailyDebt = currentDailyDebt + totalAmount;
        if (projectedDailyDebt > client.creditLimit) {
          throw new BadRequestException(
            `Límite de crédito de compras excedido. Límite: S/ ${client.creditLimit.toFixed(2)}, Deuda actual de compras: S/ ${currentDailyDebt.toFixed(2)}, Exceso: S/ ${(projectedDailyDebt - client.creditLimit).toFixed(2)}`,
          );
        }
      }

      let purchaseDate = new Date();
      if (data.date) {
        const now = new Date();
        const timePart = now.toISOString().split('T')[1] || '12:00:00.000Z';
        const customIso = `${data.date}T${timePart}`;
        const parsed = new Date(customIso);
        if (!isNaN(parsed.getTime())) {
          purchaseDate = parsed;
        } else if (!isNaN(new Date(data.date).getTime())) {
          purchaseDate = new Date(data.date);
        }
      }

      const newPurchase = await tx.creditPurchase.create({
        data: {
          clientId,
          date: purchaseDate,
          isBaselineMovement: false,
          product: data.product.trim(),
          unitPrice: price,
          quantity: qty,
          amount: totalAmount,
          ticketNumber: data.ticketNumber
            ? data.ticketNumber.trim()
            : `TKT-${Math.floor(1000 + Math.random() * 9000)}`,
          registeredBy: user.name,
          status: 'Activo',
        },
      });

      const synced = await this.balanceSyncService.syncClientBalances(
        clientId,
        tx,
      );
      const updatedClient = await tx.client.findUnique({
        where: { id: clientId },
      });

      await this.auditService.logAudit(
        user.id,
        user.name,
        user.role,
        'COMPRA_CREDITO',
        `Compra a crédito registrada por S/ ${totalAmount.toFixed(2)} (${newPurchase.product}) para ${client.name}. Nuevo saldo: S/ ${synced.currentBalance.toFixed(2)}`,
        newPurchase.id,
      );

      return {
        purchase: newPurchase,
        client: this.mapClient(updatedClient),
      };
    });
  }

  async applyPaymentTransaction(tx: any, paymentId: string, adminUser: any) {
    const payment = await tx.payment.findUnique({
      where: { id: paymentId },
    });
    if (!payment) {
      throw new NotFoundException('Abono no encontrado');
    }
    if (payment.approvedStatus !== 'PENDING_APPROVAL') {
      throw new BadRequestException(
        'El abono ya ha sido procesado (aprobado o rechazado)',
      );
    }

    const clientId = payment.clientId;
    const client = await tx.client.findUnique({ where: { id: clientId } });
    if (!client) {
      throw new NotFoundException('Cliente no encontrado');
    }

    const payAmount = payment.amount;

    if (payment.targetType === 'dailyDebt') {
      await tx.payment.update({
        where: { id: paymentId },
        data: {
          previousBalance: client.currentBalance,
          approvedStatus: 'APPROVED',
          approvedByUserId: adminUser.id,
          approvedAt: new Date(),
        },
      });

      const synced = await this.balanceSyncService.syncClientBalances(
        clientId,
        tx,
      );
      await tx.payment.update({
        where: { id: paymentId },
        data: { resultingBalance: synced.currentBalance },
      });

      await this.auditService.logAudit(
        adminUser.id,
        adminUser.name,
        adminUser.role,
        'APROBAR_ABONO',
        `Abono de deuda corriente de S/ ${payAmount.toFixed(2)} aprobado para ${client.name}. Saldo anterior: S/ ${client.currentBalance.toFixed(2)}, Nuevo saldo: S/ ${synced.currentBalance.toFixed(2)}`,
        payment.id,
      );

      const updatedClient = await tx.client.findUnique({
        where: { id: clientId },
      });
      const updatedPayment = await tx.payment.findUnique({
        where: { id: paymentId },
      });
      return { payment: updatedPayment, client: updatedClient };
    }

    const bankAllocations = ((payment.allocations as any[]) || []).filter(
      (a) => (a.targetType || a.type) === 'bankLoan',
    );

    const todayStr = new Date().toISOString().split('T')[0];
    const affectedLoanIds = new Set<string>();

    if (bankAllocations.length > 0) {
      for (const alloc of bankAllocations) {
        affectedLoanIds.add(alloc.loanId);
        const inst = await tx.installment.findFirst({
          where: {
            loanId: alloc.loanId,
            installmentNumber: alloc.installmentNumber,
          },
        });
        if (inst) {
          const newPaidAmount =
            Math.round((inst.paidAmount + alloc.amount) * 100) / 100;
          let instStatus: 'Pagada' | 'Parcial' | 'Pendiente' | 'Vencida' =
            'Parcial';
          if (newPaidAmount >= inst.amount - 0.001) {
            instStatus = 'Pagada';
          } else if (inst.dueDate < todayStr) {
            instStatus = 'Vencida';
          }
          await tx.installment.update({
            where: { id: inst.id },
            data: {
              paidAmount: newPaidAmount,
              status: instStatus,
              paidDate: instStatus === 'Pagada' ? new Date() : null,
            },
          });
        }
      }
    } else if (payment.targetType === 'bankLoan' && payment.loanId) {
      affectedLoanIds.add(payment.loanId);
      const pendingInst = await tx.installment.findMany({
        where: {
          loanId: payment.loanId,
          status: { in: ['Pendiente', 'Parcial', 'Vencida'] },
        },
        orderBy: [{ dueDate: 'asc' }, { installmentNumber: 'asc' }],
      });
      let rem = payAmount;
      for (const inst of pendingInst) {
        if (rem <= 0) break;
        const unpaid = Math.round((inst.amount - inst.paidAmount) * 100) / 100;
        const toPay = Math.min(unpaid, rem);
        const newPaidAmount = Math.round((inst.paidAmount + toPay) * 100) / 100;
        rem = Math.round((rem - toPay) * 100) / 100;
        let instStatus: 'Pagada' | 'Parcial' | 'Pendiente' | 'Vencida' =
          'Parcial';
        if (newPaidAmount >= inst.amount - 0.001) {
          instStatus = 'Pagada';
        } else if (inst.dueDate < todayStr) {
          instStatus = 'Vencida';
        }
        await tx.installment.update({
          where: { id: inst.id },
          data: {
            paidAmount: newPaidAmount,
            status: instStatus,
            paidDate: instStatus === 'Pagada' ? new Date() : null,
          },
        });
      }
    }

    for (const loanId of affectedLoanIds) {
      const loan = await tx.loan.findUnique({ where: { id: loanId } });
      if (loan) {
        const loanInstallments = await tx.installment.findMany({
          where: { loanId },
        });
        const totalPaid = loanInstallments.reduce(
          (sum, i) => sum + i.paidAmount,
          0,
        );
        const pending = Math.round((loan.totalAmount - totalPaid) * 100) / 100;
        const paidCount = loanInstallments.filter(
          (i) => i.status === 'Pagada',
        ).length;
        let newStatus: 'Activo' | 'Pagado' | 'Vencido' | 'Anulado' = 'Activo';
        if (pending <= 0.01) {
          newStatus = 'Pagado';
        } else {
          const hasOverdue = loanInstallments.some(
            (i) => i.dueDate < todayStr && i.status !== 'Pagada',
          );
          if (hasOverdue) newStatus = 'Vencido';
        }
        await tx.loan.update({
          where: { id: loanId },
          data: {
            paidAmount: totalPaid,
            pendingAmount: pending,
            paidInstallmentsCount: paidCount,
            status: newStatus,
          },
        });
      }
    }

    await tx.payment.update({
      where: { id: paymentId },
      data: {
        previousBalance: client.currentBalance,
        approvedStatus: 'APPROVED',
        approvedByUserId: adminUser.id,
        approvedAt: new Date(),
      },
    });

    const synced = await this.balanceSyncService.syncClientBalances(
      clientId,
      tx,
    );
    await tx.payment.update({
      where: { id: paymentId },
      data: { resultingBalance: synced.currentBalance },
    });

    await this.auditService.logAudit(
      adminUser.id,
      adminUser.name,
      adminUser.role,
      'APROBAR_ABONO',
      `Abono de S/ ${payAmount.toFixed(2)} aprobado para ${client.name}. Saldo anterior: S/ ${client.currentBalance.toFixed(2)}, Nuevo saldo: S/ ${synced.currentBalance.toFixed(2)}`,
      payment.id,
    );

    const updatedClient = await tx.client.findUnique({
      where: { id: clientId },
    });
    const updatedPayment = await tx.payment.findUnique({
      where: { id: paymentId },
    });
    return { payment: updatedPayment, client: updatedClient };
  }

  async registerPayment(clientId: string, data: any, user: any) {
    return this.prisma.$transaction(async (tx) => {
      const client = await tx.client.findUnique({ where: { id: clientId } });
      if (!client) {
        throw new NotFoundException('Cliente no encontrado');
      }

      let payAmount = parseFloat(data.amount);
      if (data.isFullPayoff) {
        payAmount = client.currentBalance;
      }

      if (isNaN(payAmount) || payAmount <= 0) {
        throw new BadRequestException(
          'El importe del abono debe ser mayor a S/ 0.00',
        );
      }

      if (payAmount > client.currentBalance) {
        throw new BadRequestException(
          `No se permite sobrepago. El abono solicitado (S/ ${payAmount.toFixed(2)}) supera el saldo deudor del cliente (S/ ${client.currentBalance.toFixed(2)})`,
        );
      }

      const method = data.paymentMethod || 'Efectivo';
      const cardSurcharge =
        method === 'Tarjeta' ? Math.round(payAmount * 0.05 * 100) / 100 : 0;
      const totalCharged = payAmount + cardSurcharge;

      let defaultNote = data.isFullPayoff
        ? 'Liquidación automática de adeudo'
        : 'Abono parcial registrado';
      if (method === 'Tarjeta') {
        defaultNote += ` (Incluye recargo del 5% por tarjeta: S/ ${cardSurcharge.toFixed(2)})`;
      }

      const activeLoans = await tx.loan.findMany({
        where: { clientId, status: { in: ['Activo', 'Vencido'] } },
        include: {
          installments: {
            where: { status: { in: ['Pendiente', 'Parcial', 'Vencida'] } },
            orderBy: [{ dueDate: 'asc' }, { installmentNumber: 'asc' }],
          },
        },
      });

      const allInstallments = activeLoans
        .flatMap((loan) =>
          loan.installments.map((inst) => ({
            ...inst,
            loanId: inst.loanId || loan.id,
            loan,
          })),
        )
        .sort((a, b) => {
          if (a.dueDate !== b.dueDate) {
            return a.dueDate.localeCompare(b.dueDate);
          }
          return a.installmentNumber - b.installmentNumber;
        });

      let remainingPayment = payAmount;
      const allocations: any[] = [];
      let loanAmountTotal = 0;

      for (const inst of allInstallments) {
        if (remainingPayment <= 0) break;
        const unpaidAmount =
          Math.round((inst.amount - inst.paidAmount) * 100) / 100;
        const toPay = Math.min(unpaidAmount, remainingPayment);
        if (toPay > 0) {
          allocations.push({
            targetType: 'bankLoan',
            loanId: inst.loanId,
            installmentNumber: inst.installmentNumber,
            amount: toPay,
          });
          loanAmountTotal = Math.round((loanAmountTotal + toPay) * 100) / 100;
          remainingPayment = Math.round((remainingPayment - toPay) * 100) / 100;
        }
      }

      if (remainingPayment > 0) {
        allocations.push({
          targetType: 'dailyDebt',
          amount: remainingPayment,
        });
      }

      let targetType: 'dailyDebt' | 'bankLoan' | 'legacyMixed' = 'dailyDebt';
      if (loanAmountTotal > 0 && remainingPayment > 0) {
        targetType = 'legacyMixed';
      } else if (loanAmountTotal > 0) {
        targetType = 'bankLoan';
      } else {
        targetType = 'dailyDebt';
      }

      const clientLoanIds = activeLoans.map((l) => l.id);
      validatePaymentAllocations(
        payAmount,
        targetType,
        allocations,
        undefined,
        clientLoanIds,
      );

      const isApproved = user.role === 'Administrador';

      const newPayment = await tx.payment.create({
        data: {
          clientId,
          date: new Date(),
          isBaselineMovement: false,
          amount: payAmount,
          previousBalance: client.currentBalance,
          resultingBalance: client.currentBalance,
          paymentMethod: method,
          cardSurcharge: cardSurcharge > 0 ? cardSurcharge : null,
          totalCharged,
          registeredBy: user.name,
          status: 'Activo',
          targetType,
          allocations,
          notes: data.notes ? data.notes.trim() : defaultNote,
          approvedStatus: isApproved ? 'APPROVED' : 'PENDING_APPROVAL',
          createdByUserId: user.id,
          approvedByUserId: isApproved ? user.id : null,
          approvedAt: isApproved ? new Date() : null,
        },
      });

      if (isApproved) {
        const todayStr = new Date().toISOString().split('T')[0];
        const affectedLoanIds = new Set<string>();

        for (const alloc of allocations) {
          if (alloc.targetType === 'bankLoan') {
            affectedLoanIds.add(alloc.loanId);
            const inst = await tx.installment.findFirst({
              where: {
                loanId: alloc.loanId,
                installmentNumber: alloc.installmentNumber,
              },
            });
            if (inst) {
              const newPaidAmount =
                Math.round((inst.paidAmount + alloc.amount) * 100) / 100;
              let instStatus: 'Pagada' | 'Parcial' | 'Pendiente' | 'Vencida' =
                'Parcial';
              if (newPaidAmount >= inst.amount - 0.001) {
                instStatus = 'Pagada';
              } else if (inst.dueDate < todayStr) {
                instStatus = 'Vencida';
              }
              await tx.installment.update({
                where: { id: inst.id },
                data: {
                  paidAmount: newPaidAmount,
                  status: instStatus,
                  paidDate: instStatus === 'Pagada' ? new Date() : null,
                },
              });
            }
          }
        }

        for (const loanId of affectedLoanIds) {
          const loan = await tx.loan.findUnique({ where: { id: loanId } });
          if (loan) {
            const loanInstallments = await tx.installment.findMany({
              where: { loanId },
            });
            const totalPaid = loanInstallments.reduce(
              (sum, i) => sum + i.paidAmount,
              0,
            );
            const pending =
              Math.round((loan.totalAmount - totalPaid) * 100) / 100;
            const paidCount = loanInstallments.filter(
              (i) => i.status === 'Pagada',
            ).length;
            let newStatus: 'Activo' | 'Pagado' | 'Vencido' | 'Anulado' =
              'Activo';
            if (pending <= 0.01) {
              newStatus = 'Pagado';
            } else {
              const hasOverdue = loanInstallments.some(
                (i) => i.dueDate < todayStr && i.status !== 'Pagada',
              );
              if (hasOverdue) newStatus = 'Vencido';
            }
            await tx.loan.update({
              where: { id: loanId },
              data: {
                paidAmount: totalPaid,
                pendingAmount: pending,
                paidInstallmentsCount: paidCount,
                status: newStatus,
              },
            });
          }
        }

        const synced = await this.balanceSyncService.syncClientBalances(
          clientId,
          tx,
        );
        await tx.payment.update({
          where: { id: newPayment.id },
          data: { resultingBalance: synced.currentBalance },
        });

        await this.auditService.logAudit(
          user.id,
          user.name,
          user.role,
          'REGISTRO_ABONO',
          `Abono de S/ ${payAmount.toFixed(2)} registrado y aprobado para ${client.name}. Saldo anterior: S/ ${client.currentBalance.toFixed(2)}, Nuevo saldo: S/ ${synced.currentBalance.toFixed(2)} [LEGACY_PAYMENT_WARNING: Se recomienda usar endpoints específicos por cartera]`,
          newPayment.id,
        );

        const updatedClient = await tx.client.findUnique({
          where: { id: clientId },
        });
        return {
          payment: newPayment,
          client: this.mapClient(updatedClient),
          message: `Abono registrado y aprobado con éxito. Nuevo saldo: S/ ${synced.currentBalance.toFixed(2)}`,
        };
      } else {
        await this.auditService.logAudit(
          user.id,
          user.name,
          user.role,
          'REGISTRO_ABONO_PENDIENTE',
          `Abono de S/ ${payAmount.toFixed(2)} registrado por ${user.name} y pendiente de aprobación`,
          newPayment.id,
        );
        return {
          payment: newPayment,
          client: this.mapClient(client),
          message:
            'Abono registrado con éxito. Pendiente de aprobación por un Administrador.',
        };
      }
    });
  }

  async registerDailyDebtPayment(clientId: string, data: any, user: any) {
    return this.prisma.$transaction(async (tx) => {
      const client = await tx.client.findUnique({ where: { id: clientId } });
      if (!client) {
        throw new NotFoundException('Cliente no encontrado');
      }

      let payAmount = parseFloat(data.amount);
      if (data.isFullPayoff) {
        const currentDaily =
          client.dailyDebtBalance != null
            ? Number(client.dailyDebtBalance)
            : client.currentBalance;
        if (currentDaily <= 0) {
          throw new BadRequestException(
            'El cliente no tiene deuda corriente pendiente para liquidar',
          );
        }
        payAmount = currentDaily;
      }

      if (isNaN(payAmount) || payAmount <= 0) {
        throw new BadRequestException(
          'El importe del abono a deuda corriente debe ser mayor a S/ 0.00',
        );
      }

      const method = data.paymentMethod || 'Efectivo';
      const cardSurcharge =
        method === 'Tarjeta' ? Math.round(payAmount * 0.05 * 100) / 100 : 0;
      const totalCharged = payAmount + cardSurcharge;

      let defaultNote = data.isFullPayoff
        ? 'Liquidación automática de deuda corriente'
        : 'Abono a deuda corriente';
      if (method === 'Tarjeta') {
        defaultNote += ` (Incluye recargo del 5% por tarjeta: S/ ${cardSurcharge.toFixed(2)})`;
      }

      const allocations = [{ targetType: 'dailyDebt', amount: payAmount }];
      validatePaymentAllocations(payAmount, 'dailyDebt', allocations);

      const isApproved = user.role === 'Administrador';

      const newPayment = await tx.payment.create({
        data: {
          clientId,
          date: new Date(),
          isBaselineMovement: false,
          amount: payAmount,
          previousBalance: client.currentBalance,
          resultingBalance: client.currentBalance,
          paymentMethod: method,
          cardSurcharge: cardSurcharge > 0 ? cardSurcharge : null,
          totalCharged,
          registeredBy: user.name,
          status: 'Activo',
          targetType: 'dailyDebt',
          allocations,
          notes: data.notes ? data.notes.trim() : defaultNote,
          approvedStatus: isApproved ? 'APPROVED' : 'PENDING_APPROVAL',
          createdByUserId: user.id,
          approvedByUserId: isApproved ? user.id : null,
          approvedAt: isApproved ? new Date() : null,
        },
      });

      if (isApproved) {
        const synced = await this.balanceSyncService.syncClientBalances(
          clientId,
          tx,
        );
        await tx.payment.update({
          where: { id: newPayment.id },
          data: { resultingBalance: synced.currentBalance },
        });

        await this.auditService.logAudit(
          user.id,
          user.name,
          user.role,
          'ABONO_DEUDA_DIARIA',
          `Abono a deuda corriente registrado y aprobado por S/ ${payAmount.toFixed(2)} para ${client.name}. Saldo anterior: S/ ${client.currentBalance.toFixed(2)}, Nuevo saldo: S/ ${synced.currentBalance.toFixed(2)}`,
          newPayment.id,
        );

        const updatedClient = await tx.client.findUnique({
          where: { id: clientId },
        });
        return {
          payment: newPayment,
          client: this.mapClient(updatedClient),
          message: `Abono a deuda corriente registrado y aprobado con éxito. Nuevo saldo: S/ ${synced.currentBalance.toFixed(2)}`,
        };
      } else {
        await this.auditService.logAudit(
          user.id,
          user.name,
          user.role,
          'REGISTRO_ABONO_PENDIENTE',
          `Abono a deuda corriente de S/ ${payAmount.toFixed(2)} registrado por ${user.name} y pendiente de aprobación`,
          newPayment.id,
        );
        return {
          payment: newPayment,
          client: this.mapClient(client),
          message:
            'Abono registrado con éxito. Pendiente de aprobación por un Administrador.',
        };
      }
    });
  }

  async registerLoanPayment(loanId: string, data: any, user: any) {
    return this.prisma.$transaction(async (tx) => {
      const loan = await tx.loan.findFirst({
        where: { OR: [{ id: loanId }, { code: loanId }] },
        include: {
          installments: {
            where: { status: { in: ['Pendiente', 'Parcial', 'Vencida'] } },
            orderBy: [{ dueDate: 'asc' }, { installmentNumber: 'asc' }],
          },
        },
      });

      if (!loan) {
        throw new NotFoundException('Crédito bancario no encontrado');
      }

      if (loan.status === 'Pagado') {
        throw new BadRequestException(
          'El crédito ya se encuentra totalmente pagado',
        );
      }
      if (loan.status === 'Anulado') {
        throw new BadRequestException('El crédito se encuentra anulado');
      }

      const client = await tx.client.findUnique({
        where: { id: loan.clientId },
      });
      if (!client) {
        throw new NotFoundException('Cliente no encontrado');
      }

      let payAmount = parseFloat(data.amount);
      if (data.isFullPayoff) {
        payAmount = loan.pendingAmount;
      }

      if (isNaN(payAmount) || payAmount <= 0) {
        throw new BadRequestException(
          'El importe del abono al crédito debe ser mayor a S/ 0.00',
        );
      }

      if (payAmount > loan.pendingAmount + 0.001) {
        throw new BadRequestException(
          `No se permite sobrepago en créditos bancarios. El abono solicitado (S/ ${payAmount.toFixed(2)}) supera la deuda pendiente del crédito (S/ ${loan.pendingAmount.toFixed(2)})`,
        );
      }

      const method = data.paymentMethod || 'Efectivo';
      const cardSurcharge =
        method === 'Tarjeta' ? Math.round(payAmount * 0.05 * 100) / 100 : 0;
      const totalCharged = payAmount + cardSurcharge;

      let defaultNote = data.isFullPayoff
        ? `Liquidación de crédito ${loan.code}`
        : `Abono a cuotas de crédito ${loan.code}`;
      if (method === 'Tarjeta') {
        defaultNote += ` (Incluye recargo del 5% por tarjeta: S/ ${cardSurcharge.toFixed(2)})`;
      }

      const allocations: any[] = [];
      let rem = payAmount;

      for (const inst of loan.installments) {
        if (rem <= 0) break;
        const unpaid = Math.round((inst.amount - inst.paidAmount) * 100) / 100;
        const toPay = Math.min(unpaid, rem);
        if (toPay > 0) {
          allocations.push({
            targetType: 'bankLoan',
            loanId: loan.id,
            installmentNumber: inst.installmentNumber,
            amount: toPay,
          });
          rem = Math.round((rem - toPay) * 100) / 100;
        }
      }

      validatePaymentAllocations(payAmount, 'bankLoan', allocations, loan.id, [
        loan.id,
      ]);

      const isApproved = user.role === 'Administrador';

      const newPayment = await tx.payment.create({
        data: {
          clientId: client.id,
          loanId: loan.id,
          date: new Date(),
          isBaselineMovement: false,
          amount: payAmount,
          previousBalance: client.currentBalance,
          resultingBalance: client.currentBalance,
          paymentMethod: method,
          cardSurcharge: cardSurcharge > 0 ? cardSurcharge : null,
          totalCharged,
          registeredBy: user.name,
          status: 'Activo',
          targetType: 'bankLoan',
          allocations,
          notes: data.notes ? data.notes.trim() : defaultNote,
          approvedStatus: isApproved ? 'APPROVED' : 'PENDING_APPROVAL',
          createdByUserId: user.id,
          approvedByUserId: isApproved ? user.id : null,
          approvedAt: isApproved ? new Date() : null,
        },
      });

      if (isApproved) {
        const todayStr = new Date().toISOString().split('T')[0];
        for (const alloc of allocations) {
          const inst = loan.installments.find(
            (i) => i.installmentNumber === alloc.installmentNumber,
          );
          if (inst) {
            const newPaid =
              Math.round((inst.paidAmount + alloc.amount) * 100) / 100;
            let instStatus: 'Pagada' | 'Parcial' | 'Pendiente' | 'Vencida' =
              'Parcial';
            if (newPaid >= inst.amount - 0.001) {
              instStatus = 'Pagada';
            } else if (inst.dueDate < todayStr) {
              instStatus = 'Vencida';
            }
            await tx.installment.update({
              where: { id: inst.id },
              data: {
                paidAmount: newPaid,
                status: instStatus,
                paidDate: instStatus === 'Pagada' ? new Date() : null,
              },
            });
          }
        }

        const loanInstallments = await tx.installment.findMany({
          where: { loanId: loan.id },
        });
        const totalPaid = loanInstallments.reduce(
          (sum, i) => sum + i.paidAmount,
          0,
        );
        const pending = Math.round((loan.totalAmount - totalPaid) * 100) / 100;
        const paidCount = loanInstallments.filter(
          (i) => i.status === 'Pagada',
        ).length;
        let newStatus: 'Activo' | 'Pagado' | 'Vencido' | 'Anulado' = 'Activo';
        if (pending <= 0.01) {
          newStatus = 'Pagado';
        } else {
          const hasOverdue = loanInstallments.some(
            (i) => i.dueDate < todayStr && i.status !== 'Pagada',
          );
          if (hasOverdue) newStatus = 'Vencido';
        }

        await tx.loan.update({
          where: { id: loan.id },
          data: {
            paidAmount: totalPaid,
            pendingAmount: pending,
            paidInstallmentsCount: paidCount,
            status: newStatus,
          },
        });

        const synced = await this.balanceSyncService.syncClientBalances(
          client.id,
          tx,
        );
        await tx.payment.update({
          where: { id: newPayment.id },
          data: { resultingBalance: synced.currentBalance },
        });

        await this.auditService.logAudit(
          user.id,
          user.name,
          user.role,
          'ABONO_CREDITO_BANCARIO',
          `Abono a crédito ${loan.code} registrado y aprobado por S/ ${payAmount.toFixed(2)} para ${client.name}. Saldo anterior: S/ ${client.currentBalance.toFixed(2)}, Nuevo saldo: S/ ${synced.currentBalance.toFixed(2)}`,
          newPayment.id,
        );

        const updatedClient = await tx.client.findUnique({
          where: { id: client.id },
        });
        return {
          payment: newPayment,
          client: this.mapClient(updatedClient),
          message: `Abono al crédito registrado y aprobado con éxito. Nuevo saldo: S/ ${synced.currentBalance.toFixed(2)}`,
        };
      } else {
        await this.auditService.logAudit(
          user.id,
          user.name,
          user.role,
          'REGISTRO_ABONO_PENDIENTE',
          `Abono a crédito ${loan.code} de S/ ${payAmount.toFixed(2)} registrado por ${user.name} y pendiente de aprobación`,
          newPayment.id,
        );
        return {
          payment: newPayment,
          client: this.mapClient(client),
          message:
            'Abono registrado con éxito. Pendiente de aprobación por un Administrador.',
        };
      }
    });
  }

  async approvePayment(paymentId: string, adminUser: any) {
    return this.prisma.$transaction(async (tx) => {
      const applied = await this.applyPaymentTransaction(
        tx,
        paymentId,
        adminUser,
      );
      return {
        message: 'Abono aprobado con éxito y aplicado al saldo del cliente',
        payment: applied.payment,
      };
    });
  }

  async rejectPayment(paymentId: string, reason: string, adminUser: any) {
    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({ where: { id: paymentId } });
      if (!payment) throw new NotFoundException('Abono no encontrado');
      if (payment.approvedStatus !== 'PENDING_APPROVAL') {
        throw new BadRequestException('El abono ya ha sido procesado');
      }

      const updated = await tx.payment.update({
        where: { id: paymentId },
        data: {
          approvedStatus: 'REJECTED',
          rejectedAt: new Date(),
          approvedByUserId: adminUser.id,
          rejectionReason: reason
            ? reason.trim()
            : 'Rechazado por el Administrador',
        },
      });

      await this.auditService.logAudit(
        adminUser.id,
        adminUser.name,
        adminUser.role,
        'RECHAZAR_ABONO',
        `Abono de S/ ${payment.amount.toFixed(2)} para cliente ID ${payment.clientId} rechazado por Administrador. Motivo: ${reason}`,
        payment.id,
      );

      return {
        message: 'Abono rechazado con éxito',
        payment: updated,
      };
    });
  }

  async getPendingPayments() {
    return this.prisma.payment.findMany({
      where: { approvedStatus: 'PENDING_APPROVAL' },
      include: {
        client: {
          select: {
            name: true,
            clientNumber: true,
          },
        },
      },
      orderBy: { date: 'desc' },
    });
  }

  async annulPurchase(id: string, reason: string, user: any) {
    if (!reason || !reason.trim()) {
      throw new BadRequestException(
        'Debe especificar el motivo de la anulación',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const purchase = await tx.creditPurchase.findUnique({ where: { id } });
      if (!purchase) {
        throw new NotFoundException('Compra no encontrada');
      }

      if (purchase.status === 'Anulado') {
        throw new BadRequestException('Esta compra ya se encuentra anulada');
      }

      const client = await tx.client.findUnique({
        where: { id: purchase.clientId },
      });
      if (!client) {
        throw new NotFoundException('Cliente asociado no encontrado');
      }

      if (purchase.isBaselineMovement === true) {
        await tx.balanceAdjustment.create({
          data: {
            clientId: purchase.clientId,
            type: 'DAILY_DEBT_REVERSAL',
            sourceType: 'CREDIT_PURCHASE',
            sourceId: purchase.id,
            amount: purchase.amount,
            reason: reason.trim(),
            createdBy: user.name,
            status: 'ACTIVO',
          },
        });
      }

      const updatedPurchase = await tx.creditPurchase.update({
        where: { id },
        data: {
          status: 'Anulado',
          annulledAt: new Date(),
          annulledBy: user.name,
          annulmentReason: reason.trim(),
        },
      });

      const synced = await this.balanceSyncService.syncClientBalances(
        purchase.clientId,
        tx,
      );

      await this.auditService.logAudit(
        user.id,
        user.name,
        user.role,
        'ANULACION_COMPRA',
        `Compra ${purchase.id} de S/ ${purchase.amount.toFixed(2)} anulada para ${client.name}. Motivo: ${reason.trim()}. Saldo resultante: S/ ${synced.currentBalance.toFixed(2)}`,
        purchase.id,
      );

      const updatedClient = await tx.client.findUnique({
        where: { id: purchase.clientId },
      });

      return {
        message: 'Compra anulada con éxito',
        purchase: updatedPurchase,
        client: this.mapClient(updatedClient),
      };
    });
  }

  async annulPayment(id: string, reason: string, user: any) {
    if (!reason || !reason.trim()) {
      throw new BadRequestException(
        'Debe especificar el motivo de la anulación',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({ where: { id } });
      if (!payment) {
        throw new NotFoundException('Abono no encontrado');
      }

      if (payment.status === 'Anulado') {
        throw new BadRequestException('Este abono ya se encuentra anulado');
      }

      const client = await tx.client.findUnique({
        where: { id: payment.clientId },
      });
      if (!client) {
        throw new NotFoundException('Cliente asociado no encontrado');
      }

      const todayStr = new Date().toISOString().split('T')[0];

      if (payment.isBaselineMovement === true) {
        const clientLoansCount = await tx.loan.count({
          where: { clientId: payment.clientId },
        });

        if (clientLoansCount === 0) {
          await tx.balanceAdjustment.create({
            data: {
              clientId: payment.clientId,
              type: 'DAILY_PAYMENT_REVERSAL',
              sourceType: 'PAYMENT',
              sourceId: payment.id,
              amount: payment.amount,
              reason: reason.trim(),
              createdBy: user.name,
              status: 'ACTIVO',
            },
          });
        } else {
          throw new HttpException(
            {
              code: 'LEGACY_PAYMENT_ALLOCATION_AMBIGUOUS',
              message:
                'El abono pertenece al período previo al nuevo modelo de saldos y no se puede determinar automáticamente la imputación entre cartera diaria y bancaria. Utilice el endpoint de resolución administrativa.',
            },
            422,
          );
        }
      } else {
        const bankAllocations = ((payment.allocations as any[]) || []).filter(
          (a) => (a.targetType || a.type) === 'bankLoan',
        );

        if (bankAllocations.length > 0) {
          for (const alloc of bankAllocations) {
            const inst = await tx.installment.findFirst({
              where: {
                loanId: alloc.loanId,
                installmentNumber: alloc.installmentNumber,
              },
            });
            if (inst) {
              const newPaid = Math.max(
                0,
                Math.round((inst.paidAmount - alloc.amount) * 100) / 100,
              );
              let instStatus: 'Pendiente' | 'Vencida' | 'Parcial' = 'Pendiente';
              if (newPaid > 0) {
                instStatus = 'Parcial';
              } else if (inst.dueDate < todayStr) {
                instStatus = 'Vencida';
              }
              await tx.installment.update({
                where: { id: inst.id },
                data: {
                  paidAmount: newPaid,
                  status: instStatus,
                  paidDate: null,
                },
              });
            }
          }

          const affectedLoanIds = [
            ...new Set(bankAllocations.map((a) => a.loanId)),
          ];
          for (const loanId of affectedLoanIds) {
            const loanInstallments = await tx.installment.findMany({
              where: { loanId },
            });
            const totalPaid = loanInstallments.reduce(
              (s, i) => s + i.paidAmount,
              0,
            );
            const loan = await tx.loan.findUnique({ where: { id: loanId } });
            if (loan) {
              const pendingAmount =
                Math.round((loan.totalAmount - totalPaid) * 100) / 100;
              const paidCount = loanInstallments.filter(
                (i) => i.status === 'Pagada',
              ).length;
              let newStatus: 'Activo' | 'Pagado' | 'Vencido' | 'Anulado' =
                'Activo';
              if (pendingAmount <= 0.01) {
                newStatus = 'Pagado';
              } else {
                const hasOverdue = loanInstallments.some(
                  (i) => i.dueDate < todayStr && i.status !== 'Pagada',
                );
                if (hasOverdue) newStatus = 'Vencido';
              }
              await tx.loan.update({
                where: { id: loanId },
                data: {
                  paidAmount: totalPaid,
                  pendingAmount,
                  paidInstallmentsCount: paidCount,
                  status: newStatus,
                },
              });
            }
          }
        }
      }

      const updatedPayment = await tx.payment.update({
        where: { id },
        data: {
          status: 'Anulado',
          annulledAt: new Date(),
          annulledBy: user.name,
          annulmentReason: reason.trim(),
        },
      });

      const synced = await this.balanceSyncService.syncClientBalances(
        payment.clientId,
        tx,
      );

      await this.auditService.logAudit(
        user.id,
        user.name,
        user.role,
        'ANULACION_ABONO',
        `Abono ${payment.id} de S/ ${payment.amount.toFixed(2)} anulado para ${client.name}. Motivo: ${reason.trim()}. Saldo resultante: S/ ${synced.currentBalance.toFixed(2)}`,
        payment.id,
      );

      const updatedClient = await tx.client.findUnique({
        where: { id: payment.clientId },
      });

      return {
        message: 'Abono anulado con éxito',
        payment: updatedPayment,
        client: this.mapClient(updatedClient),
      };
    });
  }

  async createLoanCredit(clientId: string, data: any, user: any) {
    return this.prisma.$transaction(async (tx) => {
      const client = await tx.client.findUnique({ where: { id: clientId } });
      if (!client) {
        throw new NotFoundException('Cliente no encontrado');
      }

      if (client.status !== 'Activo') {
        throw new BadRequestException('El cliente no se encuentra activo');
      }

      const cap = parseFloat(data.capital) || 0;
      const rate = parseFloat(data.interestRate) || 0;
      const count = parseInt(data.installmentsCount, 10) || 1;
      const freq = data.frequency || 'Mensual';
      const firstDate =
        data.firstDueDate || new Date().toISOString().split('T')[0];

      if (cap <= 0) {
        throw new BadRequestException(
          'El capital del crédito debe ser mayor a S/ 0.00',
        );
      }
      if (rate < 0) {
        throw new BadRequestException(
          'El porcentaje de interés no puede ser negativo',
        );
      }
      if (count <= 0) {
        throw new BadRequestException('El número de cuotas debe ser mayor a 0');
      }

      // Calculations (Simple Interest)
      const calculatedInterest =
        Math.round(((cap * rate) / 100 + Number.EPSILON) * 100) / 100;
      const calculatedTotal =
        Math.round((cap + calculatedInterest + Number.EPSILON) * 100) / 100;
      const calculatedInstallment =
        Math.round((calculatedTotal / count + Number.EPSILON) * 100) / 100;

      // Installments scheduling
      const baseCap = Math.round((cap / count + Number.EPSILON) * 100) / 100;
      const baseInt =
        Math.round((calculatedInterest / count + Number.EPSILON) * 100) / 100;
      const todayStr = new Date().toISOString().split('T')[0];

      const installmentsData: any[] = [];
      let accCap = 0;
      let accInt = 0;
      let accTot = 0;

      const getDueDate = (
        firstDateStr: string,
        frequency: string,
        index: number,
      ) => {
        const [y, m, d] = firstDateStr.split('-').map(Number);
        const dateObj = new Date(y, m - 1, d);
        if (frequency === 'Semanal') {
          dateObj.setDate(dateObj.getDate() + 7 * index);
        } else if (frequency === 'Quincenal') {
          dateObj.setDate(dateObj.getDate() + 15 * index);
        } else if (frequency === 'Mensual') {
          dateObj.setMonth(dateObj.getMonth() + index);
        }
        return `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
      };

      for (let i = 1; i <= count; i++) {
        const isLast = i === count;
        const c = isLast ? Math.round((cap - accCap) * 100) / 100 : baseCap;
        const int = isLast
          ? Math.round((calculatedInterest - accInt) * 100) / 100
          : baseInt;
        const tot = isLast
          ? Math.round((calculatedTotal - accTot) * 100) / 100
          : Math.round((c + int) * 100) / 100;

        accCap += c;
        accInt += int;
        accTot += tot;

        const dueDate = getDueDate(firstDate, freq, i - 1);

        installmentsData.push({
          installmentNumber: i,
          dueDate,
          capital: c,
          interest: int,
          amount: tot,
          paidAmount: 0,
          status: dueDate < todayStr ? 'Vencida' : 'Pendiente',
        });
      }

      const loanCode = data.ticketNumber
        ? data.ticketNumber.trim()
        : `CR-${Math.floor(100000 + Math.random() * 900000)}`;
      const loanDate = data.date ? new Date(data.date) : new Date();

      const newLoan = await tx.loan.create({
        data: {
          code: loanCode,
          clientId,
          date: loanDate,
          product: data.product
            ? data.product.trim()
            : `Crédito con intereses ${rate}% (${count} cuotas)`,
          capital: cap,
          interestRate: rate,
          interestAmount: calculatedInterest,
          totalAmount: calculatedTotal,
          installmentsCount: count,
          installmentAmount: calculatedInstallment,
          frequency: (freq === 'Día Fijo' ? 'DiaFijo' : freq) as PaymentPeriod,
          firstDueDate: firstDate,
          paidAmount: 0,
          pendingAmount: calculatedTotal,
          status: 'Activo',
          registeredBy: user.name,
          notes: data.notes ? data.notes.trim() : '',
          installments: {
            create: installmentsData,
          },
        },
        include: {
          installments: true,
        },
      });

      // Register purchase movement for accounting traceability
      const purchaseMovement = await tx.creditPurchase.create({
        data: {
          clientId,
          date: loanDate,
          product: `Crédito con Intereses (${loanCode}) - Cap: S/ ${cap.toFixed(2)} + Int: S/ ${calculatedInterest.toFixed(2)} (${count} cuotas ${freq})`,
          unitPrice: calculatedTotal,
          quantity: 1,
          amount: calculatedTotal,
          ticketNumber: loanCode,
          registeredBy: user.name,
          status: 'Activo',
          debtType: 'credit',
          loanId: newLoan.id,
        },
      });

      await this.balanceSyncService.syncClientBalances(clientId, tx);
      const updatedClient = await tx.client.findUnique({
        where: { id: clientId },
      });

      await this.auditService.logAudit(
        user.id,
        user.name,
        user.role,
        'REGISTRO_CREDITO_INTERES',
        `Crédito con intereses otorgado (${loanCode}) por S/ ${calculatedTotal.toFixed(2)} para ${client.name}. Saldo resultante: S/ ${updatedClient?.currentBalance != null ? updatedClient.currentBalance.toFixed(2) : '0.00'}`,
        newLoan.id,
      );

      const rawInstallments = Array.isArray(newLoan.installments)
        ? newLoan.installments
        : Array.isArray((newLoan.installments as any)?.create)
          ? (newLoan.installments as any).create
          : [];

      return {
        loan: {
          ...newLoan,
          installments: rawInstallments.map((inst: any) => ({
            ...inst,
            paidAmount: inst.paidAmount || undefined,
            paidDate: inst.paidDate
              ? typeof inst.paidDate.toISOString === 'function'
                ? inst.paidDate.toISOString()
                : inst.paidDate
              : undefined,
          })),
        },
        purchase: purchaseMovement,
        client: this.mapClient(updatedClient),
        message: 'Crédito con intereses registrado con éxito',
      };
    });
  }

  async getAllLoans() {
    const list = await this.prisma.loan.findMany({
      include: {
        client: {
          select: {
            id: true,
            name: true,
            clientNumber: true,
          },
        },
        installments: {
          orderBy: { installmentNumber: 'asc' },
        },
      },
      orderBy: { date: 'desc' },
    });

    return list.map((l) => ({
      ...l,
      clientName: l.client?.name || '',
      clientNumber: l.client?.clientNumber || '',
    }));
  }

  async getClientLoans(clientId: string) {
    const list = await this.prisma.loan.findMany({
      where: { clientId },
      include: { installments: { orderBy: { installmentNumber: 'asc' } } },
      orderBy: { date: 'desc' },
    });
    return list;
  }

  async getLoanById(loanId: string) {
    const loan = await this.prisma.loan.findFirst({
      where: { OR: [{ id: loanId }, { code: loanId }] },
      include: { installments: { orderBy: { installmentNumber: 'asc' } } },
    });
    if (!loan) {
      throw new NotFoundException('Crédito no encontrado');
    }
    return loan;
  }

  async annulLoan(loanId: string, reason: string, user: any) {
    if (!reason || !reason.trim()) {
      throw new BadRequestException(
        'Debe especificar el motivo de la anulación del crédito',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const loan = await tx.loan.findFirst({
        where: { OR: [{ id: loanId }, { code: loanId }] },
        include: { installments: true },
      });

      if (!loan) {
        throw new NotFoundException('Crédito no encontrado');
      }

      if (loan.status === 'Anulado') {
        throw new BadRequestException('Este crédito ya se encuentra anulado');
      }

      const client = await tx.client.findUnique({
        where: { id: loan.clientId },
        include: {
          openingSnapshots: {
            where: { migrationVersion: 'BALANCE_MODEL_V1', status: 'ACTIVO' },
            take: 1,
          },
        },
      });
      if (!client) {
        throw new NotFoundException('Cliente asociado no encontrado');
      }

      if (loan.paidAmount > 0) {
        throw new BadRequestException(
          `No se puede anular el crédito ${loan.code} porque ya posee pagos registrados (S/ ${loan.paidAmount.toFixed(2)}).`,
        );
      }

      const snapshot =
        client.openingSnapshots && client.openingSnapshots.length > 0
          ? client.openingSnapshots[0]
          : null;

      // If loan existed before snapshot, create BalanceAdjustment
      if (snapshot && loan.createdAt <= snapshot.cutOffDate) {
        await tx.balanceAdjustment.create({
          data: {
            clientId: loan.clientId,
            type: 'BANK_LOAN_REVERSAL',
            sourceType: 'LOAN',
            sourceId: loan.id,
            amount: loan.totalAmount,
            loanId: loan.id,
            reason: reason.trim(),
            createdBy: user.name,
            status: 'ACTIVO',
          },
        });
      }

      const updatedLoan = await tx.loan.update({
        where: { id: loan.id },
        data: {
          status: 'Anulado',
          annulledAt: new Date(),
          annulledBy: user.name,
          annulmentReason: reason.trim(),
        },
      });

      await tx.installment.updateMany({
        where: { loanId: loan.id },
        data: { status: 'Anulada' },
      });

      await tx.creditPurchase.updateMany({
        where: { loanId: loan.id },
        data: {
          status: 'Anulado',
          annulledAt: new Date(),
          annulledBy: user.name,
          annulmentReason: reason.trim(),
        },
      });

      const synced = await this.balanceSyncService.syncClientBalances(
        loan.clientId,
        tx,
      );

      await this.auditService.logAudit(
        user.id,
        user.name,
        user.role,
        'ANULACION_CREDITO',
        `Crédito ${loan.code} anulado para ${client.name}. Motivo: ${reason.trim()}. Saldo resultante: S/ ${synced.currentBalance.toFixed(2)}`,
        loan.id,
      );

      const updatedClient = await tx.client.findUnique({
        where: { id: loan.clientId },
      });

      return {
        message: 'Crédito anulado con éxito',
        loan: updatedLoan,
        client: this.mapClient(updatedClient),
      };
    });
  }

  async resolveAmbiguousReversal(paymentId: string, data: any, user: any) {
    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({ where: { id: paymentId } });
      if (!payment) {
        throw new NotFoundException('Abono no encontrado');
      }

      if (payment.status === 'Anulado') {
        throw new BadRequestException('Este abono ya se encuentra anulado');
      }

      const existingAdj = await tx.balanceAdjustment.findFirst({
        where: { sourceType: 'PAYMENT', sourceId: payment.id },
      });
      if (existingAdj) {
        throw new BadRequestException(
          'Este abono ya ha sido resuelto administrativamente',
        );
      }

      const client = await tx.client.findUnique({
        where: { id: payment.clientId },
      });
      if (!client) {
        throw new NotFoundException('Cliente no encontrado');
      }

      const dailyDebtDec = new Prisma.Decimal(
        (data.dailyDebtAmount || 0).toString(),
      );
      const bankAllocs: any[] = Array.isArray(data.bankAllocations)
        ? data.bankAllocations
        : [];
      let sumBank = new Prisma.Decimal(0);

      for (const b of bankAllocs) {
        if (!b.loanId) {
          throw new BadRequestException(
            'Cada allocation bancaria debe especificar loanId',
          );
        }
        const bAmount = new Prisma.Decimal((b.amount || 0).toString());
        if (bAmount.lessThanOrEqualTo(0)) {
          throw new BadRequestException(
            'El monto de cada allocation bancaria debe ser mayor a 0',
          );
        }
        sumBank = sumBank.plus(bAmount);

        const loan = await tx.loan.findFirst({
          where: { id: b.loanId, clientId: payment.clientId },
        });
        if (!loan) {
          throw new BadRequestException(
            `El crédito ${b.loanId} no pertenece al cliente del abono`,
          );
        }
      }

      const totalResolved = dailyDebtDec.plus(sumBank);
      const paymentAmount = new Prisma.Decimal(payment.amount.toString());
      if (!totalResolved.equals(paymentAmount)) {
        throw new BadRequestException(
          `La suma de dailyDebtAmount y bankAllocations (${totalResolved.toFixed(2)}) debe coincidir exactamente con el monto del abono (${paymentAmount.toFixed(2)})`,
        );
      }

      if (dailyDebtDec.greaterThan(0)) {
        await tx.balanceAdjustment.create({
          data: {
            clientId: payment.clientId,
            type: 'DAILY_PAYMENT_REVERSAL',
            sourceType: 'PAYMENT',
            sourceId: payment.id,
            amount: dailyDebtDec.toNumber(),
            reason:
              data.reason ||
              'Resolución administrativa de reversión de deuda corriente',
            createdBy: user.name,
            status: 'ACTIVO',
          },
        });
      }

      const todayStr = new Date().toISOString().split('T')[0];
      for (const b of bankAllocs) {
        await tx.balanceAdjustment.create({
          data: {
            clientId: payment.clientId,
            type: 'BANK_PAYMENT_REVERSAL',
            sourceType: 'PAYMENT',
            sourceId: payment.id,
            amount: Number(b.amount),
            loanId: b.loanId,
            reason:
              data.reason || 'Resolución administrativa de reversión bancaria',
            createdBy: user.name,
            status: 'ACTIVO',
          },
        });

        let remRevert = Number(b.amount);
        const paidInst = await tx.installment.findMany({
          where: { loanId: b.loanId, paidAmount: { gt: 0 } },
          orderBy: [{ dueDate: 'desc' }, { installmentNumber: 'desc' }],
        });

        for (const inst of paidInst) {
          if (remRevert <= 0) break;
          const toRevert = Math.min(inst.paidAmount, remRevert);
          const newPaid = Math.round((inst.paidAmount - toRevert) * 100) / 100;
          remRevert = Math.round((remRevert - toRevert) * 100) / 100;
          let instStatus: 'Pendiente' | 'Vencida' | 'Parcial' = 'Pendiente';
          if (newPaid > 0) {
            instStatus = 'Parcial';
          } else if (inst.dueDate < todayStr) {
            instStatus = 'Vencida';
          }
          await tx.installment.update({
            where: { id: inst.id },
            data: {
              paidAmount: newPaid,
              status: instStatus,
              paidDate: null,
            },
          });
        }

        const allInst = await tx.installment.findMany({
          where: { loanId: b.loanId },
        });
        const totalPaid = allInst.reduce((s, i) => s + i.paidAmount, 0);
        const loan = await tx.loan.findUnique({ where: { id: b.loanId } });
        if (loan) {
          const pending =
            Math.round((loan.totalAmount - totalPaid) * 100) / 100;
          const paidCount = allInst.filter((i) => i.status === 'Pagada').length;
          let newStatus: 'Activo' | 'Pagado' | 'Vencido' | 'Anulado' = 'Activo';
          if (pending <= 0.01) {
            newStatus = 'Pagado';
          } else {
            const hasOverdue = allInst.some(
              (i) => i.dueDate < todayStr && i.status !== 'Pagada',
            );
            if (hasOverdue) newStatus = 'Vencido';
          }
          await tx.loan.update({
            where: { id: b.loanId },
            data: {
              paidAmount: totalPaid,
              pendingAmount: pending,
              paidInstallmentsCount: paidCount,
              status: newStatus,
            },
          });
        }
      }

      // Mark payment as Anulado WITHOUT modifying targetType or allocations!
      const updatedPayment = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: 'Anulado',
          annulledAt: new Date(),
          annulledBy: user.name,
          annulmentReason:
            data.reason || 'Resolución administrativa de abono ambiguo',
        },
      });

      const synced = await this.balanceSyncService.syncClientBalances(
        payment.clientId,
        tx,
      );

      await this.auditService.logAudit(
        user.id,
        user.name,
        user.role,
        'RESOLUCION_ABONO_AMBIGUO',
        `Abono ambiguo ${payment.id} de S/ ${payment.amount.toFixed(2)} resuelto y anulado para ${client.name}. Saldo resultante: S/ ${synced.currentBalance.toFixed(2)}`,
        payment.id,
      );

      const updatedClient = await tx.client.findUnique({
        where: { id: payment.clientId },
      });

      return {
        message: 'Abono ambiguo resuelto y anulado con éxito',
        payment: updatedPayment,
        client: this.mapClient(updatedClient),
      };
    });
  }

  async getPaymentsHistory(params: any) {
    const range = this.getDateFilterRange(
      params.dateFilter,
      params.startDate,
      params.endDate,
    );
    const where: any = {};

    if (range) {
      where.date = range;
    }

    if (params.query) {
      const q = params.query.toLowerCase().trim();
      where.OR = [
        { notes: { contains: q, mode: 'insensitive' } },
        { registeredBy: { contains: q, mode: 'insensitive' } },
        {
          client: {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { clientNumber: { contains: q, mode: 'insensitive' } },
            ],
          },
        },
      ];
    }

    const list = await this.prisma.payment.findMany({
      where,
      include: { client: true },
      orderBy: { date: 'desc' },
    });

    const mappedPayments = list.map((p) => ({
      ...p,
      clientName: p.client.name,
      clientNumber: p.client.clientNumber,
      clientPhone: p.client.phone,
      client: undefined, // remove full client nested object
    }));

    const activePayments = mappedPayments.filter((p) => p.status === 'Activo');
    const totalAmount = activePayments.reduce((sum, p) => sum + p.amount, 0);

    return {
      payments: mappedPayments,
      summary: {
        count: activePayments.length,
        totalAmount,
      },
    };
  }

  async getPurchasesHistory(params: any) {
    const range = this.getDateFilterRange(
      params.dateFilter,
      params.startDate,
      params.endDate,
    );
    const where: any = {};

    if (range) {
      where.date = range;
    }

    if (params.query) {
      const q = params.query.toLowerCase().trim();
      where.OR = [
        { product: { contains: q, mode: 'insensitive' } },
        { ticketNumber: { contains: q, mode: 'insensitive' } },
        { registeredBy: { contains: q, mode: 'insensitive' } },
        {
          client: {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { clientNumber: { contains: q, mode: 'insensitive' } },
            ],
          },
        },
      ];
    }

    const list = await this.prisma.creditPurchase.findMany({
      where,
      include: { client: true },
      orderBy: { date: 'desc' },
    });

    const mappedPurchases = list.map((p) => ({
      ...p,
      clientName: p.client.name,
      clientNumber: p.client.clientNumber,
      clientPhone: p.client.phone,
      client: undefined,
    }));

    const activePurchases = mappedPurchases.filter(
      (p) => p.status === 'Activo',
    );
    const totalAmount = activePurchases.reduce((sum, p) => sum + p.amount, 0);

    return {
      purchases: mappedPurchases,
      summary: {
        count: activePurchases.length,
        totalAmount,
      },
    };
  }
}
