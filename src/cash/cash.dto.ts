import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsEnum,
  Min,
  IsBoolean,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  CashRegisterStatus,
  CashSessionStatus,
  CashMovementType,
  SalePaymentMethod,
} from '@prisma/client';

export class CreateCashRegisterDto {
  @IsString()
  @IsNotEmpty()
  storeId: string;

  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsEnum(CashRegisterStatus)
  status?: CashRegisterStatus;
}

export class UpdateCashRegisterDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  code?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsEnum(CashRegisterStatus)
  status?: CashRegisterStatus;
}

export class OpenCashSessionDto {
  @IsString()
  @IsNotEmpty()
  cashRegisterId: string;

  @IsString()
  @IsNotEmpty()
  storeId: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0, { message: 'El fondo inicial no puede ser negativo' })
  openingCashAmount: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CloseCashSessionDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0, { message: 'El monto contado no puede ser negativo' })
  countedCashAmount: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateCashMovementDto {
  @IsIn(['CASH_IN', 'CASH_OUT'], {
    message: 'El tipo de movimiento manual debe ser CASH_IN o CASH_OUT',
  })
  type: 'CASH_IN' | 'CASH_OUT';

  @Type(() => Number)
  @IsNumber()
  @Min(0.01, { message: 'El monto debe ser mayor a 0' })
  amount: number;

  @IsString()
  @IsNotEmpty({ message: 'El motivo es obligatorio' })
  reason: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ReceiptConfigDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre comercial es obligatorio' })
  businessName: string;

  @IsOptional()
  @IsString()
  secondaryText?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  footerMessage?: string;

  @IsOptional()
  @IsIn(['58mm', '80mm', 'a4'])
  paperWidth?: '58mm' | '80mm' | 'a4';

  @IsOptional()
  @IsBoolean()
  showLogo?: boolean;

  @IsOptional()
  @IsBoolean()
  showProductCode?: boolean;

  @IsOptional()
  @IsBoolean()
  showCustomer?: boolean;

  @IsOptional()
  @IsBoolean()
  showCashier?: boolean;

  @IsOptional()
  @IsBoolean()
  showStore?: boolean;

  @IsOptional()
  @IsBoolean()
  showPaymentMethods?: boolean;

  @IsOptional()
  @IsString()
  series?: string;
}

export class GetCashSessionsQueryDto {
  @IsOptional()
  @IsString()
  storeId?: string;

  @IsOptional()
  @IsString()
  cashRegisterId?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsEnum(CashSessionStatus)
  status?: CashSessionStatus;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number;
}

export class GetCashMovementsQueryDto {
  @IsOptional()
  @IsString()
  cashSessionId?: string;

  @IsOptional()
  @IsString()
  storeId?: string;

  @IsOptional()
  @IsEnum(CashMovementType)
  type?: CashMovementType;

  @IsOptional()
  @IsEnum(SalePaymentMethod)
  paymentMethod?: SalePaymentMethod;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number;
}
