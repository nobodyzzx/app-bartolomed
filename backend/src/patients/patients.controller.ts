import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { resolveClinicId } from '../auth/decorators/clinic-roles.decorator';
import { Auth, AuthClinic, GetUser } from '../auth/decorators';
import { RequirePermissions } from '../auth/permissions/permissions.decorator';
import { Permission } from '../auth/permissions/permissions.enum';
import { ValidRoles } from '../auth/interfaces';
import { User } from '../users/entities/user.entity';
import { CreatePatientDto, UpdatePatientDto } from './dto';
import { PatientsService } from './services/patients.service';

@Controller('patients')
@AuthClinic()
@RequirePermissions(Permission.PatientsRead, Permission.PatientsWrite)
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Post()
  @Auth(ValidRoles.SUPER_ADMIN, ValidRoles.ADMIN, ValidRoles.DOCTOR, ValidRoles.NURSE, ValidRoles.RECEPTIONIST)
  create(@Body() createPatientDto: CreatePatientDto, @GetUser() user: User, @Req() req: Request) {
    const clinicId = resolveClinicId(req);
    if (clinicId && createPatientDto.clinicId !== clinicId) {
      throw new BadRequestException('clinicId mismatch with current clinic context');
    }
    return this.patientsService.create(createPatientDto, user);
  }

  @Get()
  findAll(@Req() req: Request) {
    const clinicId = resolveClinicId(req);
    return this.patientsService.findAll(clinicId);
  }

  @Get('search')
  search(@Query('term') searchTerm: string, @Req() req: Request) {
    const clinicId = resolveClinicId(req);
    return this.patientsService.searchPatients(searchTerm, clinicId);
  }

  @Get('statistics')
  @Auth(ValidRoles.ADMIN, ValidRoles.DOCTOR)
  getStatistics(@Req() req: Request) {
    const clinicId = resolveClinicId(req);
    return this.patientsService.getPatientStatistics(clinicId);
  }

  @Get('document/:documentNumber')
  findByDocument(@Param('documentNumber') documentNumber: string, @Req() req: Request) {
    const clinicId = resolveClinicId(req);
    return this.patientsService.findByDocumentNumber(documentNumber, clinicId);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    const clinicId = resolveClinicId(req);
    return this.patientsService.findOne(id, clinicId);
  }

  @Patch(':id')
  @Auth(ValidRoles.SUPER_ADMIN, ValidRoles.ADMIN, ValidRoles.DOCTOR, ValidRoles.NURSE, ValidRoles.RECEPTIONIST)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() updatePatientDto: UpdatePatientDto, @Req() req: Request) {
    const clinicId = resolveClinicId(req);
    if (updatePatientDto.clinicId && clinicId && updatePatientDto.clinicId !== clinicId) {
      throw new BadRequestException('clinicId mismatch with current clinic context');
    }
    return this.patientsService.update(id, updatePatientDto, clinicId);
  }

  @Delete(':id')
  @Auth(ValidRoles.SUPER_ADMIN, ValidRoles.ADMIN, ValidRoles.DOCTOR)
  remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    const clinicId = resolveClinicId(req);
    return this.patientsService.remove(id, clinicId);
  }
}
