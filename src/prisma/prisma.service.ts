import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private pool: Pool;

  constructor(configService: ConfigService) {
    let rawConnectionString =
      configService.get<string>('DATABASE_URL') || process.env.DATABASE_URL || '';
    // Limpiar comillas iniciales/finales y espacios accidentales
    const connectionString = rawConnectionString.trim().replace(/^["']|["']$/g, '');

    const sanitizedUrl = connectionString.replace(/:[^:@]+@/, ':****@');
    console.log(`📡 [PrismaService] Conectando a base de datos: ${sanitizedUrl || 'VACÍA/NO DEFINIDA'}`);

    if (connectionString.includes('/neondb')) {
      console.warn(
        '⚠️ [PrismaService] ADVERTENCIA CRÍTICA: DATABASE_URL apunta a la base de datos por defecto "/neondb" en vez de "/credimanage". Las tablas y datos del proyecto residen en "/credimanage".',
      );
    }

    const pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool);
    super({ adapter });
    this.pool = pool;
  }

  async onModuleInit() {
    try {
      await this.$connect();
      console.log('✅ [PrismaService] Conexión establecida con la base de datos exitosamente.');
    } catch (err: any) {
      console.error('🔥 [PrismaService] Error al conectar con la base de datos:', err.message);
      throw err;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    await this.pool.end();
  }
}
