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
import { LocationsModule } from './locations/locations.module';
import { DepartmentsModule } from './departments/departments.module';
import { SuppliersModule } from './suppliers/suppliers.module';
import { ProductsModule } from './products/products.module';
import { RolesModule } from './roles/roles.module';
import { SettingsModule } from './settings/settings.module';

// Dynamically resolve React dist path
const frontendDistPath = join(process.cwd(), '..', 'frontend', 'dist');
const rootDistPath = join(process.cwd(), 'dist');
const parentDistPath = join(process.cwd(), '..', 'dist');
const distPath = existsSync(join(frontendDistPath, 'index.html'))
  ? frontendDistPath
  : existsSync(join(parentDistPath, 'index.html'))
    ? parentDistPath
    : rootDistPath;

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ServeStaticModule.forRoot({
      rootPath: distPath,
      exclude: ['/crediApi{/*path}'],
    }),
    PrismaModule,
    AuditModule,
    AuthModule,
    ClientsModule,
    TransactionsModule,
    ReportsModule,
    AdminModule,
    LocationsModule,
    DepartmentsModule,
    SuppliersModule,
    ProductsModule,
    RolesModule,
    SettingsModule,
  ],
})
export class AppModule {}
