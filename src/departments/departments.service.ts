import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DepartmentsService {
  constructor(private prisma: PrismaService) {}

  async getDepartments(query?: {
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
        { description: { contains: q, mode: 'insensitive' } },
      ];
    }

    return this.prisma.department.findMany({
      where,
      include: {
        _count: {
          select: { products: true },
        },
      },
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
    });
  }

  async getDepartmentById(id: string, businessId = 'default') {
    const dept = await this.prisma.department.findFirst({
      where: { id, businessId },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });
    if (!dept) {
      throw new NotFoundException('Departamento no encontrado');
    }
    return dept;
  }

  async createDepartment(data: {
    name: string;
    description?: string | null;
    businessId?: string;
  }) {
    const businessId = data.businessId || 'default';
    const name = data.name?.trim();
    if (!name) {
      throw new BadRequestException('El nombre del departamento es obligatorio');
    }

    const existing = await this.prisma.department.findFirst({
      where: {
        businessId,
        name: { equals: name, mode: 'insensitive' },
      },
    });
    if (existing) {
      throw new BadRequestException(
        `Ya existe un departamento con el nombre "${name}"`,
      );
    }

    return this.prisma.department.create({
      data: {
        businessId,
        name,
        description: data.description?.trim() || null,
        active: true,
      },
    });
  }

  async updateDepartment(
    id: string,
    data: {
      name?: string;
      description?: string | null;
      active?: boolean;
      businessId?: string;
    },
  ) {
    const businessId = data.businessId || 'default';
    const existing = await this.getDepartmentById(id, businessId);

    const updateData: any = {};

    if (data.name !== undefined) {
      const name = data.name.trim();
      if (!name) {
        throw new BadRequestException(
          'El nombre del departamento no puede estar vacío',
        );
      }
      if (name.toLowerCase() !== existing.name.toLowerCase()) {
        const duplicate = await this.prisma.department.findFirst({
          where: {
            businessId,
            name: { equals: name, mode: 'insensitive' },
            id: { not: id },
          },
        });
        if (duplicate) {
          throw new BadRequestException(
            `Ya existe otro departamento con el nombre "${name}"`,
          );
        }
      }
      updateData.name = name;
    }

    if (data.description !== undefined) {
      updateData.description = data.description?.trim() || null;
    }

    if (data.active !== undefined) {
      updateData.active = Boolean(data.active);
    }

    return this.prisma.department.update({
      where: { id },
      data: updateData,
    });
  }

  async deactivateDepartment(id: string, businessId = 'default') {
    await this.getDepartmentById(id, businessId);
    return this.prisma.department.update({
      where: { id },
      data: { active: false },
    });
  }

  async reactivateDepartment(id: string, businessId = 'default') {
    await this.getDepartmentById(id, businessId);
    return this.prisma.department.update({
      where: { id },
      data: { active: true },
    });
  }

  async deleteDepartment(id: string, businessId = 'default') {
    const dept = await this.getDepartmentById(id, businessId);
    if (dept._count.products > 0) {
      throw new BadRequestException(
        `No se puede eliminar el departamento "${dept.name}" porque tiene ${dept._count.products} producto(s) asociado(s). Se recomienda desactivarlo.`,
      );
    }
    return this.prisma.department.delete({
      where: { id },
    });
  }
}
