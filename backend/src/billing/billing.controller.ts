import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { Auth, GetUser } from '../auth/decorators';
import { RequirePermissions } from '../auth/permissions/permissions.decorator';
import { Permission } from '../auth/permissions/permissions.enum';
import { ValidRoles } from '../auth/interfaces';
import { User } from '../users/entities/user.entity';
import { BillingService } from './billing.service';
import { CreateInvoiceDto, CreatePaymentDto, UpdateInvoiceDto } from './dto';
import { InvoiceStatus } from './entities/billing.entity';

@Controller('billing')
@Auth()
@RequirePermissions(Permission.BillingRead, Permission.BillingManage)
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  // Invoice endpoints
  @Post('invoices')
  @Auth(ValidRoles.ADMIN, ValidRoles.DOCTOR, ValidRoles.RECEPTIONIST)
  createInvoice(@Body() createDto: CreateInvoiceDto, @GetUser() user: User) {
    return this.billingService.create(createDto, user);
  }

  @Get('invoices')
  findAllInvoices(@Query('page') page?: number, @Query('pageSize') pageSize?: number, @Query() query?: any) {
    const p = page ? Number(page) : 1;
    const ps = pageSize ? Number(pageSize) : 20;
    const filter = { ...query };
    delete filter.page;
    delete filter.pageSize;
    return this.billingService.findAll(p, ps, filter);
  }

  @Get('invoices/:id')
  findOneInvoice(@Param('id', ParseUUIDPipe) id: string) {
    return this.billingService.findOne(id);
  }

  @Patch('invoices/:id')
  @Auth(ValidRoles.ADMIN, ValidRoles.DOCTOR, ValidRoles.RECEPTIONIST)
  updateInvoice(@Param('id', ParseUUIDPipe) id: string, @Body() updateDto: UpdateInvoiceDto) {
    return this.billingService.update(id, updateDto);
  }

  @Patch('invoices/:id/status')
  @Auth(ValidRoles.ADMIN, ValidRoles.DOCTOR, ValidRoles.RECEPTIONIST)
  setInvoiceStatus(@Param('id', ParseUUIDPipe) id: string, @Body('status') status: InvoiceStatus) {
    return this.billingService.setStatus(id, status);
  }

  @Delete('invoices/:id')
  @Auth(ValidRoles.ADMIN)
  deleteInvoice(@Param('id', ParseUUIDPipe) id: string) {
    return this.billingService.delete(id);
  }

  // Payment endpoints
  @Post('payments')
  @Auth(ValidRoles.ADMIN, ValidRoles.RECEPTIONIST)
  addPayment(@Body() createDto: CreatePaymentDto, @GetUser() user: User) {
    return this.billingService.addPayment(createDto, user);
  }

  @Get('payments/invoice/:invoiceId')
  getPaymentsByInvoice(@Param('invoiceId', ParseUUIDPipe) invoiceId: string) {
    return this.billingService.getPaymentsByInvoice(invoiceId);
  }

  @Patch('payments/:id/confirm')
  @Auth(ValidRoles.ADMIN, ValidRoles.RECEPTIONIST)
  confirmPayment(@Param('id', ParseUUIDPipe) id: string) {
    return this.billingService.confirmPayment(id);
  }

  @Patch('payments/:id/cancel')
  @Auth(ValidRoles.ADMIN)
  cancelPayment(@Param('id', ParseUUIDPipe) id: string) {
    return this.billingService.cancelPayment(id);
  }

  // Statistics and utilities
  @Get('statistics')
  getStatistics(@Query('clinicId') clinicId?: string) {
    return this.billingService.getStatistics(clinicId);
  }

  @Get('generate/invoice-number')
  @Auth(ValidRoles.ADMIN, ValidRoles.DOCTOR, ValidRoles.RECEPTIONIST)
  generateInvoiceNumber() {
    return this.billingService.generateInvoiceNumber();
  }

  @Get('generate/payment-number')
  @Auth(ValidRoles.ADMIN, ValidRoles.RECEPTIONIST)
  generatePaymentNumber() {
    return this.billingService.generatePaymentNumber();
  }
}
