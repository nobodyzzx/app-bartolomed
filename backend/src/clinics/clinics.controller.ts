import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Auth, GetUser } from '../auth/decorators';
import { ClinicRoles } from '../auth/decorators/clinic-roles.decorator';
import { ClinicScopeGuard } from '../auth/guards/clinic-scope.guard';
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
  @Auth(ValidRoles.SUPER_ADMIN, ValidRoles.ADMIN)
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
  @Auth(ValidRoles.SUPER_ADMIN, ValidRoles.ADMIN)
  getStatistics() {
    return this.clinicsService.getClinicStatistics();
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.clinicsService.findOne(id);
  }

  @Patch(':id')
  @Auth(ValidRoles.SUPER_ADMIN, ValidRoles.ADMIN)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() updateClinicDto: UpdateClinicDto) {
    return this.clinicsService.update(id, updateClinicDto);
  }

  @Delete(':id')
  @Auth(ValidRoles.SUPER_ADMIN, ValidRoles.ADMIN)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.clinicsService.remove(id);
  }

  @Patch(':id/activate')
  @Auth(ValidRoles.SUPER_ADMIN, ValidRoles.ADMIN)
  activate(@Param('id', ParseUUIDPipe) id: string) {
    return this.clinicsService.activate(id);
  }

  @Patch(':id/deactivate')
  @Auth(ValidRoles.SUPER_ADMIN, ValidRoles.ADMIN)
  deactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.clinicsService.deactivate(id);
  }

  // Membership management scoped by clinic: SUPER_ADMIN or clinic admin
  @Get(':clinicId/members')
  @Auth()
  @UseGuards(ClinicScopeGuard)
  getMembers(@Param('clinicId', ParseUUIDPipe) clinicId: string) {
    return this.clinicsService.getClinicMembers(clinicId);
  }

  @Post(':clinicId/members')
  @Auth() // requiere JWT
  @UseGuards(ClinicScopeGuard)
  @ClinicRoles('admin')
  addMember(@Param('clinicId', ParseUUIDPipe) clinicId: string, @Body() dto: AddClinicMemberDto) {
    return this.clinicsService.addMemberWithRoles(clinicId, dto);
  }

  @Patch(':clinicId/members/:userId')
  @Auth()
  @UseGuards(ClinicScopeGuard)
  @ClinicRoles('admin')
  updateMember(
    @Param('clinicId', ParseUUIDPipe) clinicId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: UpdateClinicMemberDto,
  ) {
    return this.clinicsService.updateMemberRoles(clinicId, userId, dto);
  }

  @Delete(':clinicId/members/:userId')
  @Auth()
  @UseGuards(ClinicScopeGuard)
  @ClinicRoles('admin')
  removeMember(@Param('clinicId', ParseUUIDPipe) clinicId: string, @Param('userId', ParseUUIDPipe) userId: string) {
    return this.clinicsService.removeUserFromClinic(userId, clinicId);
  }
}
