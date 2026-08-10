import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Clinic } from '../clinics/entities/clinic.entity';
import { UserClinic } from '../users/entities/user-clinic.entity';
import { PdfModule } from '../pdf/pdf.module';
import { AssetsController } from './assets.controller';
import { AssetsService } from './assets.service';
import { AssetTransfersController } from './controllers/asset-transfers.controller';
import { AssetTransfer, AssetTransferAuditLog, AssetTransferItem } from './entities/asset-transfer.entity';
import { AssetMovement } from './entities/asset-movement.entity';
import { Asset } from './entities/asset.entity';
import { InventoryCount, InventoryCountItem } from './entities/inventory-count.entity';
import { AssetMovementsService } from './services/asset-movements.service';
import { AssetPrintReportsService } from './services/asset-print-reports.service';
import { InventoryCountsService } from './services/inventory-counts.service';
import { AssetTransfersService } from './services/asset-transfers.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Asset,
      AssetTransfer,
      AssetTransferItem,
      AssetTransferAuditLog,
      Clinic,
      AssetMovement,
      InventoryCount,
      InventoryCountItem,
      // Solo de lectura: valida que el destino de un movimiento sea una clínica
      // de la que el usuario es miembro.
      UserClinic,
    ]),
    AuthModule,
    PdfModule,
  ],
  controllers: [AssetsController, AssetTransfersController],
  providers: [
    AssetsService,
    AssetTransfersService,
    AssetPrintReportsService,
    AssetMovementsService,
    InventoryCountsService,
  ],
  exports: [TypeOrmModule, AssetsService, AssetTransfersService],
})
export class AssetsModule {}
