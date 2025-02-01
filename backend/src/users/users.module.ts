import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './users.controlLer';
import { UsersService } from './services/users.service';
import { User } from './entities/user.entity';
import { PersonalInfo } from './entities/personal-info.entity';
import { ProfessionalInfo } from './entities/professional-info.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([User, PersonalInfo, ProfessionalInfo]), AuthModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [TypeOrmModule, UsersService],
})
export class UsersModule {}
