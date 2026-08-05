import { BadRequestException } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { InvoiceStatus } from './entities/billing.entity';
import { User } from '../users/entities/user.entity';
import { CheckoutService } from './services/checkout.service';
import { ReceiptPdfService } from './services/receipt-pdf.service';

const makeReq = (overrides: Record<string, any> = {}) =>
  ({ headers: { 'x-clinic-id': 'clinic-1' }, params: {}, ...overrides }) as any;

describe('BillingController', () => {
  let controller: BillingController;
  let service: jest.Mocked<BillingService>;
  let checkoutService: jest.Mocked<CheckoutService>;
  let receiptPdfService: jest.Mocked<ReceiptPdfService>;
  const user = { id: 'user-1' } as User;

  beforeEach(() => {
    service = {
      create: jest.fn().mockResolvedValue({ id: 'inv-1' }),
      findAll: jest.fn().mockResolvedValue({ data: [], total: 0 }),
      findOne: jest.fn().mockResolvedValue({ id: 'inv-1' }),
      update: jest.fn().mockResolvedValue({ id: 'inv-1' }),
      setStatus: jest.fn().mockResolvedValue({ id: 'inv-1' }),
      delete: jest.fn().mockResolvedValue(undefined),
      addPayment: jest.fn().mockResolvedValue({ id: 'pay-1' }),
      getPaymentsByInvoice: jest.fn().mockResolvedValue([]),
      confirmPayment: jest.fn().mockResolvedValue({ id: 'pay-1' }),
      cancelPayment: jest.fn().mockResolvedValue({ id: 'pay-1' }),
      getStatistics: jest.fn().mockResolvedValue({ total: 0 }),
      generateInvoiceNumber: jest.fn().mockResolvedValue('INV-0001'),
      generatePaymentNumber: jest.fn().mockResolvedValue('PAY-0001'),
    } as unknown as jest.Mocked<BillingService>;
    checkoutService = {
      checkout: jest.fn().mockResolvedValue({ id: 'inv-1' }),
      buildReceipt: jest.fn().mockResolvedValue({ buffer: Buffer.from('%PDF'), fileName: 'FAC-000001.pdf' }),
    } as unknown as jest.Mocked<CheckoutService>;
    receiptPdfService = {
      generate: jest.fn().mockResolvedValue(Buffer.from('%PDF')),
    } as unknown as jest.Mocked<ReceiptPdfService>;
    controller = new BillingController(service, checkoutService, receiptPdfService);
  });

  it('createInvoice resuelve clinicId y delega dto/user', async () => {
    const dto = { patientId: 'p-1' } as any;
    await controller.createInvoice(dto, user, makeReq());
    expect(service.create).toHaveBeenCalledWith(dto, user, 'clinic-1');
  });

  it('createInvoice funciona sin request (clinicId undefined)', async () => {
    const dto = { patientId: 'p-1' } as any;
    await controller.createInvoice(dto, user, undefined);
    expect(service.create).toHaveBeenCalledWith(dto, user, undefined);
  });

  describe('findAllInvoices', () => {
    it('usa page/pageSize por defecto (1/20), limpia esos campos y elimina filter.clinicId', async () => {
      controller.findAllInvoices(undefined, undefined, { page: '3', pageSize: '5', status: 'pending' }, makeReq());
      expect(service.findAll).toHaveBeenCalledWith(1, 20, { status: 'pending' }, 'clinic-1');
    });

    it('lanza BadRequestException (síncrono) si filter.clinicId no coincide con el contexto', () => {
      expect(() => controller.findAllInvoices(1, 20, { clinicId: 'clinic-2' }, makeReq())).toThrow(BadRequestException);
      expect(service.findAll).not.toHaveBeenCalled();
    });

    it('permite filter.clinicId si coincide con el contexto', () => {
      controller.findAllInvoices(1, 20, { clinicId: 'clinic-1' }, makeReq());
      expect(service.findAll).toHaveBeenCalledWith(1, 20, {}, 'clinic-1');
    });
  });

  it('findOneInvoice delega id y clinicId', async () => {
    await controller.findOneInvoice('inv-1', makeReq());
    expect(service.findOne).toHaveBeenCalledWith('inv-1', 'clinic-1');
  });

  it('updateInvoice delega id, dto y clinicId', async () => {
    const dto = { notes: 'x' } as any;
    await controller.updateInvoice('inv-1', dto, makeReq());
    expect(service.update).toHaveBeenCalledWith('inv-1', dto, 'clinic-1');
  });

  it('setInvoiceStatus delega id, status y clinicId', async () => {
    await controller.setInvoiceStatus('inv-1', InvoiceStatus.PAID, makeReq());
    expect(service.setStatus).toHaveBeenCalledWith('inv-1', InvoiceStatus.PAID, 'clinic-1');
  });

  it('deleteInvoice delega id y clinicId', async () => {
    await controller.deleteInvoice('inv-1', makeReq());
    expect(service.delete).toHaveBeenCalledWith('inv-1', 'clinic-1');
  });

  it('addPayment delega dto, user y clinicId', async () => {
    const dto = { invoiceId: 'inv-1', amount: 100 } as any;
    await controller.addPayment(dto, user, makeReq());
    expect(service.addPayment).toHaveBeenCalledWith(dto, user, 'clinic-1');
  });

  it('getPaymentsByInvoice delega invoiceId y clinicId', async () => {
    await controller.getPaymentsByInvoice('inv-1', makeReq());
    expect(service.getPaymentsByInvoice).toHaveBeenCalledWith('inv-1', 'clinic-1');
  });

  it('confirmPayment delega id y clinicId', async () => {
    await controller.confirmPayment('pay-1', makeReq());
    expect(service.confirmPayment).toHaveBeenCalledWith('pay-1', 'clinic-1');
  });

  it('cancelPayment delega id y clinicId', async () => {
    await controller.cancelPayment('pay-1', makeReq());
    expect(service.cancelPayment).toHaveBeenCalledWith('pay-1', 'clinic-1');
  });

  describe('getStatistics', () => {
    it('usa el clinicId del contexto si coincide con el query param', () => {
      controller.getStatistics('clinic-1', makeReq());
      expect(service.getStatistics).toHaveBeenCalledWith('clinic-1');
    });

    it('lanza BadRequestException (síncrono) si el query param no coincide con el contexto', () => {
      expect(() => controller.getStatistics('clinic-2', makeReq())).toThrow(BadRequestException);
      expect(service.getStatistics).not.toHaveBeenCalled();
    });

    it('cae al query param si no hay clinicId de contexto', () => {
      controller.getStatistics('clinic-9', makeReq({ headers: {} }));
      expect(service.getStatistics).toHaveBeenCalledWith('clinic-9');
    });
  });

  it('generateInvoiceNumber delega sin argumentos', async () => {
    const result = await controller.generateInvoiceNumber();
    expect(service.generateInvoiceNumber).toHaveBeenCalled();
    expect(result).toBe('INV-0001');
  });

  it('generatePaymentNumber delega sin argumentos', async () => {
    const result = await controller.generatePaymentNumber();
    expect(service.generatePaymentNumber).toHaveBeenCalled();
    expect(result).toBe('PAY-0001');
  });
});
