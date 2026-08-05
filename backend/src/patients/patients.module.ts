import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { ClinicsModule } from '../clinics/clinics.module';
import { Clinic } from '../clinics/entities/clinic.entity';
import { Appointment } from '../appointments/entities/appointment.entity';
import { Prescription } from '../prescriptions/entities/prescription.entity';
import { Invoice } from '../billing/entities/billing.entity';
import { LabOrder } from '../lab-orders/entities/lab-order.entity';
import { ActivePatientPipe } from './pipes/active-patient.pipe';
import { OptionalActivePatientPipe } from './pipes/optional-active-patient.pipe';
import { Patient } from './entities/patient.entity';
import { PatientsController } from './patients.controller';
import { PatientsService } from './services/patients.service';

@Module({
  controllers: [PatientsController],
  providers: [PatientsService, ActivePatientPipe, OptionalActivePatientPipe],
  imports: [
    TypeOrmModule.forFeature([Patient, Clinic, Appointment, Prescription, Invoice, LabOrder]),
    AuthModule,
    ClinicsModule,
    AuditModule,
  ],
  exports: [TypeOrmModule, PatientsService, ActivePatientPipe, OptionalActivePatientPipe],
})
export class PatientsModule {}
