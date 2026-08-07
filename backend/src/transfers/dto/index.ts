import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

// ─── Solicitar Traspaso (Clínica B → solicita a Clínica A) ───────────────────

export class CreateTransferItemDto {
  @IsUUID()
  sourceStockId: string;

  @IsInt()
  @Min(1)
  requestedQuantity: number;
}

export class CreateStockTransferDto {
  @IsUUID()
  sourceClinicId: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateTransferItemDto)
  items: CreateTransferItemDto[];
}

// ─── Despachar (Clínica A confirma envío) ────────────────────────────────────

export class DispatchItemDto {
  @IsUUID()
  itemId: string;

  @IsInt()
  @Min(1)
  dispatchedQuantity: number;
}

export class DispatchTransferDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => DispatchItemDto)
  items: DispatchItemDto[];
}

// ─── Confirmar Recepción (Clínica B confirma llegada) ────────────────────────

export class ReceiveItemDto {
  @IsUUID()
  itemId: string;

  @IsInt()
  @Min(0)
  receivedQuantity: number;
}

export class ConfirmReceiptDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReceiveItemDto)
  items: ReceiveItemDto[];
}

// ─── Rechazar / Devolver ──────────────────────────────────────────────────────

export class RejectTransferDto {
  @IsNotEmpty()
  @IsString()
  reason: string;
}

export class ReturnTransferDto {
  @IsNotEmpty()
  @IsString()
  reason: string;
}
