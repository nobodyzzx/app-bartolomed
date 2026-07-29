import { PharmacyInvoicesController } from './pharmacy-invoices.controller';
import { PharmacyInvoicesService } from '../services/pharmacy-invoices.service';
import { InvoiceStatus } from '../entities/pharmacy-invoice.entity';

const makeReq = (overrides: Record<string, any> = {}) => ({
  user: { sub: 'user-1' },
  headers: { 'x-clinic-id': 'clinic-1' },
  params: {},
  ...overrides,
});

describe('PharmacyInvoicesController', () => {
  let controller: PharmacyInvoicesController;
  let service: jest.Mocked<PharmacyInvoicesService>;

  beforeEach(() => {
    service = {
      create: jest.fn().mockResolvedValue({ id: 'inv-1' }),
      findAll: jest.fn().mockResolvedValue([{ id: 'inv-1' }]),
      getInvoicesByStatus: jest.fn().mockResolvedValue([{ id: 'inv-1', status: InvoiceStatus.PAID }]),
      getOverdueInvoices: jest.fn().mockResolvedValue([]),
      getTotalRevenue: jest.fn().mockResolvedValue(1000),
      getPendingAmount: jest.fn().mockResolvedValue(200),
      findOne: jest.fn().mockResolvedValue({ id: 'inv-1' }),
      update: jest.fn().mockResolvedValue({ id: 'inv-1' }),
      updateStatus: jest.fn().mockResolvedValue({ id: 'inv-1' }),
      markOverdueInvoices: jest.fn().mockResolvedValue(undefined),
      remove: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<PharmacyInvoicesService>;
    controller = new PharmacyInvoicesController(service);
  });

  describe('create', () => {
    it('usa req.user.sub como createdById', async () => {
      const dto = { saleId: 'sale-1' } as any;
      await controller.create(dto, makeReq());
      expect(service.create).toHaveBeenCalledWith(dto, 'user-1');
    });

    it('usa "system" como fallback si no hay usuario en el request', async () => {
      const dto = { saleId: 'sale-1' } as any;
      await controller.create(dto, makeReq({ user: undefined }));
      expect(service.create).toHaveBeenCalledWith(dto, 'system');
    });
  });

  describe('findAll', () => {
    it('delega en getInvoicesByStatus si viene el query param status', async () => {
      await controller.findAll(InvoiceStatus.OVERDUE, makeReq());
      expect(service.getInvoicesByStatus).toHaveBeenCalledWith(InvoiceStatus.OVERDUE, 'clinic-1');
      expect(service.findAll).not.toHaveBeenCalled();
    });

    it('delega en findAll si no viene status', async () => {
      await controller.findAll(undefined, makeReq());
      expect(service.findAll).toHaveBeenCalledWith('clinic-1');
    });

    it('resuelve clinicId undefined si no viene req', async () => {
      await controller.findAll(undefined, undefined);
      expect(service.findAll).toHaveBeenCalledWith(undefined);
    });
  });

  it('getOverdue resuelve clinicId del request', async () => {
    await controller.getOverdue(makeReq());
    expect(service.getOverdueInvoices).toHaveBeenCalledWith('clinic-1');
  });

  describe('getTotalRevenue', () => {
    it('convierte startDate/endDate a Date si vienen informados', async () => {
      await controller.getTotalRevenue('2026-01-01', '2026-01-31', makeReq());
      const [start, end, clinicId] = service.getTotalRevenue.mock.calls[0];
      expect(start).toEqual(new Date('2026-01-01'));
      expect(end).toEqual(new Date('2026-01-31'));
      expect(clinicId).toBe('clinic-1');
    });

    it('pasa undefined si no vienen fechas', async () => {
      await controller.getTotalRevenue(undefined, undefined, makeReq());
      expect(service.getTotalRevenue).toHaveBeenCalledWith(undefined, undefined, 'clinic-1');
    });
  });

  it('getPendingAmount resuelve clinicId del request', async () => {
    await controller.getPendingAmount(makeReq());
    expect(service.getPendingAmount).toHaveBeenCalledWith('clinic-1');
  });

  it('findOne delega id y clinicId', async () => {
    await controller.findOne('inv-1', makeReq());
    expect(service.findOne).toHaveBeenCalledWith('inv-1', 'clinic-1');
  });

  it('update delega id, dto y clinicId', async () => {
    const dto = { notes: 'x' } as any;
    await controller.update('inv-1', dto, makeReq());
    expect(service.update).toHaveBeenCalledWith('inv-1', dto, 'clinic-1');
  });

  it('updateStatus delega id, dto y clinicId', async () => {
    const dto = { status: InvoiceStatus.PAID } as any;
    await controller.updateStatus('inv-1', dto, makeReq());
    expect(service.updateStatus).toHaveBeenCalledWith('inv-1', dto, 'clinic-1');
  });

  it('markOverdue resuelve clinicId del request', async () => {
    await controller.markOverdue(makeReq());
    expect(service.markOverdueInvoices).toHaveBeenCalledWith('clinic-1');
  });

  it('remove delega id y clinicId', async () => {
    await controller.remove('inv-1', makeReq());
    expect(service.remove).toHaveBeenCalledWith('inv-1', 'clinic-1');
  });
});
