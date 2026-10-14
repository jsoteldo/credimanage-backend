import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsInt,
  IsPositive,
  IsEnum,
  IsArray,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SaleStatus, SalePaymentMethod } from '@prisma/client';

export class SalePaymentDto {
  @IsEnum(SalePaymentMethod, {
    message: 'Método de pago inválido (CASH, YAPE, PLIN, CARD, TRANSFER, CREDIT)',
  })
  method: SalePaymentMethod;

  @IsNumber({}, { message: 'El importe del pago debe ser numérico' })
  @IsPositive({ message: 'El importe del pago debe ser mayor a 0' })
  amount: number;

  @IsOptional()
  @IsString()
  reference?: string;
}

export class SaleItemDto {
  @IsString({ message: 'El ID del producto es obligatorio' })
  @IsNotEmpty({ message: 'El ID del producto no puede estar vacío' })
  productId: string;

  @IsInt({ message: 'La cantidad de inventario debe ser un número entero.' })
  @IsPositive({ message: 'La cantidad de inventario debe ser un número entero.' })
  quantity: number;
}

export class CreateSaleDto {
  @IsString({ message: 'La tienda / ubicación es obligatoria' })
  @IsNotEmpty({ message: 'La tienda no puede estar vacía' })
  storeId: string;

  @IsOptional()
  @IsString()
  clientId?: string | null;

  @IsArray({ message: 'Los items de la venta deben ser una lista' })
  @ValidateNested({ each: true })
  @Type(() => SaleItemDto)
  items: SaleItemDto[];

  @IsArray({ message: 'Los pagos de la venta deben ser una lista' })
  @ValidateNested({ each: true })
  @Type(() => SalePaymentDto)
  payments: SalePaymentDto[];

  @IsOptional()
  @IsNumber({}, { message: 'El efectivo recibido debe ser numérico' })
  @Min(0, { message: 'El efectivo recibido no puede ser negativo' })
  cashReceived?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  cashSessionId?: string;
}

export class UpdateSaleDto extends CreateSaleDto {}

export class AnnulSaleDto {
  @IsString({ message: 'El motivo de anulación es obligatorio' })
  @IsNotEmpty({ message: 'Debe especificar el motivo de la anulación' })
  reason: string;
}

export class GetSalesQueryDto {
  @IsOptional()
  @IsString()
  storeId?: string;

  @IsOptional()
  @IsString()
  clientId?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  offset?: number;
}
