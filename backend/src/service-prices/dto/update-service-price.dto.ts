import { PartialType } from '@nestjs/swagger';
import { CreateServicePriceDto } from './create-service-price.dto';

export class UpdateServicePriceDto extends PartialType(CreateServicePriceDto) {}
