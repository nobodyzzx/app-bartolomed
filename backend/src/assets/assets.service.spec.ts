import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AssetsService } from './assets.service';
import { Asset, AssetStatus, AssetType, AssetCondition, DepreciationMethod } from './entities/asset.entity';
import { AssetMaintenance, MaintenanceStatus, MaintenanceType } from './entities/asset-maintenance.entity';
import { AssetReport, ReportStatus, ReportType } from './entities/asset-report.entity';
import {
  createMockRepository,
  createMockQueryBuilder,
  MockRepository,
} from 'src/test/helpers/mock-repository.factory';

// ─── factories ────────────────────────────────────────────────────────────────

const CLINIC_ID = 'clinic-1';
const USER_ID = 'user-1';

const makeAsset = (overrides: Partial<Asset> = {}): Asset =>
  ({
    id: 'asset-1',
    assetTag: 'MED-123456-001',
    name: 'Ecógrafo',
    type: AssetType.MEDICAL_EQUIPMENT,
    status: AssetStatus.ACTIVE,
    condition: AssetCondition.GOOD,
    purchasePrice: 5000,
    purchaseDate: new Date('2023-01-15'),
    depreciationMethod: DepreciationMethod.STRAIGHT_LINE,
    usefulLifeYears: 5,
    salvageValue: 500,
    currentValue: 4500,
    accumulatedDepreciation: 500,
    monthlyDepreciation: 75,
    totalMaintenanceCost: 0,
    maintenanceIntervalMonths: 12,
    isActive: true,
    clinic: { id: CLINIC_ID },
    isUnderWarranty: jest.fn().mockReturnValue(false),
    isMaintenanceDue: jest.fn().mockReturnValue(false),
    ...overrides,
  } as any);

const makeCreateAssetDto = (overrides: Record<string, any> = {}) => ({
  name: 'Ecógrafo',
  type: AssetType.MEDICAL_EQUIPMENT,
  purchasePrice: 5000,
  purchaseDate: '2023-01-15',
  ...overrides,
});

const makeMaintenance = (overrides: Partial<AssetMaintenance> = {}): AssetMaintenance =>
  ({
    id: 'maint-1',
    title: 'Mantenimiento preventivo',
    type: MaintenanceType.PREVENTIVE,
    status: MaintenanceStatus.SCHEDULED,
    scheduledDate: new Date('2026-05-01'),
    assetId: 'asset-1',
    asset: makeAsset(),
    isActive: true,
    ...overrides,
  } as any);

const makeReport = (overrides: Partial<AssetReport> = {}): AssetReport =>
  ({
    id: 'report-1',
    status: ReportStatus.PENDING,
    type: ReportType.STATUS,
    clinicId: CLINIC_ID,
    generatedById: USER_ID,
    ...overrides,
  } as any);

// ─── suite ────────────────────────────────────────────────────────────────────

