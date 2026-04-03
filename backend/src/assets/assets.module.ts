import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Clinic } from '../clinics/entities/clinic.entity';
import { AssetsController } from './assets.controller';
import { AssetsService } from './assets.service';
import { AssetTransfersController } from './controllers/asset-transfers.controller';
import { AssetInventory } from './entities/asset-inventory.entity';
import { AssetMaintenance } from './entities/asset-maintenance.entity';
import { AssetReport } from './entities/asset-report.entity';
import {
  AssetTransfer,
  AssetTransferAuditLog,
  AssetTransferItem,
} from './entities/asset-transfer.entity';
import { Asset } from './entities/asset.entity';
import { AssetTransfersService } from './services/asset-transfers.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Asset,
      AssetMaintenance,
      AssetInventory,
      AssetReport,
      AssetTransfer,
      AssetTransferItem,
      AssetTransferAuditLog,
      Clinic,
    ]),
    AuthModule,
  ],
  controllers: [AssetsController, AssetTransfersController],
  providers: [AssetsService, AssetTransfersService],
  exports: [TypeOrmModule, AssetsService, AssetTransfersService],
})
export class AssetsModule {}
