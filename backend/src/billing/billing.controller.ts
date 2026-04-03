import { BadRequestException, Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req } from '@nestjs/common';
import { Request } from 'express';
import { Auth, AuthClinic, GetUser } from '../auth/decorators';
import { resolveClinicId } from '../auth/decorators/clinic-roles.decorator';
import { RequirePermissions } from '../auth/permissions/permissions.decorator';
import { Permission } from '../auth/permissions/permissions.enum';
import { ValidRoles } from '../auth/interfaces';
import { User } from '../users/entities/user.entity';
import { BillingService } from './billing.service';
import { CreateInvoiceDto, CreatePaymentDto, UpdateInvoiceDto } from './dto';
import { InvoiceStatus } from './entities/billing.entity';

@Controller('billing')
@AuthClinic()
@RequirePermissions(Permission.BillingRead, Permission.BillingManage)
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  // Invoice endpoints
  @Post('invoices')
  @Auth(ValidRoles.ADMIN, ValidRoles.DOCTOR, ValidRoles.RECEPTIONIST)
  @RequirePermissions(Permission.BillingManage)
  createInvoice(@Body() createDto: CreateInvoiceDto, @GetUser() user: User, @Req() req?: Request) {
    const scopedClinicId = req ? resolveClinicId(req) : undefined;
    return this.billingService.create(createDto, user, scopedClinicId);
  }

  @Get('invoices')
  @RequirePermissions(Permission.BillingRead)
  findAllInvoices(@Query('page') page?: number, @Query('pageSize') pageSize?: number, @Query() query?: any, @Req() req?: Request) {
    const p = page ? Number(page) : 1;
    const ps = pageSize ? Number(pageSize) : 20;
    const filter = { ...query };
    delete filter.page;
    delete filter.pageSize;
    const scopedClinicId = req ? resolveClinicId(req) : undefined;
    if (scopedClinicId && filter.clinicId && filter.clinicId !== scopedClinicId) {
      throw new BadRequestException('clinicId no coincide con el contexto de clínica');
    }
    delete filter.clinicId;
    return this.billingService.findAll(p, ps, filter, scopedClinicId);
  }

  @Get('invoices/:id')
  @RequirePermissions(Permission.BillingRead)
  findOneInvoice(@Param('id', ParseUUIDPipe) id: string, @Req() req?: Request) {
    const scopedClinicId = req ? resolveClinicId(req) : undefined;
    return this.billingService.findOne(id, scopedClinicId);
  }

  @Patch('invoices/:id')
  @Auth(ValidRoles.ADMIN, ValidRoles.DOCTOR, ValidRoles.RECEPTIONIST)
  @RequirePermissions(Permission.BillingManage)
  updateInvoice(@Param('id', ParseUUIDPipe) id: string, @Body() updateDto: UpdateInvoiceDto, @Req() req?: Request) {
    const scopedClinicId = req ? resolveClinicId(req) : undefined;
    return this.billingService.update(id, updateDto, scopedClinicId);
  }

  @Patch('invoices/:id/status')
  @Auth(ValidRoles.ADMIN, ValidRoles.DOCTOR, ValidRoles.RECEPTIONIST)
  @RequirePermissions(Permission.BillingManage)
  setInvoiceStatus(@Param('id', ParseUUIDPipe) id: string, @Body('status') status: InvoiceStatus, @Req() req?: Request) {
    const scopedClinicId = req ? resolveClinicId(req) : undefined;
    return this.billingService.setStatus(id, status, scopedClinicId);
  }

  @Delete('invoices/:id')
  @Auth(ValidRoles.ADMIN)
  @RequirePermissions(Permission.BillingManage)
  deleteInvoice(@Param('id', ParseUUIDPipe) id: string, @Req() req?: Request) {
    const scopedClinicId = req ? resolveClinicId(req) : undefined;
    return this.billingService.delete(id, scopedClinicId);
  }

  // Payment endpoints
  @Post('payments')
  @Auth(ValidRoles.ADMIN, ValidRoles.RECEPTIONIST)
  @RequirePermissions(Permission.BillingManage)
  addPayment(@Body() createDto: CreatePaymentDto, @GetUser() user: User, @Req() req?: Request) {
    const scopedClinicId = req ? resolveClinicId(req) : undefined;
    return this.billingService.addPayment(createDto, user, scopedClinicId);
  }

  @Get('payments/invoice/:invoiceId')
  @RequirePermissions(Permission.BillingRead)
  getPaymentsByInvoice(@Param('invoiceId', ParseUUIDPipe) invoiceId: string, @Req() req?: Request) {
    const scopedClinicId = req ? resolveClinicId(req) : undefined;
    return this.billingService.getPaymentsByInvoice(invoiceId, scopedClinicId);
  }

  @Patch('payments/:id/confirm')
  @Auth(ValidRoles.ADMIN, ValidRoles.RECEPTIONIST)
  @RequirePermissions(Permission.BillingManage)
  confirmPayment(@Param('id', ParseUUIDPipe) id: string, @Req() req?: Request) {
    const scopedClinicId = req ? resolveClinicId(req) : undefined;
    return this.billingService.confirmPayment(id, scopedClinicId);
  }

  @Patch('payments/:id/cancel')
  @Auth(ValidRoles.ADMIN)
  @RequirePermissions(Permission.BillingManage)
  cancelPayment(@Param('id', ParseUUIDPipe) id: string, @Req() req?: Request) {
    const scopedClinicId = req ? resolveClinicId(req) : undefined;
    return this.billingService.cancelPayment(id, scopedClinicId);
  }

  // Statistics and utilities
  @Get('statistics')
  @RequirePermissions(Permission.BillingRead)
  getStatistics(@Query('clinicId') clinicId?: string, @Req() req?: Request) {
    const scopedClinicId = req ? resolveClinicId(req) : undefined;
    if (scopedClinicId && clinicId && clinicId !== scopedClinicId) {
      throw new BadRequestException('clinicId no coincide con el contexto de clínica');
    }
    return this.billingService.getStatistics(scopedClinicId || clinicId);
  }

  @Get('generate/invoice-number')
  @Auth(ValidRoles.ADMIN, ValidRoles.DOCTOR, ValidRoles.RECEPTIONIST)
  @RequirePermissions(Permission.BillingManage)
  generateInvoiceNumber() {
    return this.billingService.generateInvoiceNumber();
  }

  @Get('generate/payment-number')
  @Auth(ValidRoles.ADMIN, ValidRoles.RECEPTIONIST)
  @RequirePermissions(Permission.BillingManage)
  generatePaymentNumber() {
    return this.billingService.generatePaymentNumber();
  }
}
