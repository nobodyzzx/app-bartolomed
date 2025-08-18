import { Controller, Get, Post, Body, Patch, Param, Delete, Query, ParseUUIDPipe } from '@nestjs/common';
import { PatientsService } from './services/patients.service';
import { CreatePatientDto, UpdatePatientDto } from './dto';
import { Auth, GetUser } from '../auth/decorators';
import { ValidRoles } from '../auth/interfaces';
import { User } from '../users/entities/user.entity';

@Controller('patients')
@Auth()
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Post()
  @Auth(ValidRoles.ADMIN, ValidRoles.DOCTOR, ValidRoles.NURSE, ValidRoles.RECEPTIONIST)
  create(@Body() createPatientDto: CreatePatientDto, @GetUser() user: User) {
    return this.patientsService.create(createPatientDto, user);
  }

  @Get()
  findAll(@Query('clinicId') clinicId?: string) {
    return this.patientsService.findAll(clinicId);
  }

  @Get('search')
  search(@Query('term') searchTerm: string, @Query('clinicId') clinicId?: string) {
    return this.patientsService.searchPatients(searchTerm, clinicId);
  }

  @Get('statistics')
  @Auth(ValidRoles.ADMIN, ValidRoles.DOCTOR)
  getStatistics(@Query('clinicId') clinicId?: string) {
    return this.patientsService.getPatientStatistics(clinicId);
  }

  @Get('document/:documentNumber')
  findByDocument(@Param('documentNumber') documentNumber: string) {
    return this.patientsService.findByDocumentNumber(documentNumber);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.patientsService.findOne(id);
  }

  @Patch(':id')
  @Auth(ValidRoles.ADMIN, ValidRoles.DOCTOR, ValidRoles.NURSE, ValidRoles.RECEPTIONIST)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() updatePatientDto: UpdatePatientDto) {
    return this.patientsService.update(id, updatePatientDto);
  }

  @Delete(':id')
  @Auth(ValidRoles.ADMIN, ValidRoles.DOCTOR)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.patientsService.remove(id);
  }
}
