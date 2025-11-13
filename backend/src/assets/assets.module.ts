import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { AssetsController } from './assets.controller';
import { AssetsService } from './assets.service';
import { Asset, MaintenanceRecord } from './entities/asset.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Asset, MaintenanceRecord]), AuthModule],
  controllers: [AssetsController],
  providers: [AssetsService],
  exports: [TypeOrmModule, AssetsService],
})
export class AssetsModule {}
