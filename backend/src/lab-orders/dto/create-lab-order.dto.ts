import {
  IsOptional,
  IsString,
  IsUUID,
  IsDateString,
  IsBoolean,
  IsArray,
  IsEnum,
  ValidateNested,
  ArrayMinSize,
  ValidateIf,
  Length,
} from 'class-validator';
import { Type } from 'class-transformer';
import { LabTestCategory } from '../entities/lab-order.entity';

export class CreateLabOrderItemDto {
  @IsString()
  testName: string;

  @IsEnum(LabTestCategory)
  category: LabTestCategory;

  @IsOptional()
  @IsString()
  specimenType?: string;

  /**
   * Servicio del tarifario que fija el precio del examen. Si no se envía, se
   * intenta resolver por nombre contra el catálogo; si tampoco hay match, el
   * examen queda sin precio y no genera cargo.
   */
  @IsOptional()
  @IsUUID()
  servicePriceId?: string;
}

export class CreateLabOrderDto {
  @IsString()
  orderNumber: string;

  @IsDateString()
  orderDate: string;

  @IsOptional()
  @IsString()
  clinicalNotes?: string;

  @IsOptional()
  @IsBoolean()
  isUrgent?: boolean;

  @IsArray()
  @ArrayMinSize(1, { message: 'La orden debe tener al menos un estudio' })
  @ValidateNested({ each: true })
  @Type(() => CreateLabOrderItemDto)
  items: CreateLabOrderItemDto[];

  /**
   * Opcional desde la Fase 2 de facturación: el laboratorio atiende pacientes
   * derivados de otro consultorio, sin ficha en esta clínica. Debe venir
   * `patientId` **o** `patientName`.
   */
  @IsOptional()
  @IsUUID()
  patientId?: string;

  @ValidateIf(o => !o.patientId)
  @IsString({ message: 'Indique un paciente registrado o el nombre del paciente derivado' })
  @Length(3, 120)
  patientName?: string;

  @IsUUID()
  doctorId: string;

  @IsUUID()
  clinicId: string;

  @IsOptional()
  @IsUUID()
  medicalRecordId?: string;
}
