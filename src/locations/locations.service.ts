import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LocationType } from '@prisma/client';

@Injectable()
export class LocationsService {
  constructor(private prisma: PrismaService) {}

  async getLocations(query?: {
    type?: LocationType;
    active?: boolean | string;
    q?: string;
    businessId?: string;
  }) {
    const businessId = query?.businessId || 'default';
    const where: any = { businessId };

    if (query?.type) {
      where.type = query.type;
    }

    if (query?.active !== undefined && query?.active !== '') {
      where.active = query.active === true || query.active === 'true';
    }

    if (query?.q && query.q.trim()) {
      const q = query.q.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { code: { contains: q, mode: 'insensitive' } },
        { address: { contains: q, mode: 'insensitive' } },
      ];
    }

    return this.prisma.location.findMany({
      where,
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
    });
  }

  async getLocationById(id: string, businessId = 'default') {
    const location = await this.prisma.location.findFirst({
      where: { id, businessId },
    });
    if (!location) {
      throw new NotFoundException('Ubicación no encontrada');
    }
    return location;
  }

  async createLocation(data: {
    name: string;
    code?: string | null;
    address?: string | null;
    type?: LocationType;
    businessId?: string;
  }) {
    const businessId = data.businessId || 'default';
    const name = data.name?.trim();
    if (!name) {
      throw new BadRequestException('El nombre de la ubicación es obligatorio');
    }

    const code = data.code?.trim() || null;

    // Check duplicate name
    const existingName = await this.prisma.location.findFirst({
      where: { businessId, name: { equals: name, mode: 'insensitive' } },
    });
    if (existingName) {
      throw new BadRequestException(
        `Ya existe una ubicación con el nombre "${name}"`,
      );
    }

    // Check duplicate code
    if (code) {
      const existingCode = await this.prisma.location.findFirst({
        where: { businessId, code: { equals: code, mode: 'insensitive' } },
      });
      if (existingCode) {
        throw new BadRequestException(
          `Ya existe una ubicación con el código "${code}"`,
        );
      }
    }

    return this.prisma.location.create({
      data: {
        businessId,
        name,
        code,
        address: data.address?.trim() || null,
        type: data.type || LocationType.STORE,
        active: true,
      },
    });
  }

  async updateLocation(
    id: string,
    data: {
      name?: string;
      code?: string | null;
      address?: string | null;
      type?: LocationType;
      active?: boolean;
      businessId?: string;
    },
  ) {
    const businessId = data.businessId || 'default';
    const existing = await this.getLocationById(id, businessId);

    const updateData: any = {};

    if (data.name !== undefined) {
      const name = data.name.trim();
      if (!name) {
        throw new BadRequestException(
          'El nombre de la ubicación no puede estar vacío',
        );
      }
      if (name.toLowerCase() !== existing.name.toLowerCase()) {
        const duplicate = await this.prisma.location.findFirst({
          where: {
            businessId,
            name: { equals: name, mode: 'insensitive' },
            id: { not: id },
          },
        });
        if (duplicate) {
          throw new BadRequestException(
            `Ya existe otra ubicación con el nombre "${name}"`,
          );
        }
      }
      updateData.name = name;
    }

    if (data.code !== undefined) {
      const code = data.code?.trim() || null;
      if (code && (!existing.code || code.toLowerCase() !== existing.code.toLowerCase())) {
        const duplicate = await this.prisma.location.findFirst({
          where: {
            businessId,
            code: { equals: code, mode: 'insensitive' },
            id: { not: id },
          },
        });
        if (duplicate) {
          throw new BadRequestException(
            `Ya existe otra ubicación con el código "${code}"`,
          );
        }
      }
      updateData.code = code;
    }

    if (data.address !== undefined) {
      updateData.address = data.address?.trim() || null;
    }

    if (data.type !== undefined) {
      updateData.type = data.type;
    }

    if (data.active !== undefined) {
      updateData.active = Boolean(data.active);
    }

    return this.prisma.location.update({
      where: { id },
      data: updateData,
    });
  }

  async deactivateLocation(id: string, businessId = 'default') {
    await this.getLocationById(id, businessId);
    return this.prisma.location.update({
      where: { id },
      data: { active: false },
    });
  }

  async reactivateLocation(id: string, businessId = 'default') {
    await this.getLocationById(id, businessId);
    return this.prisma.location.update({
      where: { id },
      data: { active: true },
    });
  }
}
