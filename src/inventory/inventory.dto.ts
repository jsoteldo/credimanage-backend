import {
  IsString,
  IsNumber,
  IsInt,
  IsOptional,
  IsEnum,
  Min,
  IsNotEmpty,
} from 'class-validator';
import { InventoryMovementType } from '@prisma/client';

export class AddInventoryDto {
  @IsString()
  @IsNotEmpty({ message: 'La ubicación es obligatoria' })
  locationId: string;

  @IsString()
  @IsNotEmpty({ message: 'El producto es obligatorio' })
  productId: string;

  @IsInt({ message: 'La cantidad de inventario debe ser un número entero.' })
  @Min(1, { message: 'La cantidad debe ser mayor a 0' })
  quantity: number;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class AdjustInventoryDto {
  @IsString()
  @IsNotEmpty({ message: 'La ubicación es obligatoria' })
  locationId: string;

  @IsString()
  @IsNotEmpty({ message: 'El producto es obligatorio' })
  productId: string;

  @IsInt({ message: 'La cantidad de inventario debe ser un número entero.' })
  adjustmentQuantity: number; // Can be positive or negative

  @IsString()
  @IsNotEmpty({ message: 'El motivo del ajuste es obligatorio' })
  reason: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class TransferInventoryDto {
  @IsString()
  @IsNotEmpty({ message: 'La ubicación de origen es obligatoria' })
  fromLocationId: string;

  @IsString()
  @IsNotEmpty({ message: 'La ubicación de destino es obligatoria' })
  toLocationId: string;

  @IsString()
  @IsNotEmpty({ message: 'El producto es obligatorio' })
  productId: string;

  @IsInt({ message: 'La cantidad de inventario debe ser un número entero.' })
  @Min(1, { message: 'La cantidad a transferir debe ser mayor a 0' })
  quantity: number;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class SetMinimumStockDto {
  @IsString()
  @IsNotEmpty({ message: 'La ubicación es obligatoria' })
  locationId: string;

  @IsString()
  @IsNotEmpty({ message: 'El producto es obligatorio' })
  productId: string;

  @IsInt({ message: 'La cantidad de inventario debe ser un número entero.' })
  @Min(0, { message: 'El stock mínimo no puede ser negativo' })
  minimumStock: number;
}

export class GetStockQueryDto {
  @IsString()
  @IsOptional()
  locationId?: string;

  @IsString()
  @IsOptional()
  departmentId?: string;

  @IsString()
  @IsOptional()
  q?: string;

  @IsString()
  @IsOptional()
  stockState?: 'all' | 'normal' | 'low' | 'out' | 'negative';
}

export class GetMovementsQueryDto {
  @IsString()
  @IsOptional()
  locationId?: string;

  @IsString()
  @IsOptional()
  productId?: string;

  @IsEnum(InventoryMovementType)
  @IsOptional()
  type?: InventoryMovementType;

  @IsString()
  @IsOptional()
  startDate?: string;

  @IsString()
  @IsOptional()
  endDate?: string;

  @IsOptional()
  page?: number | string;

  @IsOptional()
  limit?: number | string;
}