describe('AssetsService', () => {
  let service: AssetsService;
  let assetRepo: MockRepository<Asset>;
  let maintenanceRepo: MockRepository<AssetMaintenance>;
  let reportRepo: MockRepository<AssetReport>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssetsService,
        { provide: getRepositoryToken(Asset), useValue: createMockRepository() },
        { provide: getRepositoryToken(AssetMaintenance), useValue: createMockRepository() },
        { provide: getRepositoryToken(AssetReport), useValue: createMockRepository() },
      ],
    }).compile();

    service = module.get<AssetsService>(AssetsService);
    assetRepo = module.get(getRepositoryToken(Asset));
    maintenanceRepo = module.get(getRepositoryToken(AssetMaintenance));
    reportRepo = module.get(getRepositoryToken(AssetReport));
  });

  afterEach(() => jest.clearAllMocks());

  // ─── requireClinicId ──────────────────────────────────────────────────────

  describe('requireClinicId (interno)', () => {
    it('lanza BadRequestException si no se pasa clinicId', async () => {
      await expect(service.create(makeCreateAssetDto() as any, USER_ID, undefined)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ─── create ───────────────────────────────────────────────────────────────

  describe('create', () => {
    it('crea un activo y genera el assetTag automáticamente', async () => {
      const dto = makeCreateAssetDto();
      const saved = makeAsset();

      assetRepo.findOne!.mockResolvedValue(null); // sin duplicado de serial
      assetRepo.create!.mockReturnValue(saved);
      assetRepo.save!.mockResolvedValue(saved);

      const result = await service.create(dto as any, USER_ID, CLINIC_ID);

      expect(result).toEqual(saved);
      expect(assetRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: dto.name,
          clinic: { id: CLINIC_ID },
          createdBy: { id: USER_ID },
          assetTag: expect.stringMatching(/^MED-\d{6}-\d{3}$/),
        }),
      );
      expect(assetRepo.save).toHaveBeenCalledWith(saved);
    });

    it('lanza BadRequestException si el número de serie ya existe', async () => {
      const dto = makeCreateAssetDto({ serialNumber: 'SN-001' });
      assetRepo.findOne!.mockResolvedValue(makeAsset()); // duplicado

      await expect(service.create(dto as any, USER_ID, CLINIC_ID)).rejects.toThrow(
        BadRequestException,
      );
      expect(assetRepo.save).not.toHaveBeenCalled();
    });

    it('no verifica duplicado si no se envía serialNumber', async () => {
      const dto = makeCreateAssetDto(); // sin serialNumber
      const saved = makeAsset();

      assetRepo.create!.mockReturnValue(saved);
      assetRepo.save!.mockResolvedValue(saved);

      await service.create(dto as any, USER_ID, CLINIC_ID);

      expect(assetRepo.findOne).not.toHaveBeenCalled();
    });

    it('lanza BadRequestException si no se proporciona clinicId', async () => {
      await expect(service.create(makeCreateAssetDto() as any, USER_ID)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ─── findAll ──────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('devuelve resultado paginado con activos de la clínica', async () => {
      const assets = [makeAsset()];
      const qb = createMockQueryBuilder({ getManyAndCount: jest.fn().mockResolvedValue([assets, 1]) });
      assetRepo.createQueryBuilder!.mockReturnValue(qb);

      const result = await service.findAll(undefined, CLINIC_ID);

      expect(result).toEqual({ data: assets, total: 1, page: 1, limit: 25 });
      expect(qb.where).toHaveBeenCalledWith('asset.isActive = :isActive', { isActive: true });
      expect(qb.andWhere).toHaveBeenCalledWith('clinic.id = :clinicId', { clinicId: CLINIC_ID });
    });

    it('aplica filtro por status cuando se proporciona', async () => {
      const qb = createMockQueryBuilder({ getManyAndCount: jest.fn().mockResolvedValue([[], 0]) });
      assetRepo.createQueryBuilder!.mockReturnValue(qb);

      await service.findAll({ status: AssetStatus.MAINTENANCE } as any, CLINIC_ID);

      expect(qb.andWhere).toHaveBeenCalledWith('asset.status = :status', {
        status: AssetStatus.MAINTENANCE,
      });
    });

    it('aplica filtro de búsqueda de texto', async () => {
      const qb = createMockQueryBuilder({ getManyAndCount: jest.fn().mockResolvedValue([[], 0]) });
      assetRepo.createQueryBuilder!.mockReturnValue(qb);

      await service.findAll({ search: 'ecógrafo' } as any, CLINIC_ID);

      expect(qb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('asset.name ILIKE :search'),
        { search: '%ecógrafo%' },
      );
    });

    it('aplica filtro de rango de fechas (from y to)', async () => {
      const qb = createMockQueryBuilder({ getManyAndCount: jest.fn().mockResolvedValue([[], 0]) });
      assetRepo.createQueryBuilder!.mockReturnValue(qb);

      await service.findAll(
        { purchaseDateFrom: '2023-01-01', purchaseDateTo: '2023-12-31' } as any,
        CLINIC_ID,
      );

      expect(qb.andWhere).toHaveBeenCalledWith(
        'asset.purchaseDate BETWEEN :from AND :to',
        expect.objectContaining({ from: '2023-01-01', to: '2023-12-31' }),
      );
    });

    it('no filtra por clínica si no se pasa clinicId', async () => {
      const qb = createMockQueryBuilder({ getManyAndCount: jest.fn().mockResolvedValue([[], 0]) });
      assetRepo.createQueryBuilder!.mockReturnValue(qb);

      await service.findAll();

      const calls = (qb.andWhere as jest.Mock).mock.calls.map(c => c[0]);
      const hasClinicFilter = calls.some(c => String(c).includes('clinicId'));
      expect(hasClinicFilter).toBe(false);
    });
  });

  // ─── findOne ──────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('devuelve el activo cuando existe', async () => {
      const asset = makeAsset();
      assetRepo.findOne!.mockResolvedValue(asset);

      const result = await service.findOne('asset-1', CLINIC_ID);

      expect(result).toEqual(asset);
      expect(assetRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'asset-1', isActive: true, clinic: { id: CLINIC_ID } },
        }),
      );
    });

    it('lanza NotFoundException si el activo no existe', async () => {
      assetRepo.findOne!.mockResolvedValue(null);

      await expect(service.findOne('no-existe', CLINIC_ID)).rejects.toThrow(NotFoundException);
    });

    it('lanza BadRequestException si no se proporciona clinicId', async () => {
      await expect(service.findOne('asset-1')).rejects.toThrow(BadRequestException);
    });
  });

  // ─── update ───────────────────────────────────────────────────────────────

  describe('update', () => {
    it('actualiza el activo correctamente', async () => {
      const asset = makeAsset();
      assetRepo.findOne!.mockResolvedValue(asset);
      assetRepo.save!.mockResolvedValue({ ...asset, name: 'Nuevo nombre' });

      const result = await service.update('asset-1', { name: 'Nuevo nombre' } as any, CLINIC_ID);

      expect(assetRepo.save).toHaveBeenCalled();
      expect(result.name).toBe('Nuevo nombre');
    });

    it('rechaza si el serial ya pertenece a otro activo', async () => {
      const asset = makeAsset({ serialNumber: 'SN-OLD' });
      assetRepo.findOne!
        .mockResolvedValueOnce(asset) // findOne del asset original
        .mockResolvedValueOnce(makeAsset({ id: 'otro-activo' })); // duplicado

      await expect(
        service.update('asset-1', { serialNumber: 'SN-NEW' } as any, CLINIC_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('permite actualizar serial si es el mismo activo', async () => {
      const asset = makeAsset({ serialNumber: 'SN-001' });
      assetRepo.findOne!
        .mockResolvedValueOnce(asset)
        .mockResolvedValueOnce(asset); // mismo id
      assetRepo.save!.mockResolvedValue(asset);

      await expect(
        service.update('asset-1', { serialNumber: 'SN-001' } as any, CLINIC_ID),
      ).resolves.toBeDefined();
    });
  });

  // ─── status transitions ───────────────────────────────────────────────────

  describe('transiciones de estado (via update)', () => {
    const cases: [AssetStatus, AssetStatus, boolean][] = [
      [AssetStatus.ACTIVE, AssetStatus.MAINTENANCE, true],
      [AssetStatus.ACTIVE, AssetStatus.RETIRED, true],
      [AssetStatus.MAINTENANCE, AssetStatus.ACTIVE, true],
      [AssetStatus.RETIRED, AssetStatus.ACTIVE, false],
      [AssetStatus.SOLD, AssetStatus.ACTIVE, false],
      [AssetStatus.LOST, AssetStatus.ACTIVE, false],
      [AssetStatus.DAMAGED, AssetStatus.MAINTENANCE, true],
    ];

    test.each(cases)(
      'desde %s → %s: permitido=%s',
      async (from, to, allowed) => {
        const asset = makeAsset({ status: from });
        assetRepo.findOne!.mockResolvedValue(asset);
        assetRepo.save!.mockResolvedValue({ ...asset, status: to });

        const promise = service.update('asset-1', { status: to } as any, CLINIC_ID);

        if (allowed) {
          await expect(promise).resolves.toBeDefined();
        } else {
          await expect(promise).rejects.toThrow(BadRequestException);
        }
      },
    );

    it('no valida si el estado no cambia', async () => {
      const asset = makeAsset({ status: AssetStatus.ACTIVE });
      assetRepo.findOne!.mockResolvedValue(asset);
      assetRepo.save!.mockResolvedValue(asset);

      await expect(
        service.update('asset-1', { status: AssetStatus.ACTIVE } as any, CLINIC_ID),
      ).resolves.toBeDefined();
    });
  });

  // ─── remove ───────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('desactiva el activo (soft delete)', async () => {
      const asset = makeAsset({ status: AssetStatus.ACTIVE, isActive: true });
      assetRepo.findOne!.mockResolvedValue(asset);
      assetRepo.save!.mockResolvedValue({ ...asset, isActive: false, status: AssetStatus.RETIRED });

      await service.remove('asset-1', CLINIC_ID);

      expect(assetRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: false, status: AssetStatus.RETIRED }),
      );
    });
  });

  // ─── validateSerialNumber ────────────────────────────────────────────────

  describe('validateSerialNumber', () => {
    it('devuelve true si el serial no existe', async () => {
      assetRepo.findOne!.mockResolvedValue(null);
      const result = await service.validateSerialNumber('SN-NUEVO', undefined, CLINIC_ID);
      expect(result).toBe(true);
    });

    it('devuelve false si el serial ya existe en otro activo', async () => {
      assetRepo.findOne!.mockResolvedValue(makeAsset({ id: 'otro-id' }));
      const result = await service.validateSerialNumber('SN-001', undefined, CLINIC_ID);
      expect(result).toBe(false);
    });

    it('devuelve true si el serial existe pero pertenece al mismo activo (excludeId)', async () => {
      assetRepo.findOne!.mockResolvedValue(makeAsset({ id: 'asset-1' }));
      const result = await service.validateSerialNumber('SN-001', 'asset-1', CLINIC_ID);
      expect(result).toBe(true);
    });
  });

  // ─── getStats ─────────────────────────────────────────────────────────────

  describe('getStats', () => {
    it('calcula estadísticas correctamente', async () => {
      const assets = [
        makeAsset({ status: AssetStatus.ACTIVE, purchasePrice: 1000, currentValue: 900, accumulatedDepreciation: 100 }),
        makeAsset({ id: 'asset-2', status: AssetStatus.MAINTENANCE, purchasePrice: 2000, currentValue: 1500, accumulatedDepreciation: 500 }),
        makeAsset({ id: 'asset-3', status: AssetStatus.INACTIVE, purchasePrice: 500, currentValue: 500, accumulatedDepreciation: 0 }),
      ];
      const qb = createMockQueryBuilder({ getMany: jest.fn().mockResolvedValue(assets) });
      assetRepo.createQueryBuilder!.mockReturnValue(qb);

      const stats = await service.getStats(CLINIC_ID);

      expect(stats.total).toBe(3);
      expect(stats.active).toBe(1);
      expect(stats.maintenance).toBe(1);
      expect(stats.inactive).toBe(1);
      expect(stats.totalValue).toBe(3500);
      expect(stats.currentValue).toBe(2900);
      expect(stats.totalDepreciation).toBe(600);
    });
  });

  // ─── createMaintenance ────────────────────────────────────────────────────

  describe('createMaintenance', () => {
    it('crea un registro de mantenimiento y cambia estado del activo a MAINTENANCE', async () => {
      const asset = makeAsset({ status: AssetStatus.ACTIVE });
      const maintenance = makeMaintenance();

      assetRepo.findOne!.mockResolvedValue(asset);
      maintenanceRepo.create!.mockReturnValue(maintenance);
      maintenanceRepo.save!.mockResolvedValue(maintenance);
      assetRepo.save!.mockResolvedValue({ ...asset, status: AssetStatus.MAINTENANCE });

      const result = await service.createMaintenance(
        { assetId: 'asset-1', title: 'Preventivo', scheduledDate: '2026-05-01' },
        USER_ID,
        CLINIC_ID,
      );

      expect(result).toEqual(maintenance);
      expect(assetRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: AssetStatus.MAINTENANCE }),
      );
    });

    it('lanza BadRequestException si no se pasa assetId', async () => {
      await expect(
        service.createMaintenance({ title: 'Sin activo' }, USER_ID, CLINIC_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('lanza BadRequestException si el activo está RETIRED', async () => {
      assetRepo.findOne!.mockResolvedValue(makeAsset({ status: AssetStatus.RETIRED }));

      await expect(
        service.createMaintenance({ assetId: 'asset-1' }, USER_ID, CLINIC_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('lanza BadRequestException si el activo está SOLD', async () => {
      assetRepo.findOne!.mockResolvedValue(makeAsset({ status: AssetStatus.SOLD }));

      await expect(
        service.createMaintenance({ assetId: 'asset-1' }, USER_ID, CLINIC_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('lanza BadRequestException si el activo está LOST', async () => {
      assetRepo.findOne!.mockResolvedValue(makeAsset({ status: AssetStatus.LOST }));

      await expect(
        service.createMaintenance({ assetId: 'asset-1' }, USER_ID, CLINIC_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('lanza BadRequestException si no se proporciona clinicId', async () => {
      await expect(
        service.createMaintenance({ assetId: 'asset-1' }, USER_ID),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── updateMaintenance ────────────────────────────────────────────────────

  describe('updateMaintenance', () => {
    it('actualiza estado a COMPLETED: asigna fecha y restaura activo a ACTIVE', async () => {
      const maintenance = makeMaintenance({
        status: MaintenanceStatus.SCHEDULED,
        actualCost: 200,
        nextMaintenanceDate: new Date('2027-05-01'),
      });
      const asset = makeAsset({ status: AssetStatus.MAINTENANCE, totalMaintenanceCost: 100, isActive: true });

      maintenanceRepo.findOne!
        .mockResolvedValueOnce(maintenance) // findOneMaintenance primera llamada
        .mockResolvedValueOnce({ ...maintenance, status: MaintenanceStatus.COMPLETED }); // findOneMaintenance final
      assetRepo.findOne!.mockResolvedValue(asset);
      maintenanceRepo.save!.mockResolvedValue(maintenance);
      assetRepo.save!.mockResolvedValue(asset);

      await service.updateMaintenance(
        'maint-1',
        { status: MaintenanceStatus.COMPLETED, actualCost: 200 },
        CLINIC_ID,
        USER_ID,
      );

      expect(assetRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: AssetStatus.ACTIVE,
          totalMaintenanceCost: 300, // 100 + 200
        }),
      );
    });

    it('actualiza estado a IN_PROGRESS: pone activo en MAINTENANCE', async () => {
      const maintenance = makeMaintenance({ status: MaintenanceStatus.SCHEDULED });
      const asset = makeAsset({ status: AssetStatus.ACTIVE, isActive: true });

      maintenanceRepo.findOne!
        .mockResolvedValueOnce(maintenance)
        .mockResolvedValueOnce({ ...maintenance, status: MaintenanceStatus.IN_PROGRESS });
      assetRepo.findOne!.mockResolvedValue(asset);
      maintenanceRepo.save!.mockResolvedValue(maintenance);
      assetRepo.save!.mockResolvedValue(asset);

      await service.updateMaintenance('maint-1', { status: MaintenanceStatus.IN_PROGRESS }, CLINIC_ID);

      expect(assetRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: AssetStatus.MAINTENANCE }),
      );
    });
  });

  // ─── deleteMaintenance ────────────────────────────────────────────────────

  describe('deleteMaintenance', () => {
    it('elimina el registro de mantenimiento correctamente', async () => {
      maintenanceRepo.findOne!.mockResolvedValue(makeMaintenance());
      maintenanceRepo.delete!.mockResolvedValue({ affected: 1 });

      await expect(service.deleteMaintenance('maint-1', CLINIC_ID)).resolves.not.toThrow();
      expect(maintenanceRepo.delete).toHaveBeenCalledWith('maint-1');
    });

    it('lanza NotFoundException si el registro no existe', async () => {
      maintenanceRepo.findOne!.mockResolvedValue(null);

      await expect(service.deleteMaintenance('no-existe', CLINIC_ID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── getMaintenanceStats ──────────────────────────────────────────────────

  describe('getMaintenanceStats', () => {
    it('devuelve conteos por estado de mantenimiento', async () => {
      const records = [
        makeMaintenance({ status: MaintenanceStatus.SCHEDULED }),
        makeMaintenance({ id: 'm2', status: MaintenanceStatus.COMPLETED }),
        makeMaintenance({ id: 'm3', status: MaintenanceStatus.IN_PROGRESS }),
        makeMaintenance({ id: 'm4', status: MaintenanceStatus.SCHEDULED }),
      ];
      const qb = createMockQueryBuilder({ getMany: jest.fn().mockResolvedValue(records) });
      maintenanceRepo.createQueryBuilder!.mockReturnValue(qb);

      const stats = await service.getMaintenanceStats(CLINIC_ID);

      expect(stats.total).toBe(4);
      expect(stats.scheduled).toBe(2);
      expect(stats.completed).toBe(1);
      expect(stats.inProgress).toBe(1);
    });
  });

  // ─── generateReport ───────────────────────────────────────────────────────

  describe('generateReport', () => {
    it('crea un reporte con estado PENDING', async () => {
      const report = makeReport();
      reportRepo.create!.mockReturnValue(report);
      reportRepo.save!.mockResolvedValue(report);

      const result = await service.generateReport(
        { type: ReportType.STATUS },
        USER_ID,
        CLINIC_ID,
      );

      expect(result).toEqual(report);
      expect(reportRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: ReportStatus.PENDING,
          generatedById: USER_ID,
          clinicId: CLINIC_ID,
        }),
      );
    });

    it('lanza BadRequestException si no se proporciona clinicId', async () => {
      await expect(
        service.generateReport({ type: ReportType.STATUS }, USER_ID),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── findOneReport ────────────────────────────────────────────────────────

  describe('findOneReport', () => {
    it('devuelve el reporte cuando existe', async () => {
      const report = makeReport();
      reportRepo.findOne!.mockResolvedValue(report);

      const result = await service.findOneReport('report-1', CLINIC_ID);

      expect(result).toEqual(report);
    });

    it('lanza NotFoundException si el reporte no existe', async () => {
      reportRepo.findOne!.mockResolvedValue(null);

      await expect(service.findOneReport('no-existe', CLINIC_ID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── deleteReport ─────────────────────────────────────────────────────────

  describe('deleteReport', () => {
    it('elimina el reporte correctamente', async () => {
      reportRepo.findOne!.mockResolvedValue(makeReport());
      reportRepo.delete!.mockResolvedValue({ affected: 1 });

      await expect(service.deleteReport('report-1', CLINIC_ID)).resolves.not.toThrow();
      expect(reportRepo.delete).toHaveBeenCalledWith('report-1');
    });

    it('lanza NotFoundException si el reporte no existe', async () => {
      reportRepo.findOne!.mockResolvedValue(null);

      await expect(service.deleteReport('no-existe', CLINIC_ID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── getReportsStats ──────────────────────────────────────────────────────

  describe('getReportsStats', () => {
    it('devuelve conteos por estado de reportes', async () => {
      const reports = [
        makeReport({ status: ReportStatus.PENDING }),
        makeReport({ id: 'r2', status: ReportStatus.COMPLETED }),
        makeReport({ id: 'r3', status: ReportStatus.FAILED }),
        makeReport({ id: 'r4', status: ReportStatus.PENDING }),
      ];
      const qb = createMockQueryBuilder({ getMany: jest.fn().mockResolvedValue(reports) });
      reportRepo.createQueryBuilder!.mockReturnValue(qb);

      const stats = await service.getReportsStats(CLINIC_ID);

      expect(stats.total).toBe(4);
      expect(stats.pending).toBe(2);
      expect(stats.completed).toBe(1);
      expect(stats.failed).toBe(1);
    });
  });

  // ─── generateAssetTag (comportamiento observable via create) ──────────────

  describe('generación de assetTag', () => {
    it('el assetTag tiene el formato PREFIX-TIMESTAMP-RANDOM', async () => {
      const dto = makeCreateAssetDto({ type: AssetType.FURNITURE });
      const saved = makeAsset({ type: AssetType.FURNITURE });

      assetRepo.create!.mockImplementation((data: any) => ({ ...saved, assetTag: data.assetTag }));
      assetRepo.save!.mockImplementation((a: any) => Promise.resolve(a));

      const result = await service.create(dto as any, USER_ID, CLINIC_ID);

      // FUR-XXXXXX-XXX (3 letras del tipo FURNITURE)
      expect(result.assetTag).toMatch(/^FUR-\d{6}-\d{3}$/);
    });
  });
});
