import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CommonModule } from './common/common.module';
import { ClinicsModule } from './clinics/clinics.module';
import { PersonalInfo, ProfessionalInfo, User } from './users/entities';
import { Clinic } from './clinics/entities';

@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: +process.env.DB_PORT,
      database: process.env.DB_NAME,
      username: process.env.DB_USER,
      password: process.env.DB_PASS,
      autoLoadEntities: true,
      entities: [User, PersonalInfo, ProfessionalInfo, Clinic],
      synchronize: true,
    }),
    AuthModule,
    UsersModule,
    CommonModule,
    ClinicsModule,
  ],
})
export class AppModule {}
