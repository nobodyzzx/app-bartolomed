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
import { CreateUserDto, UpdateUserDto } from './dto';
import { AuthClinic, GetUser } from '../auth/decorators';
import { resolveClinicId } from '../auth/decorators/clinic-roles.decorator';
import { RequirePermissions } from '../auth/permissions/permissions.decorator';
import { Permission } from '../auth/permissions/permissions.enum';
import { PaginationDto } from '../common/dtos/pagination.dto';
import { ValidRoles } from '../auth/interfaces';
import { User } from './entities/user.entity';

// Bug real: antes solo @Auth(ADMIN) sin AuthClinic — ningún endpoint salvo
// getStatistics validaba pertenencia a clínica (ClinicScopeGuard), así que un
// ADMIN de cualquier clínica podía listar/ver/editar/eliminar usuarios de
// TODAS las demás. @AuthClinic a nivel de clase monta ClinicScopeGuard para
// todo el controller — SUPER_ADMIN sigue funcionando porque ya está
// auto-vinculado a todas las clínicas (ver clinics.service.ts). El scoping
// fino (ADMIN ve solo su clínica, SUPER_ADMIN ve todas) vive en el service,
// que necesita el actor completo, no solo el clinicId activo.
@Controller('users')
@AuthClinic({ roles: [ValidRoles.ADMIN] })
@RequirePermissions(Permission.UsersManage)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('create')
  create(@Body() createUserDto: CreateUserDto, @GetUser() actor: User, @Req() req: Request) {
    return this.usersService.create(createUserDto, actor, resolveClinicId(req)!);
  }

  @Get()
  findAll(@Query() paginationDto: PaginationDto, @GetUser() actor: User, @Req() req: Request) {
    return this.usersService.findAll(paginationDto, actor, resolveClinicId(req)!);
  }

  @Get('statistics')
  getStatistics(@Req() req: Request) {
    return this.usersService.getClinicStatistics(resolveClinicId(req)!);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @GetUser() actor: User, @Req() req: Request) {
    return this.usersService.findOne(id, actor, resolveClinicId(req)!);
  }

  @Patch(':id/status')
  @HttpCode(HttpStatus.NO_CONTENT)
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('isActive') isActive: boolean,
    @GetUser() actor: User,
    @Req() req: Request,
  ) {
    return this.usersService.updateStatus(id, isActive, actor, resolveClinicId(req)!);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUserDto: UpdateUserDto,
    @GetUser() actor: User,
    @Req() req: Request,
  ) {
    return this.usersService.update(id, updateUserDto, actor, resolveClinicId(req)!);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @GetUser() actor: User, @Req() req: Request) {
    return this.usersService.remove(id, actor, resolveClinicId(req)!);
  }
}
