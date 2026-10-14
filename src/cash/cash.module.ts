import { Module } from '@nestjs/common';
import { CashService } from './cash.service';
import {
  CashController,
  StoreCashRegistersController,
  CashRegistersDirectController,
  ReceiptSalesController,
} from './cash.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [PrismaModule, AuditModule, SettingsModule],
  controllers: [
    CashController,
    StoreCashRegistersController,
    CashRegistersDirectController,
    ReceiptSalesController,
  ],
  providers: [CashService],
  exports: [CashService],
})
export class CashModule {}
