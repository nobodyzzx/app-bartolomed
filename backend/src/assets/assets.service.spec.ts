import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AssetsService } from './assets.service';
import { Asset, AssetStatus, AssetType, AssetCondition } from './entities/asset.entity';
import { AssetTransferItem } from './entities/asset-transfer.entity';
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
    isActive: true,
    clinic: { id: CLINIC_ID },
    ...overrides,
  } as any);

const makeCreateAssetDto = (overrides: Record<string, any> = {}) => ({
  name: 'Ecógrafo',
  type: AssetType.MEDICAL_EQUIPMENT,
  ...overrides,
});

// ─── suite ────────────────────────────────────────────────────────────────────

describe('AssetsService', () => {
  let service: AssetsService;
  let assetRepo: MockRepository<Asset>;
  let transferItemRepo: MockRepository<AssetTransferItem>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssetsService,
        { provide: getRepositoryToken(Asset), useValue: createMockRepository() },
        { provide: getRepositoryToken(AssetTransferItem), useValue: createMockRepository() },
      ],
    }).compile();

    service = module.get<AssetsService>(AssetsService);
    assetRepo = module.get(getRepositoryToken(Asset));
    transferItemRepo = module.get(getRepositoryToken(AssetTransferItem));

    // remove() consulta traslados activos por defecto sin ninguno encontrado;
    // los tests que sí quieren simular un traslado activo lo sobreescriben.
    const noActiveTransferQb = createMockQueryBuilder({ getOne: jest.fn().mockResolvedValue(null) });
    transferItemRepo.createQueryBuilder!.mockReturnValue(noActiveTransferQb);
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

    it('valida el serial duplicado con scope de clínica (bug real: antes buscaba en todas las clínicas)', async () => {
      const dto = makeCreateAssetDto({ serialNumber: 'SN-001' });
      assetRepo.findOne!.mockResolvedValue(null);
      assetRepo.create!.mockReturnValue(makeAsset());
      assetRepo.save!.mockResolvedValue(makeAsset());

      await service.create(dto as any, USER_ID, CLINIC_ID);

      expect(assetRepo.findOne).toHaveBeenCalledWith({
        where: { serialNumber: 'SN-001', clinic: { id: CLINIC_ID } },
      });
    });

    it('no pide relaciones que la ficha ya no tiene (bug real: 500 al abrir o editar)', async () => {
      assetRepo.findOne!.mockResolvedValue(makeAsset());

      await service.findOne('asset-1', CLINIC_ID);

      // `assignedTo` se fue con el adelgazamiento de la ficha; seguía en la
      // lista de relaciones y TypeORM tiraba EntityPropertyNotFoundError, así
      // que ni la vista de detalle ni la edición funcionaban.
      const [{ relations }] = assetRepo.findOne!.mock.calls.at(-1)!;
      expect(relations).toEqual(['clinic', 'createdBy']);
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
      expect(qb.andWhere).toHaveBeenCalledWith('clinic.id = :scopedClinicId', { scopedClinicId: CLINIC_ID });
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

    it('lanza BadRequestException si no se pasa clinicId (bug real: antes devolvía activos de TODAS las clínicas en silencio)', async () => {
      await expect(service.findAll()).rejects.toThrow(BadRequestException);
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

    it('valida el serial duplicado con scope de clínica al actualizar', async () => {
      const asset = makeAsset({ serialNumber: 'SN-OLD' });
      assetRepo.findOne!.mockResolvedValueOnce(asset).mockResolvedValueOnce(null);
      assetRepo.save!.mockResolvedValue(asset);

      await service.update('asset-1', { serialNumber: 'SN-NEW' } as any, CLINIC_ID);

      expect(assetRepo.findOne).toHaveBeenLastCalledWith({
        where: { serialNumber: 'SN-NEW', clinic: { id: CLINIC_ID } },
      });
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
      // Dar de baja por error tiene que poder deshacerse: quien marca el estado
      // es la persona que recorre la clínica con la hoja, no un contador.
      [AssetStatus.RETIRED, AssetStatus.ACTIVE, true],
      // Reparado sin registrar un mantenimiento — esta clínica no los registra.
      [AssetStatus.DAMAGED, AssetStatus.ACTIVE, true],
      [AssetStatus.DAMAGED, AssetStatus.MAINTENANCE, true],
      // Vendido y extraviado sí son terminales: el bien no está y no va a estar.
      [AssetStatus.SOLD, AssetStatus.ACTIVE, false],
      [AssetStatus.LOST, AssetStatus.ACTIVE, false],
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

    it('lanza BadRequestException si el activo ya está SOLD (transición inválida, antes se forzaba RETIRED igual)', async () => {
      const asset = makeAsset({ status: AssetStatus.SOLD });
      assetRepo.findOne!.mockResolvedValue(asset);

      await expect(service.remove('asset-1', CLINIC_ID)).rejects.toThrow(BadRequestException);
      expect(assetRepo.save).not.toHaveBeenCalled();
    });

    it('lanza BadRequestException si el activo tiene un traslado en curso (bug real: antes no se chequeaba)', async () => {
      const asset = makeAsset({ status: AssetStatus.ACTIVE });
      assetRepo.findOne!.mockResolvedValue(asset);
      const activeTransferQb = createMockQueryBuilder({
        getOne: jest.fn().mockResolvedValue({ id: 'item-1' }),
      });
      transferItemRepo.createQueryBuilder!.mockReturnValue(activeTransferQb);

      await expect(service.remove('asset-1', CLINIC_ID)).rejects.toThrow(BadRequestException);
      expect(assetRepo.save).not.toHaveBeenCalled();
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
    it('cuenta ítems, unidades y estados — ya no importes ni depreciación', async () => {
      // getStats lanza 4 queries en paralelo: resumen + agrupados por tipo,
      // condición y ambiente. Cada createQueryBuilder recibe su propio mock.
      const summaryQb = createMockQueryBuilder({
        getRawOne: jest.fn().mockResolvedValue({
          total: '3',
          units: '11',
          active: '1',
          inactive: '1',
          maintenance: '1',
          retired: '0',
          damaged: '0',
        }),
      });
      const typeQb = createMockQueryBuilder({
        getRawMany: jest.fn().mockResolvedValue([
          { key: 'medical_equipment', count: '2', units: '8' },
          { key: 'furniture', count: '1', units: '3' },
        ]),
      });
      const conditionQb = createMockQueryBuilder({
        getRawMany: jest.fn().mockResolvedValue([{ key: 'good', count: '3', units: '11' }]),
      });
      const locationQb = createMockQueryBuilder({
        getRawMany: jest.fn().mockResolvedValue([
          { key: 'SALA ECOGRAFIA', count: '2', units: '8' },
          { key: null, count: '1', units: '3' },
        ]),
      });
      assetRepo
        .createQueryBuilder!.mockReturnValueOnce(summaryQb)
        .mockReturnValueOnce(typeQb)
        .mockReturnValueOnce(conditionQb)
        .mockReturnValueOnce(locationQb);

      const stats = await service.getStats(CLINIC_ID);

      expect(stats.total).toBe(3);
      // 3 ítems son 11 unidades: es la cifra que el inventario necesita y que
      // antes no existía (la pantalla mostraba "Valor Total Bs 0,00" en su lugar).
      expect(stats.units).toBe(11);
      expect(stats.active).toBe(1);
      expect(stats.maintenance).toBe(1);
      expect(stats.inactive).toBe(1);
      expect(stats.byType).toEqual({ medical_equipment: 2, furniture: 1 });
      expect(stats.byCondition).toEqual({ good: 3 });
      expect(stats.byLocation).toEqual({
        'SALA ECOGRAFIA': { items: 2, units: 8 },
        'Sin ubicación': { items: 1, units: 3 },
      });
      // Los importes se fueron con las columnas que nadie llenaba.
      expect(stats.totalValue).toBeUndefined();
      expect(stats.underWarranty).toBeUndefined();
    });
  });

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
