import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';
import { FilterAuditDto } from './dto/filter-audit.dto';

describe('AuditController', () => {
  let controller: AuditController;
  let auditService: jest.Mocked<AuditService>;

  beforeEach(() => {
    auditService = {
      findAll: jest.fn().mockResolvedValue({ data: [], total: 0 }),
      getStats: jest.fn().mockResolvedValue({ total: 0 }),
      getDailyActivity: jest.fn().mockResolvedValue([]),
      getDistinctValues: jest.fn().mockResolvedValue({ actions: [], resources: [] }),
    } as unknown as jest.Mocked<AuditService>;
    controller = new AuditController(auditService);
  });

  it('findAll delega el filtro completo en auditService.findAll()', async () => {
    const filter: FilterAuditDto = { page: 2, limit: 10 } as FilterAuditDto;
    const result = await controller.findAll(filter);
    expect(auditService.findAll).toHaveBeenCalledWith(filter);
    expect(result).toEqual({ data: [], total: 0 });
  });

  it('getStats pasa startDate y endDate tal cual', async () => {
    await controller.getStats('2026-01-01', '2026-01-31');
    expect(auditService.getStats).toHaveBeenCalledWith('2026-01-01', '2026-01-31');
  });

  it('getStats funciona sin fechas (ambas opcionales)', async () => {
    await controller.getStats();
    expect(auditService.getStats).toHaveBeenCalledWith(undefined, undefined);
  });

  it('getDailyActivity pasa startDate y endDate tal cual', async () => {
    await controller.getDailyActivity('2026-01-01', '2026-01-31');
    expect(auditService.getDailyActivity).toHaveBeenCalledWith('2026-01-01', '2026-01-31');
  });

  it('getDistinctValues delega sin argumentos', async () => {
    const result = await controller.getDistinctValues();
    expect(auditService.getDistinctValues).toHaveBeenCalled();
    expect(result).toEqual({ actions: [], resources: [] });
  });
});
