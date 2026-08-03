import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';
import { FilterAuditDto } from './dto/filter-audit.dto';
import { User } from '../users/entities/user.entity';

describe('AuditController', () => {
  let controller: AuditController;
  let auditService: jest.Mocked<AuditService>;

  const actor = { id: 'admin-1', roles: ['admin'] } as unknown as User;
  const req = { headers: { 'x-clinic-id': 'clinic-1' }, params: {} } as any;

  beforeEach(() => {
    auditService = {
      findAll: jest.fn().mockResolvedValue({ data: [], total: 0 }),
      getStats: jest.fn().mockResolvedValue({ total: 0 }),
      getDailyActivity: jest.fn().mockResolvedValue([]),
      getDistinctValues: jest.fn().mockResolvedValue({ actions: [], resources: [] }),
    } as unknown as jest.Mocked<AuditService>;
    controller = new AuditController(auditService);
  });

  it('findAll delega el filtro completo, el actor y el clinicId en auditService.findAll()', async () => {
    // Bug real de test previo: usaba `limit`, campo que no existe en
    // FilterAuditDto (es `pageSize`) — pasaba igual porque el controller no
    // aplica ValidationPipe al llamarlo directo.
    const filter: FilterAuditDto = { page: 2, pageSize: 10 } as FilterAuditDto;
    const result = await controller.findAll(filter, actor, req);
    expect(auditService.findAll).toHaveBeenCalledWith(filter, actor, 'clinic-1');
    expect(result).toEqual({ data: [], total: 0 });
  });

  it('getStats pasa startDate, endDate, actor y clinicId', async () => {
    await controller.getStats('2026-01-01', '2026-01-31', actor, req);
    expect(auditService.getStats).toHaveBeenCalledWith('2026-01-01', '2026-01-31', actor, 'clinic-1');
  });

  it('getStats funciona sin fechas (ambas opcionales)', async () => {
    await controller.getStats(undefined, undefined, actor, req);
    expect(auditService.getStats).toHaveBeenCalledWith(undefined, undefined, actor, 'clinic-1');
  });

  it('getDailyActivity pasa startDate, endDate, actor y clinicId', async () => {
    await controller.getDailyActivity('2026-01-01', '2026-01-31', actor, req);
    expect(auditService.getDailyActivity).toHaveBeenCalledWith('2026-01-01', '2026-01-31', actor, 'clinic-1');
  });

  it('getDistinctValues delega el actor y el clinicId', async () => {
    const result = await controller.getDistinctValues(actor, req);
    expect(auditService.getDistinctValues).toHaveBeenCalledWith(actor, 'clinic-1');
    expect(result).toEqual({ actions: [], resources: [] });
  });
});
