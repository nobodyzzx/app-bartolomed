import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { ServicePricesModule } from '../service-prices/service-prices.module';
import { ChargesController } from './charges.controller';
import { ChargesService } from './charges.service';
import { Charge } from './entities/charge.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Charge]), AuthModule, ServicePricesModule],
  controllers: [ChargesController],
  providers: [ChargesService],
  // Lo consumen appointments y lab-orders para generar sus cargos.
  exports: [TypeOrmModule, ChargesService],
})
export class ChargesModule {}
