import { PartialType, OmitType } from '@nestjs/mapped-types';
import { IsOptional, IsEnum } from 'class-validator';
import { CreateLabOrderDto } from './create-lab-order.dto';
import { LabOrderStatus } from '../entities/lab-order.entity';

export class UpdateLabOrderDto extends PartialType(OmitType(CreateLabOrderDto, ['items'] as const)) {
  @IsOptional()
  @IsEnum(LabOrderStatus)
  status?: LabOrderStatus;
}
