import {
  Body,
  Controller,
  DefaultValuePipe,
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
import { Auth, AuthClinic, GetUser } from '../../auth/decorators';
import { resolveClinicId } from '../../auth/decorators/clinic-roles.decorator';
import { ValidRoles } from '../../auth/interfaces';
import { User } from '../../users/entities/user.entity';
import {
  ConfirmReceiptDto,
  CreateStockTransferDto,
  DispatchTransferDto,
  RejectTransferDto,
  ReturnTransferDto,
} from '../dto';
import { TransferStatus } from '../entities/stock-transfer.entity';
import { StockTransfersService } from '../services/stock-transfers.service';

@Controller('transfers')
@AuthClinic()
@Auth(ValidRoles.ADMIN, ValidRoles.PHARMACIST)
export class StockTransfersController {
  constructor(private readonly transfersService: StockTransfersService) {}

  /**
   * Clínica B solicita un traspaso desde Clínica A.
   * POST /api/transfers
   */
  @Post()
  create(@Body() dto: CreateStockTransferDto, @GetUser() user: User, @Req() req: Request) {
    const targetClinicId = resolveClinicId(req)!;
    return this.transfersService.create(dto, user, targetClinicId);
  }

  /**
   * Badge: cuántos traspasos tiene pendientes esta clínica.
   * GET /api/transfers/pending-count
   */
  @Get('pending-count')
  getPendingCount(@Req() req: Request) {
    const clinicId = resolveClinicId(req)!;
    return this.transfersService.getPendingCount(clinicId);
  }

  /**
   * Lista de traspasos donde la clínica es origen o destino.
   * GET /api/transfers?status=in_transit&page=1&limit=20
   */
  @Get()
  findAll(
    @Req() req: Request,
    @Query('status') status?: TransferStatus,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit?: number,
  ) {
    const clinicId = resolveClinicId(req)!;
    return this.transfersService.findAll(clinicId, status, page, limit);
  }

  /**
   * Detalle de un traspaso (solo si la clínica es origen o destino).
   * GET /api/transfers/:id
   */
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    const clinicId = resolveClinicId(req)!;
    return this.transfersService.findOne(id, clinicId);
  }

  /**
   * Historial de auditoría de un traspaso.
   * GET /api/transfers/:id/audit
   */
  @Get(':id/audit')
  getAuditLog(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    const clinicId = resolveClinicId(req)!;
    return this.transfersService.getAuditLog(id, clinicId);
  }

  /**
   * Clínica A despacha: reserva stock y cambia estado a EN_TRÁNSITO.
   * PATCH /api/transfers/:id/dispatch
   */
  @Patch(':id/dispatch')
  dispatch(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DispatchTransferDto,
    @GetUser() user: User,
    @Req() req: Request,
  ) {
    const sourceClinicId = resolveClinicId(req)!;
    return this.transfersService.dispatch(id, user, dto, sourceClinicId);
  }

  /**
   * Clínica B confirma recepción: deduce de A, suma a B, cierra el ciclo.
   * PATCH /api/transfers/:id/confirm-receipt
   */
  @Patch(':id/confirm-receipt')
  confirmReceipt(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConfirmReceiptDto,
    @GetUser() user: User,
    @Req() req: Request,
  ) {
    const targetClinicId = resolveClinicId(req)!;
    return this.transfersService.confirmReceipt(id, user, dto, targetClinicId);
  }

  /**
   * Clínica A rechaza la solicitud (estado: REQUESTED → REJECTED).
   * PATCH /api/transfers/:id/reject
   */
  @Patch(':id/reject')
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectTransferDto,
    @GetUser() user: User,
    @Req() req: Request,
  ) {
    const sourceClinicId = resolveClinicId(req)!;
    return this.transfersService.reject(id, user, dto, sourceClinicId);
  }

  /**
   * Clínica B devuelve el traspaso en tránsito: libera reserva en A.
   * PATCH /api/transfers/:id/return
   */
  @Patch(':id/return')
  returnTransfer(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReturnTransferDto,
    @GetUser() user: User,
    @Req() req: Request,
  ) {
    const targetClinicId = resolveClinicId(req)!;
    return this.transfersService.returnTransfer(id, user, dto, targetClinicId);
  }
}
