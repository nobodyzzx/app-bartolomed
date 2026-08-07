import { Body, Controller, Get, Post, Put } from '@nestjs/common';
import { Auth } from '../auth/decorators';
import { ValidRoles } from '../users/interfaces';
import { UpdateSmtpConfigDto } from './dto/smtp-config.dto';
import { MailService } from './mail.service';

@Controller('smtp-config')
export class SmtpConfigController {
  constructor(private readonly mailService: MailService) {}

  @Get()
  @Auth(ValidRoles.ADMIN, ValidRoles.SUPER_ADMIN)
  getConfig() {
    return this.mailService.getConfig();
  }

  @Put()
  @Auth(ValidRoles.ADMIN, ValidRoles.SUPER_ADMIN)
  saveConfig(@Body() dto: UpdateSmtpConfigDto) {
    return this.mailService.saveConfig(dto);
  }

  @Post('test')
  @Auth(ValidRoles.ADMIN, ValidRoles.SUPER_ADMIN)
  testConnection() {
    return this.mailService.testConnection();
  }
}
