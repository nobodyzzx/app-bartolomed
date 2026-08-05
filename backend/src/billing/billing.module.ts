import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Appointment } from '../appointments/entities/appointment.entity';
import { AuthModule } from '../auth/auth.module';
import { Clinic } from '../clinics/entities/clinic.entity';
import { Patient } from '../patients/entities/patient.entity';
import { User } from '../users/entities/user.entity';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { AuditModule } from '../audit/audit.module';
import { Charge } from '../charges/entities/charge.entity';
import { PdfModule } from '../pdf/pdf.module';
import { Invoice, InvoiceItem, Payment } from './entities/billing.entity';
import { CheckoutService } from './services/checkout.service';
import { ReceiptPdfService } from './services/receipt-pdf.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Invoice, InvoiceItem, Payment, Patient, Clinic, Appointment, User, Charge]),
    AuthModule,
    AuditModule,
    PdfModule,
  ],
  controllers: [BillingController],
  providers: [BillingService, CheckoutService, ReceiptPdfService],
  exports: [TypeOrmModule, BillingService, CheckoutService],
})
export class BillingModule {}
