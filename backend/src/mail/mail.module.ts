import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { SmtpConfig } from './entities/smtp-config.entity';
import { MailService } from './mail.service';
import { SmtpConfigController } from './smtp-config.controller';

@Module({
  imports: [TypeOrmModule.forFeature([SmtpConfig]), forwardRef(() => AuthModule)],
  controllers: [SmtpConfigController],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
