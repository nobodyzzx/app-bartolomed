import { PartialType } from '@nestjs/mapped-types';
import { IsOptional, IsEnum } from 'class-validator';
import { CreateConsentFormDto } from './create-consent-form.dto';
import { ConsentStatus } from '../entities/consent-form.entity';

export class UpdateConsentFormDto extends PartialType(CreateConsentFormDto) {
  @IsOptional()
  @IsEnum(ConsentStatus)
  status?: ConsentStatus;
}
