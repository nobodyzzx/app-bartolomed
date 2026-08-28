import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { PdfModule } from '../pdf/pdf.module';
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
import { LabReportsService } from './services/lab-reports.service';
import { ReportsPdfService } from './services/reports-pdf.service';
import { ReportsService } from './services/reports.service';
import { RevenueReportsService } from './services/revenue-reports.service';
import { AuditLog } from '../audit/entities/audit-log.entity';
import { Charge } from '../charges/entities/charge.entity';

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
      Charge,
      AuditLog,
      PharmacySaleItem,
      StockTransfer,
    ]),
    AuthModule,
    PdfModule,
  ],
  controllers: [ReportsController],
  providers: [
    RevenueReportsService,
    ReportsService,
    AdvancedReportsService,
    LabReportsService,
    ExportService,
    ReportsPdfService,
  ],
  exports: [ReportsService, AdvancedReportsService],
})
export class ReportsModule {}
