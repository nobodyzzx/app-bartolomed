import { forwardRef, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Clinic } from '../clinics/entities/clinic.entity';
import { MailModule } from '../mail/mail.module';
import { UserClinic } from '../users/entities/user-clinic.entity';
import { User } from '../users/entities/user.entity';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ClinicScopeGuard } from './guards/clinic-scope.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtAuthGuard, ClinicScopeGuard],
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([User, UserClinic, Clinic]),
    forwardRef(() => MailModule),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        return {
          secret: configService.get('JWT_SECRET'),
          signOptions: {
            expiresIn: '2h',
          },
        };
      },
    }),
    // JwtModule.register({
    //   secret: process.env.JWT_SECRET,
    //   signOptions: {
    //     expiresIn: '2h'}
    // }),
  ],

  exports: [TypeOrmModule, JwtStrategy, PassportModule, JwtModule, JwtAuthGuard, ClinicScopeGuard],
})
export class AuthModule {}
