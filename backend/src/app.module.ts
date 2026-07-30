import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { validateEnvironment } from './config/env-validation';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { AuditModule } from './audit/audit.module';
import { AuditLog } from './audit/entities/audit-log.entity';
import { MailModule } from './mail/mail.module';
import { SmtpConfig } from './mail/entities/smtp-config.entity';
import { AppointmentsModule } from './appointments/appointments.module';
import { Appointment } from './appointments/entities/appointment.entity';
import { AssetsModule } from './assets/assets.module';
import { AssetInventory } from './assets/entities/asset-inventory.entity';
import { AssetMaintenance } from './assets/entities/asset-maintenance.entity';
import { AssetReport } from './assets/entities/asset-report.entity';
import {
  AssetTransfer,
  AssetTransferAuditLog,
  AssetTransferItem,
} from './assets/entities/asset-transfer.entity';
import { Asset } from './assets/entities/asset.entity';
import { AuthModule } from './auth/auth.module';
import { BillingModule } from './billing/billing.module';
import { Invoice, InvoiceItem, Payment } from './billing/entities/billing.entity';
import { ClinicsModule } from './clinics/clinics.module';
import { Clinic } from './clinics/entities';
import { CommonModule } from './common/common.module';
import { HealthModule } from './health/health.module';
import { MetricsModule } from './metrics/metrics.module';
import { ConsentForm, MedicalRecord, MedicalReport } from './medical-records/entities';
import { MedicalRecordsModule } from './medical-records/medical-records.module';
import { Patient } from './patients/entities';
import { PatientsModule } from './patients/patients.module';
import { PharmacyInvoice } from './pharmacy/entities/pharmacy-invoice.entity';
import { PharmacySale, PharmacySaleItem } from './pharmacy/entities/pharmacy-sale.entity';
import { Medication, MedicationStock, StockMovement } from './pharmacy/entities/pharmacy.entity';
import { PurchaseOrder, PurchaseOrderItem } from './pharmacy/entities/purchase-order.entity';
import { Supplier } from './pharmacy/entities/supplier.entity';
import { PharmacyModule } from './pharmacy/pharmacy.module';
import { Prescription, PrescriptionItem } from './prescriptions/entities/prescription.entity';
import { PrescriptionsModule } from './prescriptions/prescriptions.module';
import { ReportsModule } from './reports/reports.module';
import { Role } from './roles/entities/role.entity';
import { RolesModule } from './roles/roles.module';
import { SeedModule } from './seed/seed.module';
import {
  StockTransfer,
  StockTransferItem,
  TransferAuditLog,
} from './transfers/entities/stock-transfer.entity';
import { TransfersModule } from './transfers/transfers.module';
import { PersonalInfo, ProfessionalInfo, User } from './users/entities';
import { UserClinic } from './users/entities/user-clinic.entity';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnvironment,
    }),
    // Rate limiting global por IP. Los endpoints sensibles (login, forgot,
    // reset) endurecen el límite con @Throttle() en sus controllers.
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 60 }]),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: +(process.env.DB_PORT ?? '5432'),
      database: process.env.DB_NAME,
      username: process.env.DB_USER,
      password: process.env.DB_PASS,
      autoLoadEntities: true,
      entities: [
        User,
        PersonalInfo,
        ProfessionalInfo,
        UserClinic,
        Clinic,
        Patient,
        Appointment,
        MedicalRecord,
        ConsentForm,
        MedicalReport,
        Prescription,
        PrescriptionItem,
        Invoice,
        InvoiceItem,
        Payment,
        Asset,
        AssetMaintenance,
        AssetInventory,
        AssetReport,
        AssetTransfer,
        AssetTransferItem,
        AssetTransferAuditLog,
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
        StockTransfer,
        StockTransferItem,
        TransferAuditLog,
        AuditLog,
        SmtpConfig,
      ],
      synchronize: false,
      migrations: ['dist/migrations/*.js'],
      // Pool explícito en vez de dejar los defaults implícitos de `pg` (max:10,
      // connectionTimeoutMillis:0 -- sin timeout, un pool agotado cuelga requests
      // indefinidamente en vez de fallar rápido). Ajustar via env var tras medir
      // bajo carga real, no a ciegas.
      extra: {
        max: +(process.env.DB_POOL_MAX ?? '10'),
        connectionTimeoutMillis: +(process.env.DB_POOL_CONNECTION_TIMEOUT_MS ?? '5000'),
        idleTimeoutMillis: +(process.env.DB_POOL_IDLE_TIMEOUT_MS ?? '10000'),
      },
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
    PrescriptionsModule,
    BillingModule,
    RolesModule,
    SeedModule,
    AssetsModule,
    TransfersModule,
    AuditModule,
    MailModule,
    MetricsModule,
  ],
  providers: [
    // Aplica ThrottlerGuard a todos los endpoints (rate limit por IP).
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // JwtAuthGuard global: ningún endpoint queda desprotegido por omisión.
    // Los que deben ser públicos (login, health, metrics, etc.) llevan @Public() explícito.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
