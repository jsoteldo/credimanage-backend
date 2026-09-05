import { Module } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { BalanceSyncService } from './balance-sync.service';
import { TransactionsController } from './transactions.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  providers: [TransactionsService, BalanceSyncService],
  controllers: [TransactionsController],
  exports: [TransactionsService, BalanceSyncService],
})
export class TransactionsModule {}
