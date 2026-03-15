import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { AssetsController } from './assets.controller';
import { AssetsService } from './assets.service';
import { AssetInventory } from './entities/asset-inventory.entity';
import { AssetMaintenance } from './entities/asset-maintenance.entity';
import { AssetReport } from './entities/asset-report.entity';
import { Asset, MaintenanceRecord } from './entities/asset.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Asset, MaintenanceRecord, AssetMaintenance, AssetInventory, AssetReport]),
    AuthModule,
  ],
  controllers: [AssetsController],
  providers: [AssetsService],
  exports: [TypeOrmModule, AssetsService],
})
export class AssetsModule {}
