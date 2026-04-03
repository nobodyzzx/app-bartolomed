import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AssetTransfersService } from './asset-transfers.service';
import {
  AssetTransfer,
  AssetTransferAuditLog,
  AssetTransferAuditAction,
  AssetTransferItem,
  AssetTransferStatus,
} from '../entities/asset-transfer.entity';
import { Asset, AssetStatus, AssetType, AssetCondition, DepreciationMethod } from '../entities/asset.entity';
import { Clinic } from 'src/clinics/entities/clinic.entity';
import { createMockRepository, createMockQueryBuilder, MockRepository } from 'src/test/helpers/mock-repository.factory';

// ─── Factories ────────────────────────────────────────────────────────────────

const SOURCE_CLINIC = 'clinic-source';
const TARGET_CLINIC = 'clinic-target';
const USER_ID = 'user-1';
const TRANSFER_ID = 'transfer-1';

const makeAsset = (overrides: Partial<Asset> = {}): Asset =>
  ({
    id: 'asset-1',
    assetTag: 'MED-123456-001',
    name: 'Ecógrafo',
    type: AssetType.MEDICAL_EQUIPMENT,
    status: AssetStatus.ACTIVE,
    condition: AssetCondition.GOOD,
    purchasePrice: 5000,
    isActive: true,
    clinic: { id: SOURCE_CLINIC },
    ...overrides,
  } as any);

const makeTransfer = (overrides: Partial<AssetTransfer> = {}): AssetTransfer =>
  ({
    id: TRANSFER_ID,
    transferNumber: 'TRA-2026-000001',
    sourceClinicId: SOURCE_CLINIC,
    targetClinicId: TARGET_CLINIC,
    status: AssetTransferStatus.REQUESTED,
    requestedById: USER_ID,
    items: [
      { id: 'item-1', assetId: 'asset-1', asset: makeAsset() } as any,
    ],
    ...overrides,
  } as any);

// ─── EntityManager mock ───────────────────────────────────────────────────────

const makeEm = (overrides: Record<string, jest.Mock> = {}) => ({
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn().mockImplementation((_cls: any, data: any) => ({ ...data })),
  save: jest.fn().mockImplementation((_cls: any, data: any) => Promise.resolve(data)),
  count: jest.fn().mockResolvedValue(0),
  ...overrides,
});

