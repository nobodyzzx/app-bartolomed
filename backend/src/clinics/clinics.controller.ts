import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { Auth, AuthClinic, GetUser } from '../auth/decorators';
import { RequirePermissions } from '../auth/permissions/permissions.decorator';
import { Permission } from '../auth/permissions/permissions.enum';
import { ValidRoles } from '../auth/interfaces';
import { User } from '../users/entities/user.entity';
import { CreateClinicDto, UpdateClinicDto } from './dto';
import { AddClinicMemberDto } from './dto/add-clinic-member.dto';
import { UpdateClinicMemberDto } from './dto/update-clinic-member.dto';
import { ClinicsService } from './services/clinics.service';

@Controller('clinics')
@Auth()
export class ClinicsController {
  constructor(private readonly clinicsService: ClinicsService) {}

  @Post()
  // ADMIN no tiene Permission.ClinicsManage (solo SUPER_ADMIN, ver comentario
  // más abajo) — listarlo acá era decorativo, PermissionsGuard lo bloqueaba igual.
  @Auth(ValidRoles.SUPER_ADMIN)
  @RequirePermissions(Permission.ClinicsManage)
  create(@Body() createClinicDto: CreateClinicDto, @GetUser() user: User) {
    return this.clinicsService.create(createClinicDto, user);
  }

  @Get()
  findAll(@Query('isActive') isActive?: string) {
    const isActiveFilter = isActive !== undefined ? isActive === 'true' : undefined;
    return this.clinicsService.findAll(isActiveFilter);
  }

  @Get('search')
  search(@Query('term') searchTerm: string) {
    return this.clinicsService.searchClinics(searchTerm);
  }

  @Get('statistics')
  // ADMIN no tiene Permission.ClinicsManage (solo SUPER_ADMIN, ver comentario
  // más abajo) — listarlo acá era decorativo, PermissionsGuard lo bloqueaba igual.
  @Auth(ValidRoles.SUPER_ADMIN)
  @RequirePermissions(Permission.ClinicsManage)
  getStatistics() {
    return this.clinicsService.getClinicStatistics();
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.clinicsService.findOne(id);
  }

  @Patch(':id')
  // ADMIN no tiene Permission.ClinicsManage (solo SUPER_ADMIN, ver comentario
  // más abajo) — listarlo acá era decorativo, PermissionsGuard lo bloqueaba igual.
  @Auth(ValidRoles.SUPER_ADMIN)
  @RequirePermissions(Permission.ClinicsManage)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() updateClinicDto: UpdateClinicDto) {
    return this.clinicsService.update(id, updateClinicDto);
  }

  @Delete(':id')
  // ADMIN no tiene Permission.ClinicsManage (solo SUPER_ADMIN, ver comentario
  // más abajo) — listarlo acá era decorativo, PermissionsGuard lo bloqueaba igual.
  @Auth(ValidRoles.SUPER_ADMIN)
  @RequirePermissions(Permission.ClinicsManage)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.clinicsService.remove(id);
  }

  @Patch(':id/activate')
  // ADMIN no tiene Permission.ClinicsManage (solo SUPER_ADMIN, ver comentario
  // más abajo) — listarlo acá era decorativo, PermissionsGuard lo bloqueaba igual.
  @Auth(ValidRoles.SUPER_ADMIN)
  @RequirePermissions(Permission.ClinicsManage)
  activate(@Param('id', ParseUUIDPipe) id: string) {
    return this.clinicsService.activate(id);
  }

  @Patch(':id/deactivate')
  // ADMIN no tiene Permission.ClinicsManage (solo SUPER_ADMIN, ver comentario
  // más abajo) — listarlo acá era decorativo, PermissionsGuard lo bloqueaba igual.
  @Auth(ValidRoles.SUPER_ADMIN)
  @RequirePermissions(Permission.ClinicsManage)
  deactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.clinicsService.deactivate(id);
  }

  // Ver el roster es intencionalmente abierto a cualquier miembro de la clínica
  // (no solo admins) — en una clínica chica todo el staff se conoce, y no hay
  // dato sensible más allá de nombre/rol/teléfono de colegas. @AuthClinic() sin
  // clinicRoles exige membresía (vía ClinicScopeGuard) pero no rol 'admin'.
  @Get(':clinicId/members')
  @AuthClinic()
  getMembers(@Param('clinicId', ParseUUIDPipe) clinicId: string) {
    return this.clinicsService.getClinicMembers(clinicId);
  }

  // Mutar membresía sí queda restringido a SUPER_ADMIN o admin de ESA clínica.
  // Sin @RequirePermissions aquí a propósito: ClinicsManage no está asignado a ningún
  // rol global salvo SUPER_ADMIN (via spread de todos los permisos), así que agregarlo
  // bloquearía a cualquier admin scoped-a-clínica antes de que ClinicScopeGuard llegue
  // a evaluar clinicRoles — que es precisamente el control de acceso que estos endpoints
  // necesitan (ya verifica membresía + rol 'admin' en esa clínica vía UserClinic).
  @Post(':clinicId/members')
  @AuthClinic({ clinicRoles: ['admin'] })
  addMember(@Param('clinicId', ParseUUIDPipe) clinicId: string, @Body() dto: AddClinicMemberDto) {
    return this.clinicsService.addMemberWithRoles(clinicId, dto);
  }

  @Patch(':clinicId/members/:userId')
  @AuthClinic({ clinicRoles: ['admin'] })
  updateMember(
    @Param('clinicId', ParseUUIDPipe) clinicId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: UpdateClinicMemberDto,
  ) {
    return this.clinicsService.updateMemberRoles(clinicId, userId, dto);
  }

  @Delete(':clinicId/members/:userId')
  @AuthClinic({ clinicRoles: ['admin'] })
  removeMember(@Param('clinicId', ParseUUIDPipe) clinicId: string, @Param('userId', ParseUUIDPipe) userId: string) {
    return this.clinicsService.removeUserFromClinic(userId, clinicId);
  }
}
