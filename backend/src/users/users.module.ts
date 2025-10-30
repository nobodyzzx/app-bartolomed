import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Clinic } from '../clinics/entities/clinic.entity';
import { PersonalInfo } from './entities/personal-info.entity';
import { ProfessionalInfo } from './entities/professional-info.entity';
import { User } from './entities/user.entity';
import { UsersService } from './services/users.service';
import { UsersController } from './users.controlLer';

@Module({
  imports: [TypeOrmModule.forFeature([User, PersonalInfo, ProfessionalInfo, Clinic]), AuthModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [TypeOrmModule, UsersService],
})
export class UsersModule {}
