import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private auditService: AuditService
  ) {}

  async login(email: string, pass: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });

    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (!user.approved) {
      throw new UnauthorizedException('Tu cuenta todavía está pendiente de aprobación.');
    }

    if (!user.active) {
      throw new UnauthorizedException('Tu cuenta ha sido deshabilitada.');
    }

    const isMatch = bcrypt.compareSync(pass, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const payload = { id: user.id, email: user.email, name: user.name, role: user.role };
    const token = this.jwtService.sign(payload);

    await this.auditService.logAudit(
      user.id,
      user.name,
      user.role,
      'INICIO_SESION',
      `Inicio de sesión exitoso como ${user.role}`
    );

    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
      },
    };
  }

  async register(data: any) {
    const email = data.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existing) {
      throw new BadRequestException('Ya existe un usuario registrado con este correo');
    }

    const passwordHash = bcrypt.hashSync(data.password, 10);

    const newUser = await this.prisma.user.create({
      data: {
        name: data.name.trim(),
        email,
        password: passwordHash,
        role: 'Generico',
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=150',
        active: true,
        approved: false,
      },
    });

    return {
      message: 'Tu cuenta ha sido registrada correctamente y está pendiente de aprobación por un administrador.',
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
      },
    };
  }
}
