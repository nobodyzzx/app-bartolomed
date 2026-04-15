import {
  BadRequestException,
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  Param,
  ParseIntPipe,
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
import { Gender } from './entities/patient.entity';
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
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(25), ParseIntPipe) limit: number,
    @Query('gender') gender: Gender | undefined,
    @Req() req: Request,
  ) {
    const clinicId = resolveClinicId(req)!;
    return this.patientsService.findAll(clinicId, page, limit, gender);
  }

  @Get('search')
  search(
    @Query('term') searchTerm: string,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Req() req: Request,
  ) {
    const clinicId = resolveClinicId(req);
    return this.patientsService.searchPatients(searchTerm, clinicId, limit);
  }

  @Get('statistics')
  @Auth(ValidRoles.SUPER_ADMIN, ValidRoles.ADMIN, ValidRoles.DOCTOR, ValidRoles.NURSE, ValidRoles.RECEPTIONIST)
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
    const user = (req as any).user;
    const actor = { id: user?.id, email: user?.email ?? '', clinicId: clinicId ?? undefined, ip: (req as any).ip };
    return this.patientsService.update(id, updatePatientDto, clinicId, actor);
  }

  @Delete(':id')
  @Auth(ValidRoles.SUPER_ADMIN, ValidRoles.ADMIN, ValidRoles.DOCTOR)
  remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    const clinicId = resolveClinicId(req);
    const user = (req as any).user;
    const actor = { id: user?.id, email: user?.email ?? '', clinicId: clinicId ?? undefined, ip: (req as any).ip };
    return this.patientsService.remove(id, clinicId, actor);
  }
}
