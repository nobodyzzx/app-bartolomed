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
import { AppointmentsService } from './services/appointments.service';
import { CreateAppointmentDto, UpdateAppointmentDto } from './dto';
import { Auth, AuthClinic, GetUser } from '../auth/decorators';
import { resolveClinicId } from '../auth/decorators/clinic-roles.decorator';
import { RequirePermissions } from '../auth/permissions/permissions.decorator';
import { Permission } from '../auth/permissions/permissions.enum';
import { ValidRoles } from '../auth/interfaces';
import { User } from '../users/entities/user.entity';
import { AppointmentStatus } from './entities/appointment.entity';

@Controller('appointments')
@AuthClinic()
@RequirePermissions(Permission.AppointmentsRead, Permission.AppointmentsWrite)
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Post()
  @Auth(ValidRoles.ADMIN, ValidRoles.DOCTOR, ValidRoles.NURSE, ValidRoles.RECEPTIONIST)
  create(@Body() createAppointmentDto: CreateAppointmentDto, @GetUser() user: User, @Req() req: Request) {
    const clinicId = resolveClinicId(req);
    if (clinicId && createAppointmentDto.clinicId !== clinicId) {
      throw new BadRequestException('clinicId mismatch with current clinic context');
    }
    return this.appointmentsService.create(createAppointmentDto, user);
  }

  @Get()
  @Auth(ValidRoles.ADMIN, ValidRoles.DOCTOR, ValidRoles.NURSE, ValidRoles.RECEPTIONIST)
  findAll(
    @Req() req: Request,
    @Query('doctorId') doctorId?: string,
    @Query('patientId') patientId?: string,
    @Query('status') status?: AppointmentStatus,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const clinicId = resolveClinicId(req);
    return this.appointmentsService.findAll(clinicId, doctorId, patientId, status, startDate, endDate);
  }

  @Get('statistics')
  @Auth(ValidRoles.ADMIN, ValidRoles.DOCTOR)
  getStatistics(
    @Req() req: Request,
    @Query('doctorId') doctorId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const clinicId = resolveClinicId(req);
    return this.appointmentsService.getAppointmentStatistics(clinicId, doctorId, startDate, endDate);
  }

  @Get('availability/:doctorId')
  @Auth(ValidRoles.ADMIN, ValidRoles.DOCTOR, ValidRoles.NURSE, ValidRoles.RECEPTIONIST)
  getDoctorAvailability(
    @Param('doctorId', ParseUUIDPipe) doctorId: string,
    @Req() req: Request,
    @Query('date') date: string,
  ) {
    const clinicId = resolveClinicId(req);
    return this.appointmentsService.getDoctorAvailability(doctorId, date, clinicId);
  }

  @Get(':id')
  @Auth(ValidRoles.ADMIN, ValidRoles.DOCTOR, ValidRoles.NURSE, ValidRoles.RECEPTIONIST)
  findOne(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    const clinicId = resolveClinicId(req);
    return this.appointmentsService.findOne(id, clinicId);
  }

  @Patch(':id')
  @Auth(ValidRoles.ADMIN, ValidRoles.DOCTOR, ValidRoles.NURSE, ValidRoles.RECEPTIONIST)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateAppointmentDto: UpdateAppointmentDto,
    @Req() req: Request,
    @GetUser() user: User,
  ) {
    const clinicId = resolveClinicId(req);
    return this.appointmentsService.update(id, updateAppointmentDto, user, clinicId);
  }

  @Patch(':id/confirm')
  @Auth(ValidRoles.ADMIN, ValidRoles.DOCTOR, ValidRoles.NURSE, ValidRoles.RECEPTIONIST)
  confirm(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request, @GetUser() user: User) {
    const clinicId = resolveClinicId(req);
    return this.appointmentsService.confirm(id, user, clinicId);
  }

  @Patch(':id/complete')
  @Auth(ValidRoles.ADMIN, ValidRoles.DOCTOR)
  complete(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request, @GetUser() user: User) {
    const clinicId = resolveClinicId(req);
    return this.appointmentsService.complete(id, user, clinicId);
  }

  @Patch(':id/cancel')
  @Auth(ValidRoles.ADMIN, ValidRoles.DOCTOR, ValidRoles.NURSE, ValidRoles.RECEPTIONIST)
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('cancellationReason') cancellationReason: string,
    @Req() req: Request,
    @GetUser() user: User,
  ) {
    const clinicId = resolveClinicId(req);
    return this.appointmentsService.cancel(id, cancellationReason, user, clinicId);
  }

  @Delete(':id')
  @Auth(ValidRoles.ADMIN)
  remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    const clinicId = resolveClinicId(req);
    return this.appointmentsService.remove(id, clinicId);
  }
}
