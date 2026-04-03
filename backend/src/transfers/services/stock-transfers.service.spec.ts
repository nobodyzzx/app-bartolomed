import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { StockTransfersService } from './stock-transfers.service';
import {
  StockTransfer,
  StockTransferItem,
  TransferAuditLog,
  TransferStatus,
} from '../entities/stock-transfer.entity';
import { MedicationStock } from 'src/pharmacy/entities/pharmacy.entity';
import { createMockRepository, MockRepository } from 'src/test/helpers/mock-repository.factory';
import { makeClinic, makeUser } from 'src/test/helpers/test-data.factory';

// ─── EntityManager mock usado dentro de la transacción ────────────────────────
const makeEm = (overrides: Record<string, jest.Mock> = {}) => ({
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  ...overrides,
});

// ─── DataSource mock que ejecuta el callback inmediatamente ───────────────────
const makeMockDataSource = (em: ReturnType<typeof makeEm>) => ({
  transaction: jest.fn().mockImplementation(async (fn: (em: any) => Promise<any>) => fn(em)),
});

describe('StockTransfersService', () => {
  let service: StockTransfersService;
  let transferRepo: MockRepository<StockTransfer>;
  let stockRepo: MockRepository<MedicationStock>;
  let em: ReturnType<typeof makeEm>;
  let mockDataSource: ReturnType<typeof makeMockDataSource>;

  beforeEach(async () => {
    em = makeEm();
    mockDataSource = makeMockDataSource(em);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StockTransfersService,
        { provide: getRepositoryToken(StockTransfer), useValue: createMockRepository() },
        { provide: getRepositoryToken(StockTransferItem), useValue: createMockRepository() },
        { provide: getRepositoryToken(TransferAuditLog), useValue: createMockRepository() },
        { provide: getRepositoryToken(MedicationStock), useValue: createMockRepository() },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<StockTransfersService>(StockTransfersService);
    transferRepo = module.get(getRepositoryToken(StockTransfer));
    stockRepo = module.get(getRepositoryToken(MedicationStock));
  });

  afterEach(() => jest.clearAllMocks());

  // ─── create ───────────────────────────────────────────────────────────────

  describe('create', () => {
    const baseDto = () => ({
      sourceClinicId: 'clinic-A',
      items: [{ sourceStockId: 'stock-1', requestedQuantity: 10 }],
      notes: '',
    });

    it('rechaza si la clínica origen y destino son la misma', async () => {
      await expect(
        service.create(baseDto() as any, makeUser() as any, 'clinic-A'),
      ).rejects.toThrow(BadRequestException);
    });

    it('lanza NotFoundException si la clínica origen no existe', async () => {
      em.findOne
        .mockResolvedValueOnce(null) // sourceClinic
        .mockResolvedValueOnce(makeClinic({ id: 'clinic-B' })); // targetClinic

      await expect(
        service.create(baseDto() as any, makeUser() as any, 'clinic-B'),
      ).rejects.toThrow(NotFoundException);
    });

    it('lanza ConflictException si el stock disponible es insuficiente', async () => {
      em.findOne
        .mockResolvedValueOnce(makeClinic({ id: 'clinic-A' })) // sourceClinic
        .mockResolvedValueOnce(makeClinic({ id: 'clinic-B' })) // targetClinic
        .mockResolvedValueOnce({
          id: 'stock-1',
          batchNumber: 'L001',
          availableQuantity: 5, // menor que requestedQuantity (10)
        });

      await expect(
        service.create(baseDto() as any, makeUser() as any, 'clinic-B'),
      ).rejects.toThrow(ConflictException);
    });

    it('crea solicitud de traspaso si el stock es suficiente', async () => {
      const savedTransfer = { id: 'trf-1', status: TransferStatus.REQUESTED };
      em.findOne
        .mockResolvedValueOnce(makeClinic({ id: 'clinic-A' }))
        .mockResolvedValueOnce(makeClinic({ id: 'clinic-B' }))
        .mockResolvedValueOnce({ id: 'stock-1', batchNumber: 'L001', availableQuantity: 50 });
      em.create.mockReturnValue(savedTransfer);
      em.save.mockResolvedValue(savedTransfer);

      const result = await service.create(baseDto() as any, makeUser() as any, 'clinic-B');
      expect(result.status).toBe(TransferStatus.REQUESTED);
    });
  });

  // ─── assertSourceClinic / assertTargetClinic ──────────────────────────────

  describe('assertSourceClinic', () => {
    it('lanza ForbiddenException si el clinicId no es el origen', () => {
      const transfer = { sourceClinicId: 'clinic-A', targetClinicId: 'clinic-B' } as StockTransfer;
      expect(() => service.assertSourceClinic(transfer, 'clinic-B')).toThrow();
    });

    it('no lanza si el clinicId es el origen correcto', () => {
      const transfer = { sourceClinicId: 'clinic-A', targetClinicId: 'clinic-B' } as StockTransfer;
      expect(() => service.assertSourceClinic(transfer, 'clinic-A')).not.toThrow();
    });
  });
});
