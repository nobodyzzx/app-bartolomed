import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { MedicalRecordsService } from './medical-records.service';
import { MedicalRecord } from './entities/medical-record.entity';
import { ConsentForm } from './entities/consent-form.entity';
import { createMockRepository, createMockQueryBuilder, MockRepository } from 'src/test/helpers/mock-repository.factory';
import { makeUser } from 'src/test/helpers/test-data.factory';

/** Crea un MedicalRecord-like object con calculateBMI funcional */
const makeMedicalRecordEntity = (overrides: Record<string, any> = {}) => ({
  id: 'rec-1',
  bmi: null as number | null,
  calculateBMI(): number | null {
    if (this.weight && this.height) {
      const h = this.height / 100;
      return this.weight / (h * h);
    }
    return null;
  },
  ...overrides,
});

describe('MedicalRecordsService', () => {
  let service: MedicalRecordsService;
  let recordRepo: MockRepository<MedicalRecord>;
  let consentRepo: MockRepository<ConsentForm>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MedicalRecordsService,
        { provide: getRepositoryToken(MedicalRecord), useValue: createMockRepository() },
        { provide: getRepositoryToken(ConsentForm), useValue: createMockRepository() },
      ],
    }).compile();

    service = module.get<MedicalRecordsService>(MedicalRecordsService);
    recordRepo = module.get(getRepositoryToken(MedicalRecord));
    consentRepo = module.get(getRepositoryToken(ConsentForm));
  });

  afterEach(() => jest.clearAllMocks());

  // ─── findAll ──────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('lanza BadRequestException si clinicId no se provee', async () => {
      await expect(service.findAll({}, {}, undefined as any)).rejects.toThrow(BadRequestException);
    });

    it('retorna registros paginados para una clínica', async () => {
      const qb = createMockQueryBuilder({
        getManyAndCount: jest.fn().mockResolvedValue([[{ id: 'rec-1' }], 1]),
      });
      recordRepo.createQueryBuilder!.mockReturnValue(qb);

      const result = await service.findAll({}, { page: 1, limit: 10 }, 'clinic-1');
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  // ─── create ───────────────────────────────────────────────────────────────

  describe('create', () => {
    it('calcula BMI si se proveen peso y altura, y lo guarda en save()', async () => {
      const dto = {
        patientId: 'patient-1',
        doctorId: 'user-1',
        type: 'consultation',
        weight: 70,
        height: 175,
      };

      // El entity retornado por create() DEBE tener los campos del dto + calculateBMI()
      const entity = makeMedicalRecordEntity({ weight: 70, height: 175 });
      const saved = { ...entity, bmi: 22.86 };

      recordRepo.create!.mockReturnValue(entity);
      recordRepo.save!.mockResolvedValue(saved);
      recordRepo.findOne!.mockResolvedValue(saved);

      await service.create(dto as any, makeUser() as any, 'clinic-1');

      // BMI = 70 / (1.75)² ≈ 22.86 → debe pasarse a save()
      expect(recordRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ bmi: expect.closeTo(22.86, 1) }),
      );
    });

    it('no calcula BMI si faltan peso o altura', async () => {
      const dto = { patientId: 'patient-1', type: 'consultation', weight: 70 }; // sin height

      const entity = makeMedicalRecordEntity({ weight: 70 }); // sin height
      const saved = { ...entity };

      recordRepo.create!.mockReturnValue(entity);
      recordRepo.save!.mockResolvedValue(saved);
      recordRepo.findOne!.mockResolvedValue(saved);

      await service.create(dto as any, makeUser() as any, 'clinic-1');

      expect(recordRepo.save).toHaveBeenCalledWith(
        expect.not.objectContaining({ bmi: expect.any(Number) }),
      );
    });
  });
});
