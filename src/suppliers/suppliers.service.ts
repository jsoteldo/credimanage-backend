import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SuppliersService {
  constructor(private prisma: PrismaService) {}

  async getSuppliers(query?: {
    active?: boolean | string;
    q?: string;
    businessId?: string;
  }) {
    const businessId = query?.businessId || 'default';
    const where: any = { businessId };

    if (query?.active !== undefined && query?.active !== '') {
      where.active = query.active === true || query.active === 'true';
    }

    if (query?.q && query.q.trim()) {
      const q = query.q.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { taxId: { contains: q, mode: 'insensitive' } },
        { contactName: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
      ];
    }

    return this.prisma.supplier.findMany({
      where,
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
    });
  }

  async getSupplierById(id: string, businessId = 'default') {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id, businessId },
    });
    if (!supplier) {
      throw new NotFoundException('Proveedor no encontrado');
    }
    return supplier;
  }

  async createSupplier(data: {
    name: string;
    taxId?: string | null;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    contactName?: string | null;
    businessId?: string;
  }) {
    const businessId = data.businessId || 'default';
    const name = data.name?.trim();
    if (!name) {
      throw new BadRequestException('El nombre del proveedor es obligatorio');
    }

    const existing = await this.prisma.supplier.findFirst({
      where: { businessId, name: { equals: name, mode: 'insensitive' } },
    });
    if (existing) {
      throw new BadRequestException(
        `Ya existe un proveedor con el nombre "${name}"`,
      );
    }

    return this.prisma.supplier.create({
      data: {
        businessId,
        name,
        taxId: data.taxId?.trim() || null,
        phone: data.phone?.trim() || null,
        email: data.email?.trim() || null,
        address: data.address?.trim() || null,
        contactName: data.contactName?.trim() || null,
        active: true,
      },
    });
  }

  async updateSupplier(
    id: string,
    data: {
      name?: string;
      taxId?: string | null;
      phone?: string | null;
      email?: string | null;
      address?: string | null;
      contactName?: string | null;
      active?: boolean;
      businessId?: string;
    },
  ) {
    const businessId = data.businessId || 'default';
    const existing = await this.getSupplierById(id, businessId);

    const updateData: any = {};

    if (data.name !== undefined) {
      const name = data.name.trim();
      if (!name) {
        throw new BadRequestException(
          'El nombre del proveedor no puede estar vacío',
        );
      }
      if (name.toLowerCase() !== existing.name.toLowerCase()) {
        const duplicate = await this.prisma.supplier.findFirst({
          where: {
            businessId,
            name: { equals: name, mode: 'insensitive' },
            id: { not: id },
          },
        });
        if (duplicate) {
          throw new BadRequestException(
            `Ya existe otro proveedor con el nombre "${name}"`,
          );
        }
      }
      updateData.name = name;
    }

    if (data.taxId !== undefined) {
      updateData.taxId = data.taxId?.trim() || null;
    }

    if (data.phone !== undefined) {
      updateData.phone = data.phone?.trim() || null;
    }

    if (data.email !== undefined) {
      updateData.email = data.email?.trim() || null;
    }

    if (data.address !== undefined) {
      updateData.address = data.address?.trim() || null;
    }

    if (data.contactName !== undefined) {
      updateData.contactName = data.contactName?.trim() || null;
    }

    if (data.active !== undefined) {
      updateData.active = Boolean(data.active);
    }

    return this.prisma.supplier.update({
      where: { id },
      data: updateData,
    });
  }

  async deactivateSupplier(id: string, businessId = 'default') {
    await this.getSupplierById(id, businessId);
    return this.prisma.supplier.update({
      where: { id },
      data: { active: false },
    });
  }

  async reactivateSupplier(id: string, businessId = 'default') {
    await this.getSupplierById(id, businessId);
    return this.prisma.supplier.update({
      where: { id },
      data: { active: true },
    });
  }
}
