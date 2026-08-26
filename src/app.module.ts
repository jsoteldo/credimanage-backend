import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { existsSync } from 'fs';
import { join } from 'path';
import { PrismaModule } from './prisma/prisma.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { ClientsModule } from './clients/clients.module';
import { TransactionsModule } from './transactions/transactions.module';
import { ReportsModule } from './reports/reports.module';
import { AdminModule } from './admin/admin.module';

// Dynamically resolve React dist path
const rootDistPath = join(process.cwd(), 'dist');
const parentDistPath = join(process.cwd(), '..', 'dist');
const distPath = existsSync(rootDistPath) ? rootDistPath : parentDistPath;

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ServeStaticModule.forRoot({
      rootPath: distPath,
      exclude: ['/crediApi*'],
    }),
    PrismaModule,
    AuditModule,
    AuthModule,
    ClientsModule,
    TransactionsModule,
    ReportsModule,
    AdminModule,
  ],
})
export class AppModule {}
