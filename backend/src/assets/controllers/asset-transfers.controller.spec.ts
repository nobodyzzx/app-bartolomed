import { AssetTransfersController } from './asset-transfers.controller';
import { AssetTransfersService } from '../services/asset-transfers.service';
import { User } from '../../users/entities/user.entity';

const makeReq = (overrides: Record<string, any> = {}) =>
  ({ headers: { 'x-clinic-id': 'clinic-1' }, params: {}, ...overrides }) as any;

describe('AssetTransfersController', () => {
  let controller: AssetTransfersController;
  let service: jest.Mocked<AssetTransfersService>;
  const user = { id: 'user-1' } as User;

  beforeEach(() => {
    service = {
      create: jest.fn().mockResolvedValue({ id: 'transfer-1' }),
      findAll: jest.fn().mockResolvedValue({ data: [], total: 0 }),
      getPendingCount: jest.fn().mockResolvedValue(2),
      findOne: jest.fn().mockResolvedValue({ id: 'transfer-1' }),
      getAuditLog: jest.fn().mockResolvedValue([]),
      dispatch: jest.fn().mockResolvedValue({ id: 'transfer-1' }),
      confirmReceipt: jest.fn().mockResolvedValue({ id: 'transfer-1' }),
      reject: jest.fn().mockResolvedValue({ id: 'transfer-1' }),
      returnTransfer: jest.fn().mockResolvedValue({ id: 'transfer-1' }),
    } as unknown as jest.Mocked<AssetTransfersService>;
    controller = new AssetTransfersController(service);
  });

  it('create delega dto, userId y clinicId', async () => {
    const dto = { assetId: 'asset-1', targetClinicId: 'clinic-2' } as any;
    await controller.create(dto, user, makeReq());
    expect(service.create).toHaveBeenCalledWith(dto, 'user-1', 'clinic-1');
  });

  it('findAll delega clinicId y filtros', async () => {
    const filters = { status: 'pending' } as any;
    await controller.findAll(filters, makeReq());
    expect(service.findAll).toHaveBeenCalledWith('clinic-1', filters);
  });

  it('getPendingCount delega clinicId', async () => {
    await controller.getPendingCount(makeReq());
    expect(service.getPendingCount).toHaveBeenCalledWith('clinic-1');
  });

  it('findOne delega id y clinicId', async () => {
    await controller.findOne('transfer-1', makeReq());
    expect(service.findOne).toHaveBeenCalledWith('transfer-1', 'clinic-1');
  });

  it('getAuditLog delega id y clinicId', async () => {
    await controller.getAuditLog('transfer-1', makeReq());
    expect(service.getAuditLog).toHaveBeenCalledWith('transfer-1', 'clinic-1');
  });

  it('dispatch delega id, dto, userId y clinicId', async () => {
    const dto = { notes: 'x' } as any;
    await controller.dispatch('transfer-1', dto, user, makeReq());
    expect(service.dispatch).toHaveBeenCalledWith('transfer-1', dto, 'user-1', 'clinic-1');
  });

  it('confirmReceipt delega id, dto, userId y clinicId', async () => {
    const dto = { notes: 'x' } as any;
    await controller.confirmReceipt('transfer-1', dto, user, makeReq());
    expect(service.confirmReceipt).toHaveBeenCalledWith('transfer-1', dto, 'user-1', 'clinic-1');
  });

  it('reject delega id, dto, userId y clinicId', async () => {
    const dto = { reason: 'x' } as any;
    await controller.reject('transfer-1', dto, user, makeReq());
    expect(service.reject).toHaveBeenCalledWith('transfer-1', dto, 'user-1', 'clinic-1');
  });

  it('returnTransfer delega id, dto, userId y clinicId', async () => {
    const dto = { reason: 'x' } as any;
    await controller.returnTransfer('transfer-1', dto, user, makeReq());
    expect(service.returnTransfer).toHaveBeenCalledWith('transfer-1', dto, 'user-1', 'clinic-1');
  });
});
