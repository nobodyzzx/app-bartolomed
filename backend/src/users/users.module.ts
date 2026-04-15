import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Clinic } from '../clinics/entities/clinic.entity';
import { PersonalInfo } from './entities/personal-info.entity';
import { ProfessionalInfo } from './entities/professional-info.entity';
import { UserClinic } from './entities/user-clinic.entity';
import { User } from './entities/user.entity';
import { UsersService } from './services/users.service';
import { UsersController } from './users.controller';

@Module({
  imports: [TypeOrmModule.forFeature([User, PersonalInfo, ProfessionalInfo, Clinic, UserClinic]), AuthModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [TypeOrmModule, UsersService],
})
export class UsersModule {}
