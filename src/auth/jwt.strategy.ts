import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        configService.get<string>('JWT_SECRET') ||
        'credimanage_pos_jwt_secret_key_2026',
    });
  }

  async validate(payload: any) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.id },
      include: {
        roleEntity: {
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    if (!user || !user.active) {
      throw new UnauthorizedException('Usuario no encontrado o inactivado');
    }

    let permissions: string[] = [];
    if (user.roleEntity && user.roleEntity.permissions) {
      permissions = user.roleEntity.permissions.map(
        (rp) => rp.permission.code,
      );
    } else if (user.role) {
      const role = await this.prisma.role.findUnique({
        where: { name: user.role },
        include: {
          permissions: {
            include: { permission: true },
          },
        },
      });
      if (role && role.permissions) {
        permissions = role.permissions.map((rp) => rp.permission.code);
      }
    }

    return {
      ...user,
      permissions,
    };
  }
}
