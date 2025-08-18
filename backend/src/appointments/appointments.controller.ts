import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AppointmentsService } from './services/appointments.service';
import { CreateAppointmentDto, UpdateAppointmentDto } from './dto';
import { Auth, GetUser } from '../auth/decorators';
import { ValidRoles } from '../auth/interfaces';
import { User } from '../users/entities/user.entity';
import { AppointmentStatus } from './entities/appointment.entity';

@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Post()
  @Auth(ValidRoles.ADMIN, ValidRoles.DOCTOR, ValidRoles.NURSE, ValidRoles.RECEPTIONIST)
  create(
    @Body() createAppointmentDto: CreateAppointmentDto,
    @GetUser() user: User,
  ) {
    return this.appointmentsService.create(createAppointmentDto, user);
  }

  @Get()
  @Auth(ValidRoles.ADMIN, ValidRoles.DOCTOR, ValidRoles.NURSE, ValidRoles.RECEPTIONIST)
  findAll(
    @Query('clinicId') clinicId?: string,
    @Query('doctorId') doctorId?: string,
    @Query('patientId') patientId?: string,
    @Query('status') status?: AppointmentStatus,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.appointmentsService.findAll(
      clinicId,
      doctorId,
      patientId,
      status,
      startDate,
      endDate,
    );
  }

  @Get('statistics')
  @Auth(ValidRoles.ADMIN, ValidRoles.DOCTOR)
  getStatistics(
    @Query('clinicId') clinicId?: string,
    @Query('doctorId') doctorId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.appointmentsService.getAppointmentStatistics(
      clinicId,
      doctorId,
      startDate,
      endDate,
    );
  }

  @Get('availability/:doctorId')
  @Auth(ValidRoles.ADMIN, ValidRoles.DOCTOR, ValidRoles.NURSE, ValidRoles.RECEPTIONIST)
  getDoctorAvailability(
    @Param('doctorId', ParseUUIDPipe) doctorId: string,
    @Query('date') date: string,
    @Query('clinicId') clinicId?: string,
  ) {
    return this.appointmentsService.getDoctorAvailability(doctorId, date, clinicId);
  }

  @Get(':id')
  @Auth(ValidRoles.ADMIN, ValidRoles.DOCTOR, ValidRoles.NURSE, ValidRoles.RECEPTIONIST)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.appointmentsService.findOne(id);
  }

  @Patch(':id')
  @Auth(ValidRoles.ADMIN, ValidRoles.DOCTOR, ValidRoles.NURSE, ValidRoles.RECEPTIONIST)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateAppointmentDto: UpdateAppointmentDto,
    @GetUser() user: User,
  ) {
    return this.appointmentsService.update(id, updateAppointmentDto, user);
  }

  @Patch(':id/confirm')
  @Auth(ValidRoles.ADMIN, ValidRoles.DOCTOR, ValidRoles.NURSE, ValidRoles.RECEPTIONIST)
  confirm(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser() user: User,
  ) {
    return this.appointmentsService.confirm(id, user);
  }

  @Patch(':id/complete')
  @Auth(ValidRoles.ADMIN, ValidRoles.DOCTOR)
  complete(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser() user: User,
  ) {
    return this.appointmentsService.complete(id, user);
  }

  @Patch(':id/cancel')
  @Auth(ValidRoles.ADMIN, ValidRoles.DOCTOR, ValidRoles.NURSE, ValidRoles.RECEPTIONIST)
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('cancellationReason') cancellationReason: string,
    @GetUser() user: User,
  ) {
    return this.appointmentsService.cancel(id, cancellationReason, user);
  }

  @Delete(':id')
  @Auth(ValidRoles.ADMIN)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.appointmentsService.remove(id);
  }
}
