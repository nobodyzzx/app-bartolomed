import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuditService } from './audit.service';
import { AuditLog } from './entities/audit-log.entity';
import { createMockQueryBuilder, createMockRepository, MockRepository } from 'src/test/helpers/mock-repository.factory';
import { User } from '../users/entities/user.entity';

const ACTIVE_CLINIC = 'clinic-1';
const OTHER_CLINIC = 'clinic-2';

const makeAdmin = () => ({ id: 'admin-1', roles: ['admin'] }) as unknown as User;
const makeSuperAdmin = () => ({ id: 'super-1', roles: ['super-admin', 'admin'] }) as unknown as User;

describe('AuditService', () => {
  let service: AuditService;
  let auditLogRepo: MockRepository<AuditLog>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AuditService, { provide: getRepositoryToken(AuditLog), useValue: createMockRepository() }],
    }).compile();

    service = module.get<AuditService>(AuditService);
    auditLogRepo = module.get(getRepositoryToken(AuditLog));
  });

  afterEach(() => jest.clearAllMocks());

  // Bug real: findAll/getStats/getDailyActivity/getDistinctValues nunca
  // filtraban por clínica — un ADMIN podía ver auditoría de otras clínicas.
  describe('findAll — scoping por clínica', () => {
    it('filtra por clinicId cuando el actor es ADMIN', async () => {
      const qb = createMockQueryBuilder({ getManyAndCount: jest.fn().mockResolvedValue([[], 0]) });
      auditLogRepo.createQueryBuilder!.mockReturnValue(qb);

      await service.findAll({} as any, makeAdmin(), ACTIVE_CLINIC);

      expect(qb.andWhere).toHaveBeenCalledWith('log.clinicId = :scopedClinicId', { scopedClinicId: ACTIVE_CLINIC });
    });

    it('NO filtra por clinicId cuando el actor es SUPER_ADMIN (ve todo el sistema)', async () => {
      const qb = createMockQueryBuilder({ getManyAndCount: jest.fn().mockResolvedValue([[], 0]) });
      auditLogRepo.createQueryBuilder!.mockReturnValue(qb);

      await service.findAll({} as any, makeSuperAdmin(), ACTIVE_CLINIC);

      const clinicFilterCalls = qb.andWhere.mock.calls.filter((c: any[]) => c[0] === 'log.clinicId = :scopedClinicId');
      expect(clinicFilterCalls).toHaveLength(0);
    });

    it('un ADMIN nunca ve logs de otra clínica aunque intente filtrar manualmente', async () => {
      const qb = createMockQueryBuilder({ getManyAndCount: jest.fn().mockResolvedValue([[], 0]) });
      auditLogRepo.createQueryBuilder!.mockReturnValue(qb);

      await service.findAll({} as any, makeAdmin(), OTHER_CLINIC);

      expect(qb.andWhere).toHaveBeenCalledWith('log.clinicId = :scopedClinicId', { scopedClinicId: OTHER_CLINIC });
    });
  });

  describe('getDistinctValues — scoping por clínica', () => {
    it('filtra por clinicId cuando el actor es ADMIN', async () => {
      const qb = createMockQueryBuilder({ getRawMany: jest.fn().mockResolvedValue([]) });
      auditLogRepo.createQueryBuilder!.mockReturnValue(qb);

      await service.getDistinctValues(makeAdmin(), ACTIVE_CLINIC);

      expect(qb.andWhere).toHaveBeenCalledWith('log.clinicId = :scopedClinicId', { scopedClinicId: ACTIVE_CLINIC });
    });
  });
});
