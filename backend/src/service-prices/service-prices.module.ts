import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { ServicePrice } from './entities/service-price.entity';
import { ServicePricesController } from './service-prices.controller';
import { ServicePricesService } from './service-prices.service';

@Module({
  imports: [TypeOrmModule.forFeature([ServicePrice]), AuthModule, AuditModule],
  controllers: [ServicePricesController],
  providers: [ServicePricesService],
  // Se exporta para que la Fase 2 (cargos) pueda resolver la tarifa de una
  // cita o de un examen sin duplicar la consulta al catálogo.
  exports: [TypeOrmModule, ServicePricesService],
})
export class ServicePricesModule {}
