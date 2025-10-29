import { PartialType } from '@nestjs/mapped-types';
import { CreateMedicalRecordDto } from './create-medical-record.dto';
import { IsOptional, IsEnum } from 'class-validator';
import { RecordStatus } from '../entities/medical-record.entity';

export class UpdateMedicalRecordDto extends PartialType(CreateMedicalRecordDto) {
  @IsOptional()
  @IsEnum(RecordStatus)
  status?: RecordStatus;
}
