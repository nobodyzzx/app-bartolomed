import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Clinic } from '../clinics/entities/clinic.entity';
import { PdfModule } from '../pdf/pdf.module';
import { AssetsController } from './assets.controller';
import { AssetsService } from './assets.service';
import { AssetTransfersController } from './controllers/asset-transfers.controller';
import { AssetMaintenance } from './entities/asset-maintenance.entity';
import { AssetReport } from './entities/asset-report.entity';
import {
  AssetTransfer,
  AssetTransferAuditLog,
  AssetTransferItem,
} from './entities/asset-transfer.entity';
import { Asset } from './entities/asset.entity';
import { AssetReportExportService } from './services/asset-report-export.service';
import { AssetTransfersService } from './services/asset-transfers.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Asset,
      AssetMaintenance,
      AssetReport,
      AssetTransfer,
      AssetTransferItem,
      AssetTransferAuditLog,
      Clinic,
    ]),
    AuthModule,
    PdfModule,
  ],
  controllers: [AssetsController, AssetTransfersController],
  providers: [AssetsService, AssetTransfersService, AssetReportExportService],
  exports: [TypeOrmModule, AssetsService, AssetTransfersService],
})
export class AssetsModule {}
