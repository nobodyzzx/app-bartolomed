import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseUUIDPipe,
  Query,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import { UsersService } from './services/users.service';
import { CreateUserDto } from './dto';
import { Auth, AuthClinic } from '../auth/decorators';
import { resolveClinicId } from '../auth/decorators/clinic-roles.decorator';
import { RequirePermissions } from '../auth/permissions/permissions.decorator';
import { Permission } from '../auth/permissions/permissions.enum';
import { PaginationDto } from '../common/dtos/pagination.dto';
import { ValidRoles } from '../auth/interfaces';

@Controller('users')
@RequirePermissions(Permission.UsersManage)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('create')
  @Auth(ValidRoles.ADMIN)
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get()
  @Auth(ValidRoles.ADMIN)
  findAll(@Query() paginationDto: PaginationDto) {
    return this.usersService.findAll(paginationDto);
  }

  @Get('statistics')
  @AuthClinic({ roles: [ValidRoles.ADMIN] })
  getStatistics(@Req() req: Request) {
    return this.usersService.getClinicStatistics(resolveClinicId(req)!);
  }

  @Get(':id')
  @Auth(ValidRoles.ADMIN)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id/status')
  @Auth(ValidRoles.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  updateStatus(@Param('id', ParseUUIDPipe) id: string, @Body('isActive') isActive: boolean) {
    return this.usersService.updateStatus(id, isActive);
  }

  @Patch(':id')
  @Auth(ValidRoles.ADMIN)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() updateUserDto: Partial<CreateUserDto>) {
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  @Auth(ValidRoles.ADMIN)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.remove(id);
  }
}
