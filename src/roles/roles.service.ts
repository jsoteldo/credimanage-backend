import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RolesService {
  constructor(private prisma: PrismaService) {}

  async getRoles() {
    return this.prisma.role.findMany({
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
        _count: {
          select: { users: true },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async getRoleById(id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
        _count: {
          select: { users: true },
        },
      },
    });
    if (!role) {
      throw new NotFoundException('Rol no encontrado');
    }
    return role;
  }

  async createRole(data: { name: string; description?: string }) {
    const name = data.name?.trim();
    if (!name) {
      throw new BadRequestException('El nombre del rol es obligatorio');
    }

    const existing = await this.prisma.role.findUnique({
      where: { name },
    });
    if (existing) {
      throw new BadRequestException(`El rol "${name}" ya existe`);
    }

    return this.prisma.role.create({
      data: {
        name,
        description: data.description?.trim() || null,
        isSystem: false,
      },
    });
  }

  async updateRolePermissions(roleId: string, permissionCodes: string[]) {
    const role = await this.getRoleById(roleId);

    // Find permissions corresponding to codes
    const permissions = await this.prisma.permission.findMany({
      where: {
        code: { in: permissionCodes },
      },
    });

    return this.prisma.$transaction(async (tx) => {
      // Delete existing role permissions
      await tx.rolePermission.deleteMany({
        where: { roleId },
      });

      // Insert new permissions
      if (permissions.length > 0) {
        await tx.rolePermission.createMany({
          data: permissions.map((p) => ({
            roleId,
            permissionId: p.id,
          })),
        });
      }

      return tx.role.findUnique({
        where: { id: roleId },
        include: {
          permissions: {
            include: { permission: true },
          },
        },
      });
    });
  }

  async getAllPermissions() {
    return this.prisma.permission.findMany({
      orderBy: [{ module: 'asc' }, { code: 'asc' }],
    });
  }
}
