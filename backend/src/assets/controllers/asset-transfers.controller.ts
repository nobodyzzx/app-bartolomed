import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { Auth, AuthClinic } from '../../auth/decorators';
import { resolveClinicId } from '../../auth/decorators/clinic-roles.decorator';
import { GetUser } from '../../auth/decorators/get-user.decorator';
import { ValidRoles } from '../../auth/interfaces';
import { User } from '../../users/entities/user.entity';
import {
  ConfirmReceiptDto,
  CreateAssetTransferDto,
  DispatchTransferDto,
  FilterAssetTransfersDto,
  RejectTransferDto,
} from '../dto/asset-transfer.dto';
import { AssetTransfersService } from '../services/asset-transfers.service';

@Controller('asset-transfers')
@AuthClinic({ roles: [ValidRoles.ADMIN, ValidRoles.SUPER_ADMIN] })
export class AssetTransfersController {
  constructor(private readonly service: AssetTransfersService) {}

  @Post()
  @Auth(ValidRoles.ADMIN, ValidRoles.SUPER_ADMIN)
  create(@Body() dto: CreateAssetTransferDto, @GetUser() user: User, @Req() req: Request) {
    return this.service.create(dto, user.id, resolveClinicId(req)!);
  }

  @Get()
  @Auth(ValidRoles.ADMIN, ValidRoles.SUPER_ADMIN, ValidRoles.DOCTOR, ValidRoles.NURSE)
  findAll(@Query() filters: FilterAssetTransfersDto, @Req() req: Request) {
    return this.service.findAll(resolveClinicId(req)!, filters);
  }

  @Get('pending-count')
  @Auth(ValidRoles.ADMIN, ValidRoles.SUPER_ADMIN)
  getPendingCount(@Req() req: Request) {
    return this.service.getPendingCount(resolveClinicId(req)!);
  }

  @Get(':id')
  @Auth(ValidRoles.ADMIN, ValidRoles.SUPER_ADMIN, ValidRoles.DOCTOR, ValidRoles.NURSE)
  findOne(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.service.findOne(id, resolveClinicId(req)!);
  }

  @Get(':id/audit')
  @Auth(ValidRoles.ADMIN, ValidRoles.SUPER_ADMIN)
  getAuditLog(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.service.getAuditLog(id, resolveClinicId(req)!);
  }

  @Patch(':id/dispatch')
  @Auth(ValidRoles.ADMIN, ValidRoles.SUPER_ADMIN)
  dispatch(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DispatchTransferDto,
    @GetUser() user: User,
    @Req() req: Request,
  ) {
    return this.service.dispatch(id, dto, user.id, resolveClinicId(req)!);
  }

  @Patch(':id/confirm-receipt')
  @Auth(ValidRoles.ADMIN, ValidRoles.SUPER_ADMIN)
  confirmReceipt(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConfirmReceiptDto,
    @GetUser() user: User,
    @Req() req: Request,
  ) {
    return this.service.confirmReceipt(id, dto, user.id, resolveClinicId(req)!);
  }

  @Patch(':id/reject')
  @Auth(ValidRoles.ADMIN, ValidRoles.SUPER_ADMIN)
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectTransferDto,
    @GetUser() user: User,
    @Req() req: Request,
  ) {
    return this.service.reject(id, dto, user.id, resolveClinicId(req)!);
  }

  @Patch(':id/return')
  @Auth(ValidRoles.ADMIN, ValidRoles.SUPER_ADMIN)
  returnTransfer(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectTransferDto,
    @GetUser() user: User,
    @Req() req: Request,
  ) {
    return this.service.returnTransfer(id, dto, user.id, resolveClinicId(req)!);
  }
}
