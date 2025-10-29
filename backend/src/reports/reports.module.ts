import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportsService } from './services/reports.service';
import { ReportsController } from './reports.controller';
import { AuthModule } from '../auth/auth.module';
import { Patient } from '../patients/entities/patient.entity';
import { Appointment } from '../appointments/entities/appointment.entity';
import { MedicalRecord } from '../medical-records/entities/medical-record.entity';
import { Prescription } from '../prescriptions/entities/prescription.entity';
import { Invoice } from '../billing/entities/billing.entity';

@Module({
  controllers: [ReportsController],
  providers: [ReportsService],
  imports: [TypeOrmModule.forFeature([Patient, Appointment, MedicalRecord, Prescription, Invoice]), AuthModule],
  exports: [ReportsService],
})
export class ReportsModule {}
