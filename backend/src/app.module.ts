import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppointmentsModule } from './appointments/appointments.module';
import { Appointment } from './appointments/entities/appointment.entity';
import { Asset, MaintenanceRecord } from './assets/entities/asset.entity';
import { AuthModule } from './auth/auth.module';
import { Invoice, InvoiceItem, Payment } from './billing/entities/billing.entity';
import { ClinicsModule } from './clinics/clinics.module';
import { Clinic } from './clinics/entities';
import { CommonModule } from './common/common.module';
import { HealthModule } from './health/health.module';
import { ConsentForm, MedicalRecord } from './medical-records/entities';
import { MedicalRecordsModule } from './medical-records/medical-records.module';
import { Patient } from './patients/entities';
import { PatientsModule } from './patients/patients.module';
import { PharmacyInvoice } from './pharmacy/entities/pharmacy-invoice.entity';
import { PharmacySale, PharmacySaleItem } from './pharmacy/entities/pharmacy-sale.entity';
import { Medication, MedicationStock, StockMovement } from './pharmacy/entities/pharmacy.entity';
import { PurchaseOrder, PurchaseOrderItem, Supplier } from './pharmacy/entities/purchase-order.entity';
import { PharmacyModule } from './pharmacy/pharmacy.module';
import { Prescription, PrescriptionItem } from './prescriptions/entities/prescription.entity';
import { ReportsModule } from './reports/reports.module';
import { Role } from './roles/entities/role.entity';
import { RolesModule } from './roles/roles.module';
import { SeedModule } from './seed/seed.module';
import { PersonalInfo, ProfessionalInfo, User } from './users/entities';
import { UsersModule } from './users/users.module';

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
        ConsentForm,
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
        PharmacySale,
        PharmacySaleItem,
        PharmacyInvoice,
        Role,
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
    MedicalRecordsModule,
    ReportsModule,
    PharmacyModule,
    RolesModule,
    SeedModule,
  ],
})
export class AppModule {}
