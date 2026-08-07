import { LabOrdersController } from './lab-orders.controller';
import { LabOrdersService } from './lab-orders.service';
import { LabOrderStatus } from './entities/lab-order.entity';
import { Patient } from '../patients/entities/patient.entity';
import { User } from '../users/entities/user.entity';

const makeReq = (overrides: Record<string, any> = {}) =>
  ({ headers: { 'x-clinic-id': 'clinic-1' }, params: {}, ...overrides }) as any;

describe('LabOrdersController', () => {
  let controller: LabOrdersController;
  let service: jest.Mocked<LabOrdersService>;

  beforeEach(() => {
    service = {
      create: jest.fn().mockResolvedValue({ id: 'order-1' }),
      findAll: jest.fn().mockResolvedValue({ items: [], total: 0 }),
      findOne: jest.fn().mockResolvedValue({ id: 'order-1', orderNumber: 'LAB-0001' }),
      update: jest.fn().mockResolvedValue({ id: 'order-1' }),
      setStatus: jest.fn().mockResolvedValue({ id: 'order-1' }),
      enterResult: jest.fn().mockResolvedValue({ id: 'order-1' }),
      remove: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<LabOrdersService>;
    controller = new LabOrdersController(service);
  });

  it('create resuelve clinicId y delega dto/user/paciente', async () => {
    const dto = { patientId: 'patient-1' } as any;
    const patient = { id: 'patient-1' } as Patient;
    const user = { id: 'user-1' } as User;

    await controller.create(dto, patient, user, makeReq());

    expect(service.create).toHaveBeenCalledWith(dto, user, 'clinic-1', patient);
  });

  describe('findAll', () => {
    it('usa page/pageSize por defecto (1/20) y limpia esos campos del filtro', async () => {
      await controller.findAll(makeReq(), undefined, undefined, { page: '2', pageSize: '5', status: 'requested' });

      expect(service.findAll).toHaveBeenCalledWith(1, 20, { status: 'requested' }, 'clinic-1');
    });

    it('convierte page/pageSize a número si vienen', async () => {
      await controller.findAll(makeReq(), 3, 15, {});
      expect(service.findAll).toHaveBeenCalledWith(3, 15, {}, 'clinic-1');
    });
  });

  it('findOne delega id y clinicId', async () => {
    await controller.findOne('order-1', makeReq());
    expect(service.findOne).toHaveBeenCalledWith('order-1', 'clinic-1');
  });

  it('update delega id, dto y clinicId', async () => {
    const dto = { clinicalNotes: 'x' } as any;
    await controller.update('order-1', dto, makeReq());
    expect(service.update).toHaveBeenCalledWith('order-1', dto, 'clinic-1');
  });

  it('setStatus delega id, status y clinicId', async () => {
    await controller.setStatus('order-1', LabOrderStatus.SAMPLE_COLLECTED, makeReq());
    expect(service.setStatus).toHaveBeenCalledWith('order-1', LabOrderStatus.SAMPLE_COLLECTED, 'clinic-1');
  });

  it('enterResult delega id, itemId, dto, user y clinicId', async () => {
    const dto = { resultValue: '14 g/dL' } as any;
    const user = { id: 'tech-1' } as User;
    await controller.enterResult('order-1', 'item-1', dto, user, makeReq());
    expect(service.enterResult).toHaveBeenCalledWith('order-1', 'item-1', dto, user, 'clinic-1');
  });

  it('remove delega id y clinicId', async () => {
    await controller.remove('order-1', makeReq());
    expect(service.remove).toHaveBeenCalledWith('order-1', 'clinic-1');
  });
});