const makeMockDataSource = (em: ReturnType<typeof makeEm>) => ({
  transaction: jest.fn().mockImplementation(async (fn: (em: any) => Promise<any>) => fn(em)),
});

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('AssetTransfersService', () => {
  let service: AssetTransfersService;
  let transferRepo: MockRepository<AssetTransfer>;
  let itemRepo: MockRepository<AssetTransferItem>;
  let auditRepo: MockRepository<AssetTransferAuditLog>;
  let assetRepo: MockRepository<Asset>;
  let clinicRepo: MockRepository<Clinic>;
  let em: ReturnType<typeof makeEm>;
  let mockDataSource: ReturnType<typeof makeMockDataSource>;

  beforeEach(async () => {
    em = makeEm();
    mockDataSource = makeMockDataSource(em);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssetTransfersService,
        { provide: getRepositoryToken(AssetTransfer), useValue: createMockRepository() },
        { provide: getRepositoryToken(AssetTransferItem), useValue: createMockRepository() },
        { provide: getRepositoryToken(AssetTransferAuditLog), useValue: createMockRepository() },
        { provide: getRepositoryToken(Asset), useValue: createMockRepository() },
        { provide: getRepositoryToken(Clinic), useValue: createMockRepository() },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<AssetTransfersService>(AssetTransfersService);
    transferRepo = module.get(getRepositoryToken(AssetTransfer));
    itemRepo = module.get(getRepositoryToken(AssetTransferItem));
    auditRepo = module.get(getRepositoryToken(AssetTransferAuditLog));
    assetRepo = module.get(getRepositoryToken(Asset));
    clinicRepo = module.get(getRepositoryToken(Clinic));
  });

  afterEach(() => jest.clearAllMocks());

  // ─── create ───────────────────────────────────────────────────────────────

  describe('create', () => {
    const dto = {
      targetClinicId: TARGET_CLINIC,
      items: [{ assetId: 'asset-1' }],
    };

    const setupHappyPath = () => {
      clinicRepo.findOne!.mockResolvedValue({ id: TARGET_CLINIC, isActive: true });
      assetRepo.find!.mockResolvedValue([makeAsset()]);
      const qb = createMockQueryBuilder({ getMany: jest.fn().mockResolvedValue([]) });
      itemRepo.createQueryBuilder!.mockReturnValue(qb);
      // dentro de la transacción
      em.count.mockResolvedValue(0);
      em.save.mockImplementation((_cls: any, data: any) => Promise.resolve(Array.isArray(data) ? data : { id: TRANSFER_ID, ...data }));
      em.findOne.mockResolvedValue(makeTransfer());
    };

    it('crea el traslado correctamente y genera número TRA-YYYY-XXXXXX', async () => {
      setupHappyPath();

      const result = await service.create(dto as any, USER_ID, SOURCE_CLINIC);

      expect(mockDataSource.transaction).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('lanza BadRequestException si origen y destino son la misma clínica', async () => {
      await expect(
        service.create({ ...dto, targetClinicId: SOURCE_CLINIC } as any, USER_ID, SOURCE_CLINIC),
      ).rejects.toThrow(BadRequestException);
    });

    it('lanza NotFoundException si la clínica destino no existe', async () => {
      clinicRepo.findOne!.mockResolvedValue(null);

      await expect(service.create(dto as any, USER_ID, SOURCE_CLINIC)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('lanza BadRequestException si algún activo no pertenece a la clínica origen', async () => {
      clinicRepo.findOne!.mockResolvedValue({ id: TARGET_CLINIC, isActive: true });
      // Devuelve menos activos que los solicitados → alguno no pertenece
      assetRepo.find!.mockResolvedValue([]);

      await expect(service.create(dto as any, USER_ID, SOURCE_CLINIC)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('lanza BadRequestException si el activo está en estado bloqueado (RETIRED)', async () => {
      clinicRepo.findOne!.mockResolvedValue({ id: TARGET_CLINIC, isActive: true });
      assetRepo.find!.mockResolvedValue([makeAsset({ status: AssetStatus.RETIRED })]);

      await expect(service.create(dto as any, USER_ID, SOURCE_CLINIC)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('lanza BadRequestException si el activo ya tiene un traslado activo', async () => {
      clinicRepo.findOne!.mockResolvedValue({ id: TARGET_CLINIC, isActive: true });
      assetRepo.find!.mockResolvedValue([makeAsset()]);
      const qb = createMockQueryBuilder({
        getMany: jest.fn().mockResolvedValue([{ id: 'item-existing' }]), // traslado activo existente
      });
      itemRepo.createQueryBuilder!.mockReturnValue(qb);

      await expect(service.create(dto as any, USER_ID, SOURCE_CLINIC)).rejects.toThrow(
        BadRequestException,
      );
    });

    it.each([AssetStatus.SOLD, AssetStatus.LOST, AssetStatus.DAMAGED, AssetStatus.INACTIVE])(
      'bloquea creación si el activo está en estado %s',
      async (blockedStatus) => {
        clinicRepo.findOne!.mockResolvedValue({ id: TARGET_CLINIC, isActive: true });
        assetRepo.find!.mockResolvedValue([makeAsset({ status: blockedStatus })]);

        await expect(service.create(dto as any, USER_ID, SOURCE_CLINIC)).rejects.toThrow(
          BadRequestException,
        );
      },
    );
  });

  // ─── findAll ──────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('devuelve traslados de la clínica (como origen o destino)', async () => {
      const transfers = [makeTransfer()];
      const qb = createMockQueryBuilder({ getMany: jest.fn().mockResolvedValue(transfers) });
      transferRepo.createQueryBuilder!.mockReturnValue(qb);

      const result = await service.findAll(SOURCE_CLINIC);

      expect(result).toEqual(transfers);
      expect(qb.where).toHaveBeenCalledWith(
        expect.stringContaining('source_clinic_id'),
        { clinicId: SOURCE_CLINIC },
      );
    });

    it('aplica filtro por status cuando se proporciona', async () => {
      const qb = createMockQueryBuilder({ getMany: jest.fn().mockResolvedValue([]) });
      transferRepo.createQueryBuilder!.mockReturnValue(qb);

      await service.findAll(SOURCE_CLINIC, { status: AssetTransferStatus.COMPLETED });

      expect(qb.andWhere).toHaveBeenCalledWith('transfer.status = :status', {
        status: AssetTransferStatus.COMPLETED,
      });
    });
  });

  // ─── findOne ──────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('devuelve el traslado si la clínica es origen', async () => {
      transferRepo.findOne!.mockResolvedValue(makeTransfer());

      const result = await service.findOne(TRANSFER_ID, SOURCE_CLINIC);

      expect(result).toBeDefined();
    });

    it('devuelve el traslado si la clínica es destino', async () => {
      transferRepo.findOne!.mockResolvedValue(makeTransfer());

      const result = await service.findOne(TRANSFER_ID, TARGET_CLINIC);

      expect(result).toBeDefined();
    });

    it('lanza NotFoundException si el traslado no existe', async () => {
      transferRepo.findOne!.mockResolvedValue(null);

      await expect(service.findOne('no-existe', SOURCE_CLINIC)).rejects.toThrow(NotFoundException);
    });

    it('lanza NotFoundException si la clínica no tiene acceso al traslado', async () => {
      transferRepo.findOne!.mockResolvedValue(makeTransfer());

      await expect(service.findOne(TRANSFER_ID, 'otra-clinica')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── getPendingCount ──────────────────────────────────────────────────────

  describe('getPendingCount', () => {
    it('suma traslados SOLICITADOS (origen) + EN TRÁNSITO (destino)', async () => {
      transferRepo.count!
        .mockResolvedValueOnce(3) // REQUESTED donde es origen
        .mockResolvedValueOnce(2); // IN_TRANSIT donde es destino

      const result = await service.getPendingCount(SOURCE_CLINIC);

      expect(result).toEqual({ count: 5 });
    });

    it('devuelve 0 cuando no hay traslados pendientes', async () => {
      transferRepo.count!.mockResolvedValue(0);

      const result = await service.getPendingCount(SOURCE_CLINIC);

      expect(result).toEqual({ count: 0 });
    });
  });

  // ─── dispatch ─────────────────────────────────────────────────────────────

  describe('dispatch', () => {
    it('cambia estado a IN_TRANSIT y marca activos como INACTIVE', async () => {
      const transfer = makeTransfer({ status: AssetTransferStatus.REQUESTED });
      em.findOne
        .mockResolvedValueOnce(transfer) // loadTransferForUpdate
        .mockResolvedValueOnce(makeAsset()) // asset lock
        .mockResolvedValueOnce(makeTransfer({ status: AssetTransferStatus.IN_TRANSIT })); // loadTransfer final

      await service.dispatch(TRANSFER_ID, {}, USER_ID, SOURCE_CLINIC);

      const assetSaveCall = em.save.mock.calls.find(
        ([cls]) => cls === Asset || (typeof cls === 'function' && cls.name === 'Asset'),
      );
      expect(assetSaveCall).toBeDefined();

      const savedAsset = assetSaveCall?.[1];
      expect(savedAsset?.status).toBe(AssetStatus.INACTIVE);
    });

    it('lanza BadRequestException si el traslado no está SOLICITADO', async () => {
      em.findOne.mockResolvedValue(makeTransfer({ status: AssetTransferStatus.IN_TRANSIT }));

      await expect(service.dispatch(TRANSFER_ID, {}, USER_ID, SOURCE_CLINIC)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('lanza BadRequestException si no es la clínica origen', async () => {
      em.findOne.mockResolvedValue(makeTransfer({ status: AssetTransferStatus.REQUESTED }));

      await expect(service.dispatch(TRANSFER_ID, {}, USER_ID, TARGET_CLINIC)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ─── confirmReceipt ───────────────────────────────────────────────────────

  describe('confirmReceipt', () => {
    it('cambia clínica del activo a la destino y lo pone ACTIVE', async () => {
      const transfer = makeTransfer({ status: AssetTransferStatus.IN_TRANSIT });
      em.findOne
        .mockResolvedValueOnce(transfer)   // loadTransferForUpdate
        .mockResolvedValueOnce(makeAsset()) // asset lock
        .mockResolvedValueOnce(makeTransfer({ status: AssetTransferStatus.COMPLETED })); // loadTransfer final

      await service.confirmReceipt(TRANSFER_ID, {}, USER_ID, TARGET_CLINIC);

      const assetSaveCall = em.save.mock.calls.find(
        ([cls]) => cls === Asset || (typeof cls === 'function' && cls.name === 'Asset'),
      );
      const savedAsset = assetSaveCall?.[1];
      expect(savedAsset?.status).toBe(AssetStatus.ACTIVE);
      expect(savedAsset?.clinic).toEqual({ id: TARGET_CLINIC });
    });

    it('lanza BadRequestException si el traslado no está EN TRÁNSITO', async () => {
      em.findOne.mockResolvedValue(makeTransfer({ status: AssetTransferStatus.REQUESTED }));

      await expect(
        service.confirmReceipt(TRANSFER_ID, {}, USER_ID, TARGET_CLINIC),
      ).rejects.toThrow(BadRequestException);
    });

    it('lanza BadRequestException si no es la clínica destino', async () => {
      em.findOne.mockResolvedValue(makeTransfer({ status: AssetTransferStatus.IN_TRANSIT }));

      await expect(
        service.confirmReceipt(TRANSFER_ID, {}, USER_ID, SOURCE_CLINIC),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── reject ───────────────────────────────────────────────────────────────

  describe('reject', () => {
    it('rechaza el traslado y guarda el motivo', async () => {
      const transfer = makeTransfer({ status: AssetTransferStatus.REQUESTED });
      transferRepo.findOne!
        .mockResolvedValueOnce(transfer) // findOne inicial
        .mockResolvedValueOnce({ ...transfer, status: AssetTransferStatus.REJECTED }); // findOne final
      auditRepo.create!.mockReturnValue({ transferId: TRANSFER_ID });
      auditRepo.save!.mockResolvedValue({});
      transferRepo.save!.mockResolvedValue(transfer);

      await service.reject(TRANSFER_ID, { reason: 'No disponible' }, USER_ID, SOURCE_CLINIC);

      expect(transferRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: AssetTransferStatus.REJECTED, rejectionReason: 'No disponible' }),
      );
    });

    it('lanza BadRequestException si el traslado no está SOLICITADO', async () => {
      transferRepo.findOne!.mockResolvedValue(makeTransfer({ status: AssetTransferStatus.IN_TRANSIT }));

      await expect(
        service.reject(TRANSFER_ID, { reason: 'motivo' }, USER_ID, SOURCE_CLINIC),
      ).rejects.toThrow(BadRequestException);
    });

    it('lanza BadRequestException si no es la clínica origen', async () => {
      transferRepo.findOne!.mockResolvedValue(makeTransfer({ status: AssetTransferStatus.REQUESTED }));

      await expect(
        service.reject(TRANSFER_ID, { reason: 'motivo' }, USER_ID, TARGET_CLINIC),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── returnTransfer ───────────────────────────────────────────────────────

  describe('returnTransfer', () => {
    it('devuelve activos a ACTIVE en clínica origen y cambia estado a RETURNED', async () => {
      const transfer = makeTransfer({ status: AssetTransferStatus.IN_TRANSIT });
      em.findOne
        .mockResolvedValueOnce(transfer)    // loadTransferForUpdate
        .mockResolvedValueOnce(makeAsset()) // asset lock
        .mockResolvedValueOnce(makeTransfer({ status: AssetTransferStatus.RETURNED })); // loadTransfer final

      await service.returnTransfer(TRANSFER_ID, { reason: 'Devuelto por daño' }, USER_ID, TARGET_CLINIC);

      const transferSaveCall = em.save.mock.calls.find(([cls]) => cls === AssetTransfer);
      expect(transferSaveCall?.[1]).toMatchObject({
        status: AssetTransferStatus.RETURNED,
        rejectionReason: 'Devuelto por daño',
      });

      const assetSaveCall = em.save.mock.calls.find(
        ([cls]) => cls === Asset || (typeof cls === 'function' && cls.name === 'Asset'),
      );
      expect(assetSaveCall?.[1]?.status).toBe(AssetStatus.ACTIVE);
    });

    it('lanza BadRequestException si el traslado no está EN TRÁNSITO', async () => {
      em.findOne.mockResolvedValue(makeTransfer({ status: AssetTransferStatus.COMPLETED }));

      await expect(
        service.returnTransfer(TRANSFER_ID, { reason: 'motivo' }, USER_ID, TARGET_CLINIC),
      ).rejects.toThrow(BadRequestException);
    });

    it('lanza BadRequestException si no es la clínica destino', async () => {
      em.findOne.mockResolvedValue(makeTransfer({ status: AssetTransferStatus.IN_TRANSIT }));

      await expect(
        service.returnTransfer(TRANSFER_ID, { reason: 'motivo' }, USER_ID, SOURCE_CLINIC),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── getAuditLog ──────────────────────────────────────────────────────────

  describe('getAuditLog', () => {
    it('devuelve los registros de auditoría del traslado', async () => {
      const logs = [
        { id: 'log-1', action: AssetTransferAuditAction.REQUESTED, transferId: TRANSFER_ID },
        { id: 'log-2', action: AssetTransferAuditAction.DISPATCHED, transferId: TRANSFER_ID },
      ];
      transferRepo.findOne!.mockResolvedValue(makeTransfer());
      auditRepo.find!.mockResolvedValue(logs);

      const result = await service.getAuditLog(TRANSFER_ID, SOURCE_CLINIC);

      expect(result).toEqual(logs);
      expect(auditRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { transferId: TRANSFER_ID } }),
      );
    });

    it('lanza NotFoundException si no tiene acceso al traslado', async () => {
      transferRepo.findOne!.mockResolvedValue(makeTransfer());

      await expect(service.getAuditLog(TRANSFER_ID, 'otra-clinica')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
