import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { PaymentMethod, OperationStatus, PaymentPeriod } from '@prisma/client';

@Injectable()
export class TransactionsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService
  ) {}

  // Helpers to map date filters
  private getDateFilterRange(dateFilter = 'today', startDate?: string, endDate?: string) {
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
      const endCustom = endDate ? new Date(`${endDate}T23:59:59`) : new Date(`${startDate}T23:59:59`);
      return { gte: startCustom, lte: endCustom };
    }

    // Default to all time
    return undefined;
  }

  async addCreditPurchase(clientId: string, data: any, user: any) {
    const client = await this.prisma.client.findUnique({ where: { id: clientId } });
    if (!client) {
      throw new NotFoundException('Cliente no encontrado');
    }

    const price = parseFloat(data.unitPrice) || 0;
    const qty = parseInt(data.quantity, 10) || 1;
    const totalAmount = price * qty;

    if (totalAmount <= 0) {
      throw new BadRequestException('El importe total de la compra debe ser mayor a S/ 0.00');
    }

    // Credit limit check
    if (client.creditLimit > 0) {
      const projectedBalance = client.currentBalance + totalAmount;
      if (projectedBalance > client.creditLimit) {
        throw new BadRequestException(
          `Límite de crédito excedido. Límite actual: S/ ${client.creditLimit.toFixed(2)}, Saldo actual: S/ ${client.currentBalance.toFixed(2)}, Exceso: S/ ${(projectedBalance - client.creditLimit).toFixed(2)}`
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

    const newPurchase = await this.prisma.creditPurchase.create({
      data: {
        clientId,
        date: purchaseDate,
        product: data.product.trim(),
        unitPrice: price,
        quantity: qty,
        amount: totalAmount,
        ticketNumber: data.ticketNumber ? data.ticketNumber.trim() : `TKT-${Math.floor(1000 + Math.random() * 9000)}`,
        registeredBy: user.name,
        status: 'Activo',
      },
    });

    const updatedClient = await this.prisma.client.update({
      where: { id: clientId },
      data: { currentBalance: { increment: totalAmount } },
    });

    await this.auditService.logAudit(
      user.id,
      user.name,
      user.role,
      'COMPRA_CREDITO',
      `Compra a crédito registrada por S/ ${totalAmount.toFixed(2)} (${newPurchase.product}) para ${client.name}. Nuevo saldo: S/ ${updatedClient.currentBalance.toFixed(2)}`,
      newPurchase.id
    );

    return {
      purchase: newPurchase,
      client: {
        ...updatedClient,
        paymentPeriod: updatedClient.paymentPeriod === 'DiaFijo' ? 'Día Fijo' : updatedClient.paymentPeriod,
      },
    };
  }

  async applyPaymentTransaction(tx: any, paymentId: string, adminUser: any) {
    const payment = await tx.payment.findUnique({
      where: { id: paymentId },
    });
    if (!payment) {
      throw new NotFoundException('Abono no encontrado');
    }
    if (payment.approvedStatus !== 'PENDING_APPROVAL') {
      throw new BadRequestException('El abono ya ha sido procesado (aprobado o rechazado)');
    }

    const clientId = payment.clientId;
    const client = await tx.client.findUnique({ where: { id: clientId } });
    if (!client) {
      throw new NotFoundException('Cliente no encontrado');
    }

    const payAmount = payment.amount;

    // Distribute payment across active loans and installments
    const activeLoans = await tx.loan.findMany({
      where: { clientId, status: { in: ['Activo', 'Vencido'] } },
      include: {
        installments: {
          where: { status: { in: ['Pendiente', 'Parcial', 'Vencida'] } },
          orderBy: [{ dueDate: 'asc' }, { installmentNumber: 'asc' }],
        },
      },
    });

    let remainingPayment = payAmount;
    let lastAffectedLoanId: string | null = null;
    const todayStr = new Date().toISOString().split('T')[0];

    const allInstallments = activeLoans
      .flatMap((loan) =>
        loan.installments.map((inst) => ({
          ...inst,
          loan,
        }))
      )
      .sort((a, b) => {
        if (a.dueDate !== b.dueDate) {
          return a.dueDate.localeCompare(b.dueDate);
        }
        return a.installmentNumber - b.installmentNumber;
      });

    for (const inst of allInstallments) {
      if (remainingPayment <= 0) break;

      const unpaidAmount = Math.round((inst.amount - inst.paidAmount) * 100) / 100;
      const toPay = Math.min(unpaidAmount, remainingPayment);

      const newPaidAmount = Math.round((inst.paidAmount + toPay) * 100) / 100;
      remainingPayment = Math.round((remainingPayment - toPay) * 100) / 100;

      let instStatus: 'Pagada' | 'Parcial' | 'Pendiente' | 'Vencida' = 'Parcial';
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

      lastAffectedLoanId = inst.loanId;
    }

    for (const loan of activeLoans) {
      const loanInstallments = await tx.installment.findMany({
        where: { loanId: loan.id },
      });

      const totalPaid = loanInstallments.reduce((sum, inst) => sum + inst.paidAmount, 0);
      const pending = Math.round((loan.totalAmount - totalPaid) * 100) / 100;
      const paidCount = loanInstallments.filter((inst) => inst.status === 'Pagada').length;

      let newStatus: 'Activo' | 'Pagado' | 'Vencido' | 'Anulado' = 'Activo';
      if (pending <= 0.01) {
        newStatus = 'Pagado';
      } else {
        const hasOverdue = loanInstallments.some(
          (inst) => inst.dueDate < todayStr && inst.status !== 'Pagada'
        );
        if (hasOverdue) {
          newStatus = 'Vencido';
        }
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
    }

    const previousBalance = client.currentBalance;
    const resultingBalance = previousBalance - payAmount;

    const updatedClient = await tx.client.update({
      where: { id: clientId },
      data: { currentBalance: resultingBalance },
    });

    const updatedPayment = await tx.payment.update({
      where: { id: paymentId },
      data: {
        previousBalance,
        resultingBalance,
        approvedStatus: 'APPROVED',
        approvedByUserId: adminUser.id,
        approvedAt: new Date(),
        loanId: lastAffectedLoanId || payment.loanId,
      },
    });

    await this.auditService.logAudit(
      adminUser.id,
      adminUser.name,
      adminUser.role,
      'APROBAR_ABONO',
      `Abono de S/ ${payAmount.toFixed(2)} aprobado para ${client.name}. Saldo anterior: S/ ${previousBalance.toFixed(2)}, Nuevo saldo: S/ ${resultingBalance.toFixed(2)}`,
      payment.id
    );

    return {
      payment: updatedPayment,
      client: updatedClient,
    };
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
        throw new BadRequestException('El importe del abono debe ser mayor a S/ 0.00');
      }

      // No permitir sobrepago accidental
      if (payAmount > client.currentBalance) {
        throw new BadRequestException(
          `No se permite sobrepago. El abono solicitado (S/ ${payAmount.toFixed(2)}) supera el saldo deudor del cliente (S/ ${client.currentBalance.toFixed(2)})`
        );
      }

      const method = data.paymentMethod || 'Efectivo';
      const cardSurcharge = method === 'Tarjeta' ? Math.round(payAmount * 0.05 * 100) / 100 : 0;
      const totalCharged = payAmount + cardSurcharge;

      let defaultNote = data.isFullPayoff ? 'Liquidación automática de adeudo' : 'Abono parcial registrado';
      if (method === 'Tarjeta') {
        defaultNote += ` (Incluye recargo del 5% por tarjeta: S/ ${cardSurcharge.toFixed(2)})`;
      }

      // Create the payment record
      const newPayment = await tx.payment.create({
        data: {
          clientId,
          date: new Date(),
          amount: payAmount,
          previousBalance: client.currentBalance,
          resultingBalance: client.currentBalance, // stays same if pending
          paymentMethod: method as any,
          cardSurcharge: cardSurcharge > 0 ? cardSurcharge : null,
          totalCharged,
          registeredBy: user.name,
          status: 'Activo',
          notes: data.notes ? data.notes.trim() : defaultNote,
          approvedStatus: user.role === 'Administrador' ? 'APPROVED' : 'PENDING_APPROVAL',
          createdByUserId: user.id,
        },
      });

      if (user.role === 'Administrador') {
        // Temporarily reset approvedStatus to PENDING_APPROVAL for application
        await tx.payment.update({
          where: { id: newPayment.id },
          data: { approvedStatus: 'PENDING_APPROVAL' }
        });
        const applied = await this.applyPaymentTransaction(tx, newPayment.id, user);
        return {
          payment: applied.payment,
          client: {
            ...applied.client,
            paymentPeriod: applied.client.paymentPeriod === 'DiaFijo' ? 'Día Fijo' : applied.client.paymentPeriod,
          },
          message: `Abono registrado y aprobado con éxito. Nuevo saldo: S/ ${applied.client.currentBalance.toFixed(2)}`,
        };
      } else {
        // Cajero
        await this.auditService.logAudit(
          user.id,
          user.name,
          user.role,
          'REGISTRO_ABONO_PENDIENTE',
          `Abono de S/ ${payAmount.toFixed(2)} registrado por ${user.name} y pendiente de aprobación`,
          newPayment.id
        );
        return {
          payment: newPayment,
          client: {
            ...client,
            paymentPeriod: client.paymentPeriod === 'DiaFijo' ? 'Día Fijo' : client.paymentPeriod,
          },
          message: `Abono registrado con éxito. Pendiente de aprobación por un Administrador.`,
        };
      }
    });
  }

  async approvePayment(paymentId: string, adminUser: any) {
    return this.prisma.$transaction(async (tx) => {
      const applied = await this.applyPaymentTransaction(tx, paymentId, adminUser);
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
          rejectionReason: reason ? reason.trim() : 'Rechazado por el Administrador',
        },
      });

      await this.auditService.logAudit(
        adminUser.id,
        adminUser.name,
        adminUser.role,
        'RECHAZAR_ABONO',
        `Abono de S/ ${payment.amount.toFixed(2)} para cliente ID ${payment.clientId} rechazado por Administrador. Motivo: ${reason}`,
        payment.id
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

  async annulPayment(id: string, reason: string, user: any) {
    if (!reason || !reason.trim()) {
      throw new BadRequestException('Debe especificar el motivo de la anulación');
    }

    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({ where: { id } });
      if (!payment) {
        throw new NotFoundException('Abono no encontrado');
      }

      if (payment.status === 'Anulado') {
        throw new BadRequestException('Este abono ya se encuentra anulado');
      }

      const client = await tx.client.findUnique({ where: { id: payment.clientId } });
      if (!client) {
        throw new NotFoundException('Cliente asociado no encontrado');
      }

      // Revert the payment distribution sequentially from the most recently paid installments (LIFO)
      const activeLoans = await tx.loan.findMany({
        where: { clientId: payment.clientId, status: { in: ['Activo', 'Vencido', 'Pagado'] } },
        include: {
          installments: {
            where: { paidAmount: { gt: 0 } },
            orderBy: [{ dueDate: 'desc' }, { installmentNumber: 'desc' }],
          },
        },
      });

      let remainingRevert = payment.amount;

      // Sort installments from all loans descending (newest paid first)
      const allPaidInstallments = activeLoans
        .flatMap((loan) =>
          loan.installments.map((inst) => ({
            ...inst,
            loan,
          }))
        )
        .sort((a, b) => {
          if (a.dueDate !== b.dueDate) {
            return b.dueDate.localeCompare(a.dueDate);
          }
          return b.installmentNumber - a.installmentNumber;
        });

      const todayStr = new Date().toISOString().split('T')[0];

      for (const inst of allPaidInstallments) {
        if (remainingRevert <= 0) break;

        const toRevert = Math.min(inst.paidAmount, remainingRevert);
        const newPaidAmount = Math.round((inst.paidAmount - toRevert) * 100) / 100;
        remainingRevert = Math.round((remainingRevert - toRevert) * 100) / 100;

        let instStatus: 'Pendiente' | 'Vencida' | 'Parcial' = 'Pendiente';
        if (newPaidAmount > 0) {
          instStatus = 'Parcial';
        } else if (inst.dueDate < todayStr) {
          instStatus = 'Vencida';
        }

        await tx.installment.update({
          where: { id: inst.id },
          data: {
            paidAmount: newPaidAmount,
            status: instStatus,
            paidDate: null,
          },
        });
      }

      // Recalculate all affected loans
      for (const loan of activeLoans) {
        const loanInstallments = await tx.installment.findMany({
          where: { loanId: loan.id },
        });

        const totalPaid = loanInstallments.reduce((sum, inst) => sum + inst.paidAmount, 0);
        const pending = Math.round((loan.totalAmount - totalPaid) * 100) / 100;
        const paidCount = loanInstallments.filter((inst) => inst.status === 'Pagada').length;

        let newStatus: 'Activo' | 'Pagado' | 'Vencido' | 'Anulado' = 'Activo';
        if (pending <= 0.01) {
          newStatus = 'Pagado';
        } else {
          const hasOverdue = loanInstallments.some(
            (inst) => inst.dueDate < todayStr && inst.status !== 'Pagada'
          );
          if (hasOverdue) {
            newStatus = 'Vencido';
          }
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

      const updatedClient = await tx.client.update({
        where: { id: payment.clientId },
        data: { currentBalance: { increment: payment.amount } },
      });

      await this.auditService.logAudit(
        user.id,
        user.name,
        user.role,
        'ANULACION_ABONO',
        `Abono ${payment.id} de S/ ${payment.amount.toFixed(2)} anulado para ${client.name}. Motivo: ${reason.trim()}. Saldo restaurado a: S/ ${updatedClient.currentBalance.toFixed(2)}`,
        payment.id
      );

      return {
        message: 'Abono anulado con éxito',
        payment: updatedPayment,
        client: {
          ...updatedClient,
          paymentPeriod: updatedClient.paymentPeriod === 'DiaFijo' ? 'Día Fijo' : updatedClient.paymentPeriod,
        },
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
      const firstDate = data.firstDueDate || new Date().toISOString().split('T')[0];

      if (cap <= 0) {
        throw new BadRequestException('El capital del crédito debe ser mayor a S/ 0.00');
      }
      if (rate < 0) {
        throw new BadRequestException('El porcentaje de interés no puede ser negativo');
      }
      if (count <= 0) {
        throw new BadRequestException('El número de cuotas debe ser mayor a 0');
      }

      // Calculations (Simple Interest)
      const calculatedInterest = Math.round(((cap * rate) / 100 + Number.EPSILON) * 100) / 100;
      const calculatedTotal = Math.round((cap + calculatedInterest + Number.EPSILON) * 100) / 100;
      const calculatedInstallment = Math.round((calculatedTotal / count + Number.EPSILON) * 100) / 100;

      // Credit limit validation (currentBalance + calculatedTotal <= creditLimit)
      if (client.creditLimit > 0) {
        const projectedBalance = client.currentBalance + calculatedTotal;
        if (projectedBalance > client.creditLimit) {
          throw new BadRequestException(
            `El crédito solicitado supera el límite de crédito del cliente. Límite: S/ ${client.creditLimit.toFixed(2)}, Saldo actual: S/ ${client.currentBalance.toFixed(2)}, Total del nuevo crédito: S/ ${calculatedTotal.toFixed(2)}, Exceso: S/ ${(projectedBalance - client.creditLimit).toFixed(2)}`
          );
        }
      }

      // Installments scheduling
      const baseCap = Math.round((cap / count + Number.EPSILON) * 100) / 100;
      const baseInt = Math.round((calculatedInterest / count + Number.EPSILON) * 100) / 100;
      const todayStr = new Date().toISOString().split('T')[0];

      const installmentsData: any[] = [];
      let accCap = 0;
      let accInt = 0;
      let accTot = 0;

      const getDueDate = (firstDateStr: string, frequency: string, index: number) => {
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
        const int = isLast ? Math.round((calculatedInterest - accInt) * 100) / 100 : baseInt;
        const tot = isLast ? Math.round((calculatedTotal - accTot) * 100) / 100 : Math.round((c + int) * 100) / 100;

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

      const loanCode = data.ticketNumber ? data.ticketNumber.trim() : `CR-${Math.floor(100000 + Math.random() * 900000)}`;
      const loanDate = data.date ? new Date(data.date) : new Date();

      const newLoan = await tx.loan.create({
        data: {
          code: loanCode,
          clientId,
          date: loanDate,
          product: data.product ? data.product.trim() : `Crédito con intereses ${rate}% (${count} cuotas)`,
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

      // Update client balance
      const updatedClient = await tx.client.update({
        where: { id: clientId },
        data: { currentBalance: { increment: calculatedTotal } },
      });

      await this.auditService.logAudit(
        user.id,
        user.name,
        user.role,
        'REGISTRO_CREDITO_INTERES',
        `Crédito con intereses otorgado (${loanCode}) por S/ ${calculatedTotal.toFixed(2)} para ${client.name}. Saldo resultante: S/ ${updatedClient.currentBalance.toFixed(2)}`,
        newLoan.id
      );

      return {
        loan: {
          ...newLoan,
          installments: newLoan.installments.map((inst) => ({
            ...inst,
            paidAmount: inst.paidAmount || undefined,
            paidDate: inst.paidDate ? inst.paidDate.toISOString() : undefined,
          })),
        },
        purchase: purchaseMovement,
        client: {
          ...updatedClient,
          paymentPeriod: updatedClient.paymentPeriod === 'DiaFijo' ? 'Día Fijo' : updatedClient.paymentPeriod,
        },
        message: 'Crédito con intereses registrado con éxito',
      };
    });
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
      throw new BadRequestException('Debe especificar el motivo de la anulación del crédito');
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

      const client = await tx.client.findUnique({ where: { id: loan.clientId } });
      if (!client) {
        throw new NotFoundException('Cliente asociado no encontrado');
      }

      // We do not allow destructive annulment if it has payments
      if (loan.paidAmount > 0) {
        throw new BadRequestException(
          `No se puede anular el crédito ${loan.code} porque ya posee pagos registrados (S/ ${loan.paidAmount.toFixed(2)}).`
        );
      }

      // Mark loan as annulled
      const updatedLoan = await tx.loan.update({
        where: { id: loan.id },
        data: {
          status: 'Anulado',
          annulledAt: new Date(),
          annulledBy: user.name,
          annulmentReason: reason.trim(),
        },
      });

      // Mark installments as Anulada
      await tx.installment.updateMany({
        where: { loanId: loan.id },
        data: { status: 'Anulada' },
      });

      // Revert the total amount from client balance
      const updatedClient = await tx.client.update({
        where: { id: loan.clientId },
        data: { currentBalance: { decrement: loan.totalAmount } },
      });

      // Annul related purchase movement
      await tx.creditPurchase.updateMany({
        where: { loanId: loan.id },
        data: {
          status: 'Anulado',
          annulledAt: new Date(),
          annulledBy: user.name,
          annulmentReason: reason.trim(),
        },
      });

      await this.auditService.logAudit(
        user.id,
        user.name,
        user.role,
        'ANULACION_CREDITO',
        `Crédito ${loan.code} anulado para ${client.name}. Motivo: ${reason.trim()}. Saldo restaurado a: S/ ${updatedClient.currentBalance.toFixed(2)}`,
        loan.id
      );

      return {
        message: 'Crédito anulado con éxito',
        loan: updatedLoan,
        client: {
          ...updatedClient,
          paymentPeriod: updatedClient.paymentPeriod === 'DiaFijo' ? 'Día Fijo' : updatedClient.paymentPeriod,
        },
      };
    });
  }

  async getPaymentsHistory(params: any) {
    const range = this.getDateFilterRange(params.dateFilter, params.startDate, params.endDate);
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
    const range = this.getDateFilterRange(params.dateFilter, params.startDate, params.endDate);
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

    const activePurchases = mappedPurchases.filter((p) => p.status === 'Activo');
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
