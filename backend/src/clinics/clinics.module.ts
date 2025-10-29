import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from 'src/auth/auth.module';
import { UserClinic } from '../users/entities/user-clinic.entity';
import { User } from '../users/entities/user.entity';
import { ClinicsController } from './clinics.controller';
import { Clinic } from './entities/clinic.entity';
import { ClinicsService } from './services/clinics.service';

@Module({
  imports: [TypeOrmModule.forFeature([Clinic, User, UserClinic]), AuthModule],
  controllers: [ClinicsController],
  providers: [ClinicsService],
  exports: [ClinicsService],
})
export class ClinicsModule {}
