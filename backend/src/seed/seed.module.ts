import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Appointment } from '../appointments/entities/appointment.entity';
import { Clinic } from '../clinics/entities/clinic.entity';
import { MedicalRecord } from '../medical-records/entities/medical-record.entity';
import { Patient } from '../patients/entities/patient.entity';
import { Medication, MedicationStock } from '../pharmacy/entities/pharmacy.entity';
import { Prescription, PrescriptionItem } from '../prescriptions/entities/prescription.entity';
import { Role } from '../roles/entities/role.entity';
import { PersonalInfo } from '../users/entities/personal-info.entity';
import { ProfessionalInfo } from '../users/entities/professional-info.entity';
import { UserClinic } from '../users/entities/user-clinic.entity';
import { User } from '../users/entities/user.entity';
import { SeedController } from './seed.controller';
import { SeedService } from './seed.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Role,
      User,
      UserClinic,
      PersonalInfo,
      ProfessionalInfo,
      Clinic,
      Patient,
      Appointment,
      Prescription,
      PrescriptionItem,
      MedicalRecord,
      Medication,
      MedicationStock,
    ]),
  ],
  providers: [SeedService],
  controllers: [SeedController],
})
export class SeedModule {}
