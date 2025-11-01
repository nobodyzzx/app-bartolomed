import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Clinic } from '../clinics/entities/clinic.entity';
import { Patient } from '../patients/entities/patient.entity';
import { User } from '../users/entities/user.entity';
import { Prescription, PrescriptionItem } from './entities/prescription.entity';
import { PrescriptionsController } from './prescriptions.controller';
import { PrescriptionsService } from './prescriptions.service';

@Module({
  imports: [TypeOrmModule.forFeature([Prescription, PrescriptionItem, Patient, User, Clinic])],
  providers: [PrescriptionsService],
  controllers: [PrescriptionsController],
})
export class PrescriptionsModule {}
