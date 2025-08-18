import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PatientsService } from './services/patients.service';
import { PatientsController } from './patients.controller';
import { Patient } from './entities/patient.entity';
import { AuthModule } from '../auth/auth.module';
import { ClinicsModule } from '../clinics/clinics.module';

@Module({
  controllers: [PatientsController],
  providers: [PatientsService],
  imports: [
    TypeOrmModule.forFeature([Patient]),
    AuthModule,
    ClinicsModule,
  ],
  exports: [TypeOrmModule, PatientsService],
})
export class PatientsModule {}
