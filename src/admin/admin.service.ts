import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService
  ) {}

  async getUsers() {
    return this.prisma.user.findMany({
      orderBy: { createdAt: 'asc' },
    });
  }

  async createUser(data: any, adminUser: any) {
    const email = data.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existing) {
      throw new BadRequestException('Ya existe un usuario registrado con este correo');
    }

    const password = data.password ? data.password : '123456';
    const passwordHash = bcrypt.hashSync(password, 10);

    const newUser = await this.prisma.user.create({
      data: {
        name: data.name.trim(),
        email,
        password: passwordHash,
        role: (data.role || 'Generico') as UserRole,
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=150',
        active: data.active !== undefined ? Boolean(data.active) : true,
        approved: data.approved !== undefined ? Boolean(data.approved) : true,
      },
    });

    await this.auditService.logAudit(
      adminUser.id,
      adminUser.name,
      adminUser.role,
      'CREAR_USUARIO',
      `Nuevo usuario de sistema creado: ${newUser.name} (${newUser.email}) con rol ${newUser.role}`,
      newUser.id
    );

    return newUser;
  }

  async approveUser(id: string, adminUser: any) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        approved: true,
        approvedBy: adminUser.name,
        approvedAt: new Date(),
      },
    });

    await this.auditService.logAudit(
      adminUser.id,
      adminUser.name,
      adminUser.role,
      'APROBAR_USUARIO',
      `Usuario ${updated.name} aprobado por Administrador`,
      updated.id
    );
    return updated;
  }

  async enableUser(id: string, adminUser: any) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const updated = await this.prisma.user.update({
      where: { id },
      data: { active: true },
    });

    await this.auditService.logAudit(
      adminUser.id,
      adminUser.name,
      adminUser.role,
      'HABILITAR_USUARIO',
      `Usuario ${updated.name} habilitado por Administrador`,
      updated.id
    );
    return updated;
  }

  async disableUser(id: string, adminUser: any) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const updated = await this.prisma.user.update({
      where: { id },
      data: { active: false },
    });

    await this.auditService.logAudit(
      adminUser.id,
      adminUser.name,
      adminUser.role,
      'DESHABILITAR_USUARIO',
      `Usuario ${updated.name} deshabilitado por Administrador`,
      updated.id
    );
    return updated;
  }

  async updateUser(id: string, data: any, adminUser: any) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const updateData: any = {};
    if (data.name) updateData.name = data.name.trim();
    if (data.email) updateData.email = data.email.trim().toLowerCase();
    if (data.role) updateData.role = data.role as UserRole;
    if (data.active !== undefined) updateData.active = Boolean(data.active);
    if (data.approved !== undefined) updateData.approved = Boolean(data.approved);

    if (data.password) {
      updateData.password = bcrypt.hashSync(data.password, 10);
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: updateData,
    });

    await this.auditService.logAudit(
      adminUser.id,
      adminUser.name,
      adminUser.role,
      'ACTUALIZAR_USUARIO',
      `Usuario ${updated.name} actualizado por Administrador`,
      updated.id
    );
    return updated;
  }

  async updateUserPermissions(id: string, updates: any, adminUser: any) {
    return this.updateUser(id, updates, adminUser);
  }

  async getAuditLogs() {
    return this.prisma.auditLog.findMany({
      orderBy: { timestamp: 'desc' },
    });
  }

  async getAnnulledOperations() {
    const annulledPurchases = await this.prisma.creditPurchase.findMany({
      where: { status: 'Anulado' },
      orderBy: { annulledAt: 'desc' },
    });

    const annulledPayments = await this.prisma.payment.findMany({
      where: { status: 'Anulado' },
      orderBy: { annulledAt: 'desc' },
    });

    return {
      annulledPurchases,
      annulledPayments,
    };
  }
}
