import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CommonModule } from './common/common.module';
import { ClinicsModule } from './clinics/clinics.module';
import { HealthModule } from './health/health.module';
import { PatientsModule } from './patients/patients.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { ReportsModule } from './reports/reports.module';
import { PersonalInfo, ProfessionalInfo, User } from './users/entities';
import { Clinic } from './clinics/entities';
import { Patient } from './patients/entities';
import { Appointment } from './appointments/entities/appointment.entity';
import { MedicalRecord } from './medical-records/entities/medical-record.entity';
import { Prescription, PrescriptionItem } from './prescriptions/entities/prescription.entity';
import { Invoice, InvoiceItem, Payment } from './billing/entities/billing.entity';
import { Asset, MaintenanceRecord } from './assets/entities/asset.entity';
import {
  Medication,
  MedicationStock,
  StockMovement,
  Supplier,
  PurchaseOrder,
  PurchaseOrderItem,
} from './pharmacy/entities/pharmacy.entity';

@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: +process.env.DB_PORT,
      database: process.env.DB_NAME,
      username: process.env.DB_USER,
      password: process.env.DB_PASS,
      autoLoadEntities: true,
      entities: [
        User,
        PersonalInfo,
        ProfessionalInfo,
        Clinic,
        Patient,
        Appointment,
        MedicalRecord,
        Prescription,
        PrescriptionItem,
        Invoice,
        InvoiceItem,
        Payment,
        Asset,
        MaintenanceRecord,
        Medication,
        MedicationStock,
        StockMovement,
        Supplier,
        PurchaseOrder,
        PurchaseOrderItem,
      ],
      synchronize: true,
    }),
    AuthModule,
    UsersModule,
    CommonModule,
    ClinicsModule,
    HealthModule,
    PatientsModule,
    AppointmentsModule,
    ReportsModule,
  ],
})
export class AppModule {}
