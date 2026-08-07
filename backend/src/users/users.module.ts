import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Clinic } from '../clinics/entities/clinic.entity';
import { Appointment } from '../appointments/entities/appointment.entity';
import { Prescription } from '../prescriptions/entities/prescription.entity';
import { LabOrder } from '../lab-orders/entities/lab-order.entity';
import { PersonalInfo } from './entities/personal-info.entity';
import { ProfessionalInfo } from './entities/professional-info.entity';
import { UserClinic } from './entities/user-clinic.entity';
import { User } from './entities/user.entity';
import { UsersService } from './services/users.service';
import { UsersController } from './users.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      PersonalInfo,
      ProfessionalInfo,
      Clinic,
      UserClinic,
      Appointment,
      Prescription,
      LabOrder,
    ]),
    AuthModule,
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [TypeOrmModule, UsersService],
})
export class UsersModule {}
