import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PharmacyInvoicesService } from './pharmacy-invoices.service';
import { InvoiceStatus, PharmacyInvoice } from '../entities/pharmacy-invoice.entity';
import { PharmacySale } from '../entities/pharmacy-sale.entity';
import { createMockRepository, createMockQueryBuilder, MockRepository } from 'src/test/helpers/mock-repository.factory';

const CLINIC_ID = 'clinic-1';

const makeSale = (overrides: Record<string, any> = {}) => ({
  id: 'sale-1',
  clinicId: CLINIC_ID,
  subtotal: 100,
  discount: 10,
  tax: 13,
  total: 103,
  ...overrides,
});

const makeInvoice = (overrides: Record<string, any> = {}) => ({
  id: 'inv-1',
  invoiceNumber: 'INV-202607-0001',
  saleId: 'sale-1',
  sale: makeSale(),
  status: InvoiceStatus.PENDING,
  total: 103,
  balance: 103,
  amountPaid: 0,
  ...overrides,
});

describe('PharmacyInvoicesService', () => {
  let service: PharmacyInvoicesService;
  let invoiceRepo: MockRepository<PharmacyInvoice>;
  let saleRepo: MockRepository<PharmacySale>;

  beforeEach(async () => {
    invoiceRepo = createMockRepository<PharmacyInvoice>();
    saleRepo = createMockRepository<PharmacySale>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PharmacyInvoicesService,
        { provide: getRepositoryToken(PharmacyInvoice), useValue: invoiceRepo },
        { provide: getRepositoryToken(PharmacySale), useValue: saleRepo },
      ],
    }).compile();

    service = module.get<PharmacyInvoicesService>(PharmacyInvoicesService);
  });

  describe('create', () => {
    const dto = { saleId: 'sale-1', patientName: 'Juan Pérez', invoiceDate: '2026-07-01' } as any;

    it('lanza NotFoundException si la venta no existe', async () => {
      (saleRepo.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.create(dto, 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('lanza BadRequestException si ya existe una factura para esa venta', async () => {
      (saleRepo.findOne as jest.Mock).mockResolvedValue(makeSale());
      (invoiceRepo.findOne as jest.Mock).mockResolvedValue(makeInvoice());

      await expect(service.create(dto, 'user-1')).rejects.toThrow(BadRequestException);
    });

    it('crea la factura copiando los montos de la venta y generando el número correlativo', async () => {
      (saleRepo.findOne as jest.Mock).mockResolvedValue(makeSale({ subtotal: 200, discount: 0, tax: 26, total: 226 }));
      (invoiceRepo.findOne as jest.Mock).mockResolvedValue(null);
      (invoiceRepo.count as jest.Mock).mockResolvedValue(4);
      (invoiceRepo.create as jest.Mock).mockImplementation(x => x);
      (invoiceRepo.save as jest.Mock).mockImplementation(x => Promise.resolve(x));

      const result = await service.create(dto, 'user-1');

      expect(invoiceRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          saleId: 'sale-1',
          subtotal: 200,
          tax: 26,
          total: 226,
          balance: 226,
          status: InvoiceStatus.PENDING,
          createdById: 'user-1',
          invoiceNumber: expect.stringMatching(/^INV-\d{6}-0005$/),
        }),
      );
      expect(result.total).toBe(226);
    });
  });

  describe('findAll', () => {
    it('lanza BadRequestException si no se pasa clinicId', async () => {
      await expect(service.findAll(undefined)).rejects.toThrow(BadRequestException);
    });

    it('filtra por clínica vía join a createdBy.clinic', async () => {
      const qb = createMockQueryBuilder({ getMany: jest.fn().mockResolvedValue([makeInvoice()]) });
      (invoiceRepo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

      const result = await service.findAll(CLINIC_ID);

      expect(qb.andWhere).toHaveBeenCalledWith('clinic.id = :clinicId', { clinicId: CLINIC_ID });
      expect(result).toHaveLength(1);
    });
  });

  describe('findOne', () => {
    it('lanza BadRequestException si no se pasa clinicId', async () => {
      await expect(service.findOne('inv-1', undefined)).rejects.toThrow(BadRequestException);
    });

    it('lanza NotFoundException si la factura no existe', async () => {
      (invoiceRepo.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.findOne('inv-1', CLINIC_ID)).rejects.toThrow(NotFoundException);
    });

    it('lanza ForbiddenException si la clínica de la venta no coincide', async () => {
      (invoiceRepo.findOne as jest.Mock).mockResolvedValue(
        makeInvoice({ sale: makeSale({ clinicId: 'other-clinic' }) }),
      );

      await expect(service.findOne('inv-1', CLINIC_ID)).rejects.toThrow(ForbiddenException);
    });

    it('devuelve la factura si la clínica coincide', async () => {
      const invoice = makeInvoice();
      (invoiceRepo.findOne as jest.Mock).mockResolvedValue(invoice);

      const result = await service.findOne('inv-1', CLINIC_ID);

      expect(result).toBe(invoice);
    });
  });

  describe('update', () => {
    it('lanza BadRequestException si la factura ya está pagada', async () => {
      (invoiceRepo.findOne as jest.Mock).mockResolvedValue(makeInvoice({ status: InvoiceStatus.PAID }));

      await expect(service.update('inv-1', { notes: 'x' } as any, CLINIC_ID)).rejects.toThrow(BadRequestException);
    });

    it('aplica los cambios y vuelve a leer la factura actualizada', async () => {
      const invoice = makeInvoice();
      (invoiceRepo.findOne as jest.Mock).mockResolvedValue(invoice);
      (invoiceRepo.save as jest.Mock).mockResolvedValue(invoice);

      const result = await service.update('inv-1', { notes: 'Actualizado' } as any, CLINIC_ID);

      expect(invoiceRepo.save).toHaveBeenCalledWith(expect.objectContaining({ notes: 'Actualizado' }));
      expect(invoiceRepo.findOne).toHaveBeenCalledTimes(2);
      expect(result).toBe(invoice);
    });
  });

  describe('updateStatus', () => {
    it('actualiza amountPaid y recalcula balance', async () => {
      const invoice = makeInvoice({ total: 100 });
      (invoiceRepo.findOne as jest.Mock).mockResolvedValue(invoice);
      (invoiceRepo.save as jest.Mock).mockImplementation(x => Promise.resolve(x));

      await service.updateStatus('inv-1', { status: InvoiceStatus.PENDING, amountPaid: 40 } as any, CLINIC_ID);

      expect(invoiceRepo.save).toHaveBeenCalledWith(expect.objectContaining({ amountPaid: 40, balance: 60 }));
    });

    it('setea paymentDate automáticamente al pasar a PAID si no tenía una', async () => {
      const invoice = makeInvoice({ paymentDate: undefined });
      (invoiceRepo.findOne as jest.Mock).mockResolvedValue(invoice);
      (invoiceRepo.save as jest.Mock).mockImplementation(x => Promise.resolve(x));

      await service.updateStatus('inv-1', { status: InvoiceStatus.PAID } as any, CLINIC_ID);

      expect(invoiceRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: InvoiceStatus.PAID, paymentDate: expect.any(Date) }),
      );
    });

    it('no pisa paymentDate si la factura ya tenía una', async () => {
      const existingDate = new Date('2026-01-01');
      const invoice = makeInvoice({ paymentDate: existingDate });
      (invoiceRepo.findOne as jest.Mock).mockResolvedValue(invoice);
      (invoiceRepo.save as jest.Mock).mockImplementation(x => Promise.resolve(x));

      await service.updateStatus('inv-1', { status: InvoiceStatus.PAID } as any, CLINIC_ID);

      expect(invoiceRepo.save).toHaveBeenCalledWith(expect.objectContaining({ paymentDate: existingDate }));
    });

    it('aplica paymentMethod, paymentReference y notes si vienen informados', async () => {
      const invoice = makeInvoice();
      (invoiceRepo.findOne as jest.Mock).mockResolvedValue(invoice);
      (invoiceRepo.save as jest.Mock).mockImplementation(x => Promise.resolve(x));

      await service.updateStatus(
        'inv-1',
        {
          status: InvoiceStatus.PENDING,
          paymentMethod: 'QR',
          paymentReference: 'REF-1',
          notes: 'Pago parcial',
        } as any,
        CLINIC_ID,
      );

      expect(invoiceRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ paymentMethod: 'QR', paymentReference: 'REF-1', notes: 'Pago parcial' }),
      );
    });
  });

  describe('remove', () => {
    it('lanza BadRequestException si la factura ya está pagada', async () => {
      (invoiceRepo.findOne as jest.Mock).mockResolvedValue(makeInvoice({ status: InvoiceStatus.PAID }));

      await expect(service.remove('inv-1', CLINIC_ID)).rejects.toThrow(BadRequestException);
    });

    it('elimina la factura si no está pagada', async () => {
      const invoice = makeInvoice();
      (invoiceRepo.findOne as jest.Mock).mockResolvedValue(invoice);

      await service.remove('inv-1', CLINIC_ID);

      expect(invoiceRepo.remove).toHaveBeenCalledWith(invoice);
    });
  });

  describe('getInvoicesByStatus', () => {
    it('lanza BadRequestException si no se pasa clinicId', async () => {
      await expect(service.getInvoicesByStatus(InvoiceStatus.PENDING, undefined)).rejects.toThrow(BadRequestException);
    });

    it('filtra por estado y clínica', async () => {
      const qb = createMockQueryBuilder({ getMany: jest.fn().mockResolvedValue([makeInvoice()]) });
      (invoiceRepo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

      await service.getInvoicesByStatus(InvoiceStatus.OVERDUE, CLINIC_ID);

      expect(qb.where).toHaveBeenCalledWith('invoice.status = :status', { status: InvoiceStatus.OVERDUE });
      expect(qb.andWhere).toHaveBeenCalledWith('clinic.id = :clinicId', { clinicId: CLINIC_ID });
    });
  });

  describe('getOverdueInvoices', () => {
    it('lanza BadRequestException si no se pasa clinicId', async () => {
      await expect(service.getOverdueInvoices(undefined)).rejects.toThrow(BadRequestException);
    });

    it('excluye facturas pagadas y canceladas', async () => {
      const qb = createMockQueryBuilder({ getMany: jest.fn().mockResolvedValue([]) });
      (invoiceRepo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

      await service.getOverdueInvoices(CLINIC_ID);

      expect(qb.andWhere).toHaveBeenCalledWith('invoice.status != :paidStatus', { paidStatus: InvoiceStatus.PAID });
      expect(qb.andWhere).toHaveBeenCalledWith('invoice.status != :cancelledStatus', {
        cancelledStatus: InvoiceStatus.CANCELLED,
      });
    });
  });

  describe('getTotalRevenue', () => {
    it('lanza BadRequestException si no se pasa clinicId', async () => {
      await expect(service.getTotalRevenue(undefined, undefined, undefined)).rejects.toThrow(BadRequestException);
    });

    it('suma amountPaid de facturas pagadas de la clínica', async () => {
      const qb = createMockQueryBuilder({ getRawOne: jest.fn().mockResolvedValue({ total: '1500.50' }) });
      (invoiceRepo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

      const result = await service.getTotalRevenue(undefined, undefined, CLINIC_ID);

      expect(result).toBe(1500.5);
    });

    it('agrega el rango de fechas cuando se pasan startDate y endDate', async () => {
      const qb = createMockQueryBuilder({ getRawOne: jest.fn().mockResolvedValue({ total: '0' }) });
      (invoiceRepo.createQueryBuilder as jest.Mock).mockReturnValue(qb);
      const start = new Date('2026-01-01');
      const end = new Date('2026-01-31');

      await service.getTotalRevenue(start, end, CLINIC_ID);

      expect(qb.andWhere).toHaveBeenCalledWith('invoice.paymentDate >= :startDate', { startDate: start });
      expect(qb.andWhere).toHaveBeenCalledWith('invoice.paymentDate <= :endDate', { endDate: end });
    });

    it('devuelve 0 si la suma es null', async () => {
      const qb = createMockQueryBuilder({ getRawOne: jest.fn().mockResolvedValue({ total: null }) });
      (invoiceRepo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

      const result = await service.getTotalRevenue(undefined, undefined, CLINIC_ID);

      expect(result).toBe(0);
    });
  });

  describe('getPendingAmount', () => {
    it('lanza BadRequestException si no se pasa clinicId', async () => {
      await expect(service.getPendingAmount(undefined)).rejects.toThrow(BadRequestException);
    });

    it('suma balance de facturas pendientes y vencidas', async () => {
      const qb = createMockQueryBuilder({ getRawOne: jest.fn().mockResolvedValue({ total: '320' }) });
      (invoiceRepo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

      const result = await service.getPendingAmount(CLINIC_ID);

      expect(qb.where).toHaveBeenCalledWith('invoice.status IN (:...statuses)', {
        statuses: [InvoiceStatus.PENDING, InvoiceStatus.OVERDUE],
      });
      expect(result).toBe(320);
    });
  });

  describe('markOverdueInvoices', () => {
    it('lanza BadRequestException si no se pasa clinicId', async () => {
      await expect(service.markOverdueInvoices(undefined)).rejects.toThrow(BadRequestException);
    });

    it('no ejecuta el update si no hay facturas vencidas', async () => {
      const qb = createMockQueryBuilder({
        getRawMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 0 }),
      });
      (invoiceRepo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

      await service.markOverdueInvoices(CLINIC_ID);

      expect(qb.execute).not.toHaveBeenCalled();
    });

    it('marca como OVERDUE las facturas pendientes vencidas', async () => {
      const qb = createMockQueryBuilder({
        getRawMany: jest.fn().mockResolvedValue([{ id: 'inv-1' }, { id: 'inv-2' }]),
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 2 }),
      });
      (invoiceRepo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

      await service.markOverdueInvoices(CLINIC_ID);

      expect(qb.set).toHaveBeenCalledWith({ status: InvoiceStatus.OVERDUE });
      expect(qb.where).toHaveBeenCalledWith('id IN (:...ids)', { ids: ['inv-1', 'inv-2'] });
      expect(qb.execute).toHaveBeenCalled();
    });
  });
});
