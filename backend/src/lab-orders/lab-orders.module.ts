import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { Clinic } from '../clinics/entities/clinic.entity';
import { Patient } from '../patients/entities/patient.entity';
import { User } from '../users/entities/user.entity';
import { PatientsModule } from '../patients/patients.module';
import { LabOrder, LabOrderItem } from './entities/lab-order.entity';
import { LabOrdersController } from './lab-orders.controller';
import { LabOrdersService } from './lab-orders.service';

@Module({
  imports: [TypeOrmModule.forFeature([LabOrder, LabOrderItem, Patient, User, Clinic]), PatientsModule, AuditModule],
  providers: [LabOrdersService],
  controllers: [LabOrdersController],
})
export class LabOrdersModule {}
