import { StockTransfersController } from './stock-transfers.controller';
import { StockTransfersService } from '../services/stock-transfers.service';
import { TransferStatus } from '../entities/stock-transfer.entity';
import { User } from '../../users/entities/user.entity';

const makeReq = (overrides: Record<string, any> = {}) =>
  ({ headers: { 'x-clinic-id': 'clinic-1' }, params: {}, ...overrides }) as any;

describe('StockTransfersController', () => {
  let controller: StockTransfersController;
  let service: jest.Mocked<StockTransfersService>;
  const user = { id: 'user-1' } as User;

  beforeEach(() => {
    service = {
      create: jest.fn().mockResolvedValue({ id: 'transfer-1' }),
      getPendingCount: jest.fn().mockResolvedValue(3),
      findAll: jest.fn().mockResolvedValue({ data: [], total: 0 }),
      findOne: jest.fn().mockResolvedValue({ id: 'transfer-1' }),
      getAuditLog: jest.fn().mockResolvedValue([]),
      dispatch: jest.fn().mockResolvedValue({ id: 'transfer-1' }),
      confirmReceipt: jest.fn().mockResolvedValue({ id: 'transfer-1' }),
      reject: jest.fn().mockResolvedValue({ id: 'transfer-1' }),
      returnTransfer: jest.fn().mockResolvedValue({ id: 'transfer-1' }),
    } as unknown as jest.Mocked<StockTransfersService>;
    controller = new StockTransfersController(service);
  });

  it('create resuelve el clinicId destino y delega dto/user', async () => {
    const dto = { sourceClinicId: 'clinic-2', items: [] } as any;
    await controller.create(dto, user, makeReq());
    expect(service.create).toHaveBeenCalledWith(dto, user, 'clinic-1');
  });

  it('getPendingCount delega clinicId', async () => {
    await controller.getPendingCount(makeReq());
    expect(service.getPendingCount).toHaveBeenCalledWith('clinic-1');
  });

  it('findAll delega clinicId, status, page y limit', async () => {
    await controller.findAll(makeReq(), TransferStatus.IN_TRANSIT, 2, 10);
    expect(service.findAll).toHaveBeenCalledWith('clinic-1', TransferStatus.IN_TRANSIT, 2, 10);
  });

  it('findOne delega id y clinicId', async () => {
    await controller.findOne('transfer-1', makeReq());
    expect(service.findOne).toHaveBeenCalledWith('transfer-1', 'clinic-1');
  });

  it('getAuditLog delega id y clinicId', async () => {
    await controller.getAuditLog('transfer-1', makeReq());
    expect(service.getAuditLog).toHaveBeenCalledWith('transfer-1', 'clinic-1');
  });

  it('dispatch resuelve clinicId origen y delega id/dto/user', async () => {
    const dto = { notes: 'x' } as any;
    await controller.dispatch('transfer-1', dto, user, makeReq());
    expect(service.dispatch).toHaveBeenCalledWith('transfer-1', user, dto, 'clinic-1');
  });

  it('confirmReceipt resuelve clinicId destino y delega id/dto/user', async () => {
    const dto = { items: [] } as any;
    await controller.confirmReceipt('transfer-1', dto, user, makeReq());
    expect(service.confirmReceipt).toHaveBeenCalledWith('transfer-1', user, dto, 'clinic-1');
  });

  it('reject resuelve clinicId origen y delega id/dto/user', async () => {
    const dto = { reason: 'x' } as any;
    await controller.reject('transfer-1', dto, user, makeReq());
    expect(service.reject).toHaveBeenCalledWith('transfer-1', user, dto, 'clinic-1');
  });

  it('returnTransfer resuelve clinicId destino y delega id/dto/user', async () => {
    const dto = { reason: 'x' } as any;
    await controller.returnTransfer('transfer-1', dto, user, makeReq());
    expect(service.returnTransfer).toHaveBeenCalledWith('transfer-1', user, dto, 'clinic-1');
  });
});
