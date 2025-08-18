import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppointmentsService } from './services/appointments.service';
import { AppointmentsController } from './appointments.controller';
import { Appointment } from './entities/appointment.entity';
import { AuthModule } from '../auth/auth.module';
import { PatientsModule } from '../patients/patients.module';
import { UsersModule } from '../users/users.module';
import { ClinicsModule } from '../clinics/clinics.module';

@Module({
  controllers: [AppointmentsController],
  providers: [AppointmentsService],
  imports: [
    TypeOrmModule.forFeature([Appointment]),
    AuthModule,
    PatientsModule,
    UsersModule,
    ClinicsModule,
  ],
  exports: [TypeOrmModule, AppointmentsService],
})
export class AppointmentsModule {}
