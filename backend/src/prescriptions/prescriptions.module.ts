import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Clinic } from '../clinics/entities/clinic.entity';
import { Patient } from '../patients/entities/patient.entity';
import { User } from '../users/entities/user.entity';
import { PatientsModule } from '../patients/patients.module';
import { Prescription, PrescriptionItem } from './entities/prescription.entity';
import { PrescriptionsController } from './prescriptions.controller';
import { PrescriptionsService } from './prescriptions.service';
import { PrescriptionsPdfService } from './prescriptions-pdf.service';

@Module({
  imports: [TypeOrmModule.forFeature([Prescription, PrescriptionItem, Patient, User, Clinic]), PatientsModule],
  providers: [PrescriptionsService, PrescriptionsPdfService],
  controllers: [PrescriptionsController],
})
export class PrescriptionsModule {}
