import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { ClinicsModule } from '../clinics/clinics.module';
import { Clinic } from '../clinics/entities/clinic.entity';
import { ActivePatientPipe } from './pipes/active-patient.pipe';
import { Patient } from './entities/patient.entity';
import { PatientsController } from './patients.controller';
import { PatientsService } from './services/patients.service';

@Module({
  controllers: [PatientsController],
  providers: [PatientsService, ActivePatientPipe],
  imports: [TypeOrmModule.forFeature([Patient, Clinic]), AuthModule, ClinicsModule, AuditModule],
  exports: [TypeOrmModule, PatientsService, ActivePatientPipe],
})
export class PatientsModule {}
