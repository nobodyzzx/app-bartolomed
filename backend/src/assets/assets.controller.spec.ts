import { AssetsController } from './assets.controller';
import { AssetsService } from './assets.service';
import { User } from '../users/entities/user.entity';

const makeReq = (overrides: Record<string, any> = {}) =>
  ({ headers: { 'x-clinic-id': 'clinic-1' }, params: {}, ...overrides }) as any;

describe('AssetsController', () => {
  let controller: AssetsController;
  let service: jest.Mocked<AssetsService>;
  const user = { id: 'user-1' } as User;

  beforeEach(() => {
    service = {
      create: jest.fn().mockResolvedValue({ id: 'asset-1' }),
      findAll: jest.fn().mockResolvedValue({ data: [], total: 0 }),
      getStats: jest.fn().mockResolvedValue({ total: 0 }),
      validateSerialNumber: jest.fn().mockResolvedValue({ available: true }),
      getUniqueValues: jest.fn().mockResolvedValue([]),
      findAllMaintenance: jest.fn().mockResolvedValue({ data: [], total: 0 }),
      getMaintenanceStats: jest.fn().mockResolvedValue({ total: 0 }),
      createMaintenance: jest.fn().mockResolvedValue({ id: 'maint-1' }),
      findOneMaintenance: jest.fn().mockResolvedValue({ id: 'maint-1' }),
      updateMaintenance: jest.fn().mockResolvedValue({ id: 'maint-1' }),
      deleteMaintenance: jest.fn().mockResolvedValue(undefined),
      findAllReports: jest.fn().mockResolvedValue({ data: [], total: 0 }),
      getReportsStats: jest.fn().mockResolvedValue({ total: 0 }),
      generateReport: jest.fn().mockResolvedValue({ id: 'report-1' }),
      downloadReport: jest.fn().mockResolvedValue({ fileName: 'reporte.csv', contentType: 'text/csv', content: 'a,b\n1,2' }),
      findOneReport: jest.fn().mockResolvedValue({ id: 'report-1' }),
      deleteReport: jest.fn().mockResolvedValue(undefined),
      update: jest.fn().mockResolvedValue({ id: 'asset-1' }),
      remove: jest.fn().mockResolvedValue(undefined),
      findOne: jest.fn().mockResolvedValue({ id: 'asset-1' }),
    } as unknown as jest.Mocked<AssetsService>;
    controller = new AssetsController(service);
  });

  it('create delega dto, userId y clinicId', async () => {
    const dto = { name: 'Ecógrafo' } as any;
    await controller.create(dto, user, makeReq());
    expect(service.create).toHaveBeenCalledWith(dto, 'user-1', 'clinic-1');
  });

  it('findAll delega filtros y clinicId', async () => {
    const filters = { type: 'medical_equipment' } as any;
    await controller.findAll(filters, makeReq());
    expect(service.findAll).toHaveBeenCalledWith(filters, 'clinic-1');
  });

  it('getStats delega clinicId', async () => {
    await controller.getStats(makeReq());
    expect(service.getStats).toHaveBeenCalledWith('clinic-1');
  });

  it('validateSerialNumber delega serial, excludeId y clinicId', async () => {
    await controller.validateSerialNumber('SN-001', 'asset-2', makeReq());
    expect(service.validateSerialNumber).toHaveBeenCalledWith('SN-001', 'asset-2', 'clinic-1');
  });

  it('validateSerialNumber resuelve clinicId undefined si no hay req', async () => {
    await controller.validateSerialNumber('SN-001', undefined, undefined);
    expect(service.validateSerialNumber).toHaveBeenCalledWith('SN-001', undefined, undefined);
  });

  it('getUniqueValues delega field y clinicId', async () => {
    await controller.getUniqueValues('category', makeReq());
    expect(service.getUniqueValues).toHaveBeenCalledWith('category', 'clinic-1');
  });

  it('findAllMaintenance delega filtros y clinicId', async () => {
    const filters = { status: 'scheduled' };
    await controller.findAllMaintenance(filters, makeReq());
    expect(service.findAllMaintenance).toHaveBeenCalledWith(filters, 'clinic-1');
  });

  it('getMaintenanceStats delega clinicId', async () => {
    await controller.getMaintenanceStats(makeReq());
    expect(service.getMaintenanceStats).toHaveBeenCalledWith('clinic-1');
  });

  it('createMaintenance delega data, userId y clinicId', async () => {
    const data = { title: 'Mantenimiento' } as any;
    await controller.createMaintenance(data, user, makeReq());
    expect(service.createMaintenance).toHaveBeenCalledWith(data, 'user-1', 'clinic-1');
  });

  it('findOneMaintenance delega id y clinicId', async () => {
    await controller.findOneMaintenance('maint-1', makeReq());
    expect(service.findOneMaintenance).toHaveBeenCalledWith('maint-1', 'clinic-1');
  });

  it('updateMaintenance delega id, data, clinicId y userId', async () => {
    const data = { status: 'completed' } as any;
    await controller.updateMaintenance('maint-1', data, makeReq(), user);
    expect(service.updateMaintenance).toHaveBeenCalledWith('maint-1', data, 'clinic-1', 'user-1');
  });

  it('deleteMaintenance delega id y clinicId', async () => {
    await controller.deleteMaintenance('maint-1', makeReq());
    expect(service.deleteMaintenance).toHaveBeenCalledWith('maint-1', 'clinic-1');
  });

  it('findAllReports delega filtros y clinicId', async () => {
    const filters = { type: 'status' };
    await controller.findAllReports(filters, makeReq());
    expect(service.findAllReports).toHaveBeenCalledWith(filters, 'clinic-1');
  });

  it('getReportsStats delega clinicId', async () => {
    await controller.getReportsStats(makeReq());
    expect(service.getReportsStats).toHaveBeenCalledWith('clinic-1');
  });

  it('generateReport delega data, userId y clinicId', async () => {
    const data = { type: 'status' } as any;
    await controller.generateReport(data, user, makeReq());
    expect(service.generateReport).toHaveBeenCalledWith(data, 'user-1', 'clinic-1');
  });

  it('findOneReport delega id y clinicId', async () => {
    await controller.findOneReport('report-1', makeReq());
    expect(service.findOneReport).toHaveBeenCalledWith('report-1', 'clinic-1');
  });

  it('downloadReport arma la respuesta HTTP con Content-Type/Content-Disposition y envía el contenido (endpoint nuevo, antes no existía)', async () => {
    const res = { setHeader: jest.fn(), send: jest.fn() } as any;
    await controller.downloadReport('report-1', res, makeReq());
    expect(service.downloadReport).toHaveBeenCalledWith('report-1', 'clinic-1');
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
    expect(res.setHeader).toHaveBeenCalledWith('Content-Disposition', 'attachment; filename="reporte.csv"');
    expect(res.send).toHaveBeenCalledWith('a,b\n1,2');
  });

  it('deleteReport delega id y clinicId', async () => {
    await controller.deleteReport('report-1', makeReq());
    expect(service.deleteReport).toHaveBeenCalledWith('report-1', 'clinic-1');
  });

  it('update delega id, dto y clinicId', async () => {
    const dto = { name: 'Actualizado' } as any;
    await controller.update('asset-1', dto, makeReq());
    expect(service.update).toHaveBeenCalledWith('asset-1', dto, 'clinic-1');
  });

  it('remove delega id y clinicId', async () => {
    await controller.remove('asset-1', makeReq());
    expect(service.remove).toHaveBeenCalledWith('asset-1', 'clinic-1');
  });

  it('findOne delega id y clinicId', async () => {
    await controller.findOne('asset-1', makeReq());
    expect(service.findOne).toHaveBeenCalledWith('asset-1', 'clinic-1');
  });
});
