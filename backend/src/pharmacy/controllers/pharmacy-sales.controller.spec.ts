import { PharmacySalesController } from './pharmacy-sales.controller';
import { PharmacySalesService } from '../services/pharmacy-sales.service';

const makeReq = (overrides: Record<string, any> = {}) => ({
  user: { id: 'user-1', sub: 'user-1', email: 'doc@example.com' },
  headers: { 'x-clinic-id': 'clinic-1' },
  params: {},
  ip: '10.0.0.1',
  ...overrides,
});

describe('PharmacySalesController', () => {
  let controller: PharmacySalesController;
  let service: jest.Mocked<PharmacySalesService>;

  beforeEach(() => {
    service = {
      create: jest.fn().mockResolvedValue({ id: 'sale-1' }),
      listWithFilters: jest.fn().mockResolvedValue({ data: [], total: 0 }),
      getDailySalesTotal: jest.fn().mockResolvedValue(500),
      getSalesSummary: jest.fn().mockResolvedValue({ total: 0 }),
      findOne: jest.fn().mockResolvedValue({ id: 'sale-1' }),
      update: jest.fn().mockResolvedValue({ id: 'sale-1' }),
      updateStatus: jest.fn().mockResolvedValue({ id: 'sale-1' }),
      adjustPayment: jest.fn().mockResolvedValue({ id: 'sale-1' }),
      remove: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<PharmacySalesService>;
    controller = new PharmacySalesController(service);
  });

  describe('create', () => {
    it('usa req.user.id como soldById y resuelve clinicId', async () => {
      const dto = { items: [] } as any;
      await controller.create(dto, makeReq());
      expect(service.create).toHaveBeenCalledWith(dto, 'user-1', 'clinic-1');
    });

    it('cae a req.user.sub si no hay id', async () => {
      const dto = { items: [] } as any;
      await controller.create(dto, makeReq({ user: { sub: 'user-9' } }));
      expect(service.create).toHaveBeenCalledWith(dto, 'user-9', 'clinic-1');
    });

    it('lanza Error si no hay id ni sub en el usuario', () => {
      const dto = { items: [] } as any;
      expect(() => controller.create(dto, makeReq({ user: undefined }))).toThrow('User ID not found in request');
      expect(service.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('arma el objeto de filtros con paginación, fechas parseadas y clinicId', async () => {
      await controller.findAll(2, 50, 'completed' as any, 'cash', '2026-01-01', '2026-01-31', makeReq());

      expect(service.listWithFilters).toHaveBeenCalledWith({
        status: 'completed',
        clinicId: 'clinic-1',
        paymentMethod: 'cash',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-01-31'),
        page: 2,
        limit: 50,
      });
    });

    it('deja startDate/endDate undefined si no vienen', async () => {
      await controller.findAll(1, 25, undefined, undefined, undefined, undefined, makeReq());
      const filters = service.listWithFilters.mock.calls[0][0];
      expect(filters.startDate).toBeUndefined();
      expect(filters.endDate).toBeUndefined();
    });
  });

  it('getDailyTotal parsea la fecha y resuelve clinicId', async () => {
    await controller.getDailyTotal('2026-01-15', makeReq());
    expect(service.getDailySalesTotal).toHaveBeenCalledWith(new Date('2026-01-15'), 'clinic-1');
  });

  it('getSummary parsea fechas opcionales y resuelve clinicId', async () => {
    await controller.getSummary('2026-01-01', '2026-01-31', makeReq());
    expect(service.getSalesSummary).toHaveBeenCalledWith(new Date('2026-01-01'), new Date('2026-01-31'), 'clinic-1');
  });

  it('findOne delega solo el id (sin scoping por clínica a nivel de controller)', async () => {
    await controller.findOne('sale-1');
    expect(service.findOne).toHaveBeenCalledWith('sale-1');
  });

  it('update delega id y dto', async () => {
    const dto = { notes: 'x' } as any;
    await controller.update('sale-1', dto);
    expect(service.update).toHaveBeenCalledWith('sale-1', dto);
  });

  it('updateStatus delega id y dto', async () => {
    const dto = { status: 'completed' } as any;
    await controller.updateStatus('sale-1', dto);
    expect(service.updateStatus).toHaveBeenCalledWith('sale-1', dto);
  });

  describe('adjustPayment', () => {
    it('arma el actor con nombre completo desde personalInfo', async () => {
      const dto = { amountPaid: 100 } as any;
      const req = makeReq({
        user: { id: 'user-1', email: 'doc@example.com', personalInfo: { firstName: 'Ana', lastName: 'Perez' } },
      });

      await controller.adjustPayment('sale-1', dto, req);

      expect(service.adjustPayment).toHaveBeenCalledWith('sale-1', dto, {
        id: 'user-1',
        email: 'doc@example.com',
        name: 'Ana Perez',
        clinicId: 'clinic-1',
        ip: '10.0.0.1',
      });
    });

    it('deja name undefined si no hay personalInfo', async () => {
      const dto = { amountPaid: 100 } as any;
      await controller.adjustPayment('sale-1', dto, makeReq());
      const actor = service.adjustPayment.mock.calls[0][2];
      expect(actor.name).toBeUndefined();
    });
  });

  it('remove delega el id', async () => {
    await controller.remove('sale-1');
    expect(service.remove).toHaveBeenCalledWith('sale-1');
  });
});
