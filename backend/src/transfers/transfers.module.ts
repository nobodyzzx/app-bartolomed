import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Clinic } from '../clinics/entities/clinic.entity';
import { MedicationStock } from '../pharmacy/entities/pharmacy.entity';
import { StockTransfersController } from './controllers/stock-transfers.controller';
import {
  StockTransfer,
  StockTransferItem,
  TransferAuditLog,
} from './entities/stock-transfer.entity';
import { StockTransfersService } from './services/stock-transfers.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      StockTransfer,
      StockTransferItem,
      TransferAuditLog,
      MedicationStock,
      Clinic,
    ]),
  ],
  controllers: [StockTransfersController],
  providers: [StockTransfersService],
  exports: [StockTransfersService],
})
export class TransfersModule {}
