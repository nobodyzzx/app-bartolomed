import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { Auth, GetUser } from '../auth/decorators';
import { ValidRoles } from '../auth/interfaces';
import { User } from '../users/entities/user.entity';
import { CreateClinicDto, UpdateClinicDto } from './dto';
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
}
