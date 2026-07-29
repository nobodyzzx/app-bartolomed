import { PurchaseOrdersController } from './purchase-orders.controller';
import { PurchaseOrdersService } from '../services/purchase-orders.service';
import { PurchaseOrderStatus } from '../entities/purchase-order.entity';
import { User } from '../../users/entities/user.entity';

const makeReq = (overrides: Record<string, any> = {}) => ({
  headers: { 'x-clinic-id': 'clinic-1' },
  params: {},
  ...overrides,
});

describe('PurchaseOrdersController', () => {
  let controller: PurchaseOrdersController;
  let service: jest.Mocked<PurchaseOrdersService>;
  let medicationRepo: { find: jest.Mock };

  beforeEach(() => {
    service = {
      create: jest.fn().mockResolvedValue({ id: 'po-1' }),
      getOrdersByStatus: jest.fn().mockResolvedValue([{ id: 'po-1' }]),
      getOrdersBySupplier: jest.fn().mockResolvedValue([{ id: 'po-1' }]),
      findAll: jest.fn().mockResolvedValue([{ id: 'po-1' }]),
      findOne: jest.fn().mockResolvedValue({ id: 'po-1' }),
      update: jest.fn().mockResolvedValue({ id: 'po-1' }),
      updateStatus: jest.fn().mockResolvedValue({ id: 'po-1' }),
      receive: jest.fn().mockResolvedValue({ id: 'po-1' }),
      remove: jest.fn().mockResolvedValue(undefined),
      backfillMedicationIds: jest.fn().mockResolvedValue({ updated: 3 }),
    } as unknown as jest.Mocked<PurchaseOrdersService>;
    medicationRepo = { find: jest.fn().mockResolvedValue([{ id: 'med-1' }]) };
    controller = new PurchaseOrdersController(service, medicationRepo as any);
  });

  describe('create', () => {
    it('setea el clinicId resuelto en el dto antes de delegar', async () => {
      const dto = { supplierId: 'sup-1', items: [] } as any;
      const user = { id: 'user-1' } as User;

      await controller.create(dto, user, makeReq());

      expect(dto.clinicId).toBe('clinic-1');
      expect(service.create).toHaveBeenCalledWith(dto, 'user-1');
    });

    it('no toca dto.clinicId si no se puede resolver', async () => {
      const dto = { supplierId: 'sup-1', items: [] } as any;
      await controller.create(dto, { id: 'user-1' } as User, makeReq({ headers: {} }));
      expect(dto.clinicId).toBeUndefined();
    });
  });

  describe('findAll', () => {
    it('prioriza status sobre supplierId si ambos vienen', async () => {
      await controller.findAll(PurchaseOrderStatus.PENDING, 'sup-1', makeReq());
      expect(service.getOrdersByStatus).toHaveBeenCalledWith(PurchaseOrderStatus.PENDING, 'clinic-1');
      expect(service.getOrdersBySupplier).not.toHaveBeenCalled();
    });

    it('delega en getOrdersBySupplier si solo viene supplierId', async () => {
      await controller.findAll(undefined, 'sup-1', makeReq());
      expect(service.getOrdersBySupplier).toHaveBeenCalledWith('sup-1', 'clinic-1');
    });

    it('delega en findAll si no vienen filtros', async () => {
      await controller.findAll(undefined, undefined, makeReq());
      expect(service.findAll).toHaveBeenCalledWith('clinic-1');
    });
  });

  it('findOne delega id y clinicId', async () => {
    await controller.findOne('po-1', makeReq());
    expect(service.findOne).toHaveBeenCalledWith('po-1', 'clinic-1');
  });

  it('update delega id, dto y clinicId', async () => {
    const dto = { notes: 'x' } as any;
    await controller.update('po-1', dto, makeReq());
    expect(service.update).toHaveBeenCalledWith('po-1', dto, 'clinic-1');
  });

  it('updateStatus delega id, dto, userId y clinicId', async () => {
    const dto = { status: PurchaseOrderStatus.APPROVED } as any;
    await controller.updateStatus('po-1', dto, { id: 'user-1' } as User, makeReq());
    expect(service.updateStatus).toHaveBeenCalledWith('po-1', dto, 'user-1', 'clinic-1');
  });

  it('receive delega id, dto y clinicId', async () => {
    const dto = { items: [] } as any;
    await controller.receive('po-1', dto, makeReq());
    expect(service.receive).toHaveBeenCalledWith('po-1', dto, 'clinic-1');
  });

  it('remove delega id y clinicId', async () => {
    await controller.remove('po-1', makeReq());
    expect(service.remove).toHaveBeenCalledWith('po-1', 'clinic-1');
  });

  it('backfillMedicationIds busca medicamentos activos y delega el resultado combinado', async () => {
    const result = await controller.backfillMedicationIds();

    expect(medicationRepo.find).toHaveBeenCalledWith({
      select: ['id', 'name', 'brandName', 'code'],
      where: { isActive: true },
    });
    expect(service.backfillMedicationIds).toHaveBeenCalledWith([{ id: 'med-1' }]);
    expect(result).toEqual({ message: 'Backfill ejecutado', updated: 3 });
  });
});
