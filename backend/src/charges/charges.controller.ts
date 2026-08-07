import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req } from '@nestjs/common';
import { Request } from 'express';
import { AuthClinic, GetUser } from '../auth/decorators';
import { resolveClinicId } from '../auth/decorators/clinic-roles.decorator';
import { RequirePermissions } from '../auth/permissions/permissions.decorator';
import { Permission } from '../auth/permissions/permissions.enum';
import { User } from '../users/entities/user.entity';
import { ChargesService } from './charges.service';
import { CancelChargeDto, CreateChargeDto } from './dto';
import { ChargeOrigin, ChargeStatus } from './entities/charge.entity';

@Controller('charges')
@AuthClinic()
@RequirePermissions(Permission.BillingRead)
export class ChargesController {
  constructor(private readonly chargesService: ChargesService) {}

  @Post()
  @RequirePermissions(Permission.BillingManage)
  create(@Body() dto: CreateChargeDto, @GetUser() user: User, @Req() req: Request) {
    return this.chargesService.create({
      ...dto,
      origin: dto.origin ?? ChargeOrigin.OTHER,
      clinicId: resolveClinicId(req)!,
      createdById: user?.id,
    });
  }

  @Get()
  findAll(
    @Req() req: Request,
    @Query('patientId') patientId?: string,
    @Query('status') status?: ChargeStatus,
    @Query('origin') origin?: ChargeOrigin,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
  ) {
    return this.chargesService.findAll({ patientId, status, origin, page, pageSize }, resolveClinicId(req));
  }

  /** Cuenta abierta del paciente: lo que debe hoy. */
  @Get('patient/:patientId/pending')
  findPendingByPatient(@Param('patientId', ParseUUIDPipe) patientId: string, @Req() req: Request) {
    return this.chargesService.findPendingByPatient(patientId, resolveClinicId(req));
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.chargesService.findOne(id, resolveClinicId(req));
  }

  @Patch(':id/cancel')
  @RequirePermissions(Permission.BillingManage)
  cancel(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CancelChargeDto, @Req() req: Request) {
    return this.chargesService.cancel(id, dto.reason, resolveClinicId(req));
  }
}
