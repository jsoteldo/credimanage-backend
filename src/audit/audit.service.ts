import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@prisma/client';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async logAudit(
    userId: string,
    userName: string,
    userRole: UserRole,
    action: string,
    details: string,
    targetId?: string,
    ip?: string
  ) {
    return this.prisma.auditLog.create({
      data: {
        userId,
        userName,
        userRole,
        action,
        details,
        targetId,
        ip,
      },
    });
  }
}
