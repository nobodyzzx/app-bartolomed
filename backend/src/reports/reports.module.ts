import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Appointment } from '../appointments/entities/appointment.entity';
import { MedicalRecord } from '../medical-records/entities/medical-record.entity';
import { Patient } from '../patients/entities/patient.entity';
import { PharmacySale, PharmacySaleItem } from '../pharmacy/entities/pharmacy-sale.entity';
import { MedicationStock } from '../pharmacy/entities/pharmacy.entity';
import { Prescription, PrescriptionItem } from '../prescriptions/entities/prescription.entity';
import { Invoice, Payment } from '../billing/entities/billing.entity';
import { StockTransfer } from '../transfers/entities/stock-transfer.entity';
import { ReportsController } from './reports.controller';
import { AdvancedReportsService } from './services/advanced-reports.service';
import { ExportService } from './services/export.service';
import { ReportsPdfService } from './services/reports-pdf.service';
import { ReportsService } from './services/reports.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Patient,
      Appointment,
      MedicalRecord,
      Prescription,
      PrescriptionItem,
      Invoice,
      Payment,
      MedicationStock,
      PharmacySale,
      PharmacySaleItem,
      StockTransfer,
    ]),
    AuthModule,
  ],
  controllers: [ReportsController],
  providers: [ReportsService, AdvancedReportsService, ExportService, ReportsPdfService],
  exports: [ReportsService, AdvancedReportsService],
})
export class ReportsModule {}
