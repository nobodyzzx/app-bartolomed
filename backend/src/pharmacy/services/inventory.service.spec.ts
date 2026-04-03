import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { Medication, MedicationStock, MovementType, StockMovement } from '../entities/pharmacy.entity';
import { Clinic } from 'src/clinics/entities/clinic.entity';
import { createMockQueryBuilder, createMockRepository, MockRepository } from 'src/test/helpers/mock-repository.factory';
import { makeClinic, makeMedicationStock } from 'src/test/helpers/test-data.factory';

const makeMedication = (overrides: Record<string, any> = {}) => ({
  id: 'med-1',
  code: 'MED-001',
  name: 'Paracetamol 500mg',
  isActive: true,
  ...overrides,
});

describe('InventoryService', () => {
  let service: InventoryService;
  let medRepo: MockRepository<Medication>;
  let stockRepo: MockRepository<MedicationStock>;
  let movementRepo: MockRepository<StockMovement>;
  let clinicRepo: MockRepository<Clinic>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        { provide: getRepositoryToken(Medication), useValue: createMockRepository() },
        { provide: getRepositoryToken(MedicationStock), useValue: createMockRepository() },
        { provide: getRepositoryToken(StockMovement), useValue: createMockRepository() },
        { provide: getRepositoryToken(Clinic), useValue: createMockRepository() },
      ],
    }).compile();

    service = module.get<InventoryService>(InventoryService);
    medRepo = module.get(getRepositoryToken(Medication));
    stockRepo = module.get(getRepositoryToken(MedicationStock));
    movementRepo = module.get(getRepositoryToken(StockMovement));
    clinicRepo = module.get(getRepositoryToken(Clinic));
  });

  afterEach(() => jest.clearAllMocks());

  // ─── createMedication ─────────────────────────────────────────────────────

  describe('createMedication', () => {
    it('rechaza si el código ya existe', async () => {
      medRepo.findOne!.mockResolvedValue(makeMedication());

      await expect(
        service.createMedication({ code: 'MED-001', name: 'Otro' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('crea medicamento si el código es único', async () => {
      medRepo.findOne!.mockResolvedValue(null);
      const saved = makeMedication();
      medRepo.create!.mockReturnValue(saved);
      medRepo.save!.mockResolvedValue(saved);

      const result = await service.createMedication({ code: 'MED-NUEVO', name: 'Ibuprofeno' } as any);
      expect(result).toBeDefined();
    });
  });

  // ─── findMedicationById ───────────────────────────────────────────────────

  describe('findMedicationById', () => {
    it('lanza NotFoundException si el medicamento no existe', async () => {
      medRepo.findOne!.mockResolvedValue(null);
      await expect(service.findMedicationById('no-existe')).rejects.toThrow(NotFoundException);
    });

    it('retorna medicamento si existe', async () => {
      medRepo.findOne!.mockResolvedValue(makeMedication());
      const result = await service.findMedicationById('med-1');
      expect(result.id).toBe('med-1');
    });
  });

  // ─── addStock ─────────────────────────────────────────────────────────────

  describe('addStock', () => {
    it('rechaza si clinicId del DTO no coincide con el contexto', async () => {
      await expect(
        service.addStock({ clinicId: 'otra-clinica' } as any, 'clinic-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('permite agregar stock si el clinicId coincide', async () => {
      const stock = makeMedicationStock();
      clinicRepo.findOne!.mockResolvedValue(makeClinic());
      medRepo.findOne!.mockResolvedValue(makeMedication());
      stockRepo.create!.mockReturnValue(stock);
      stockRepo.save!.mockResolvedValue(stock);
      movementRepo.create!.mockReturnValue({});
      movementRepo.save!.mockResolvedValue({});

      const result = await service.addStock(
        {
          clinicId: 'clinic-1',
          medicationId: 'med-1',
          quantity: 50,
          unitCost: 10,
          sellingPrice: 25,
          batchNumber: 'L001',
          expiryDate: '2027-01-01',
          receivedDate: '2026-04-01',
        } as any,
        'clinic-1',
      );
      expect(result).toBeDefined();
    });

    it('registra un movimiento tipo PURCHASE al agregar stock', async () => {
      const stock = makeMedicationStock();
      clinicRepo.findOne!.mockResolvedValue(makeClinic());
      medRepo.findOne!.mockResolvedValue(makeMedication());
      stockRepo.create!.mockReturnValue(stock);
      stockRepo.save!.mockResolvedValue(stock);
      movementRepo.create!.mockReturnValue({ type: MovementType.PURCHASE });
      movementRepo.save!.mockResolvedValue({});

      await service.addStock(
        { clinicId: 'clinic-1', medicationId: 'med-1', quantity: 10, unitCost: 5, sellingPrice: 15, batchNumber: 'B01', expiryDate: '2027-01-01', receivedDate: '2026-04-01' } as any,
        'clinic-1',
      );

      expect(movementRepo.save).toHaveBeenCalled();
    });
  });

  // ─── findAllMedications ───────────────────────────────────────────────────

  describe('findAllMedications', () => {
    it('retorna lista de medicamentos activos', async () => {
      medRepo.find!.mockResolvedValue([makeMedication(), makeMedication({ id: 'med-2' })]);
      const result = await service.findAllMedications();
      expect(result).toHaveLength(2);
    });
  });

  // ─── reserveStock ─────────────────────────────────────────────────────────

  describe('reserveStock', () => {
    it('lanza BadRequestException si no hay stock disponible suficiente', async () => {
      const stock = makeMedicationStock({ quantity: 10, reservedQuantity: 8, availableQuantity: 2 });
      stockRepo.findOne!.mockResolvedValue(stock);

      await expect(service.reserveStock('stock-1', 5, 'clinic-1')).rejects.toThrow(BadRequestException);
    });

    it('incrementa reservedQuantity y decrementa availableQuantity', async () => {
      const stock = makeMedicationStock({ quantity: 20, reservedQuantity: 0, availableQuantity: 20 });
      stockRepo.findOne!.mockResolvedValue(stock);
      stockRepo.save!.mockResolvedValue({ ...stock, reservedQuantity: 5, availableQuantity: 15 });

      await service.reserveStock('stock-1', 5, 'clinic-1');

      expect(stockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ reservedQuantity: 5, availableQuantity: 15 }),
      );
    });

    it('lanza BadRequestException si clinicId no se provee', async () => {
      await expect(service.reserveStock('stock-1', 5, undefined)).rejects.toThrow(BadRequestException);
    });
  });

  // ─── releaseStock ─────────────────────────────────────────────────────────

  describe('releaseStock', () => {
    it('lanza BadRequestException si se intenta liberar más de lo reservado', async () => {
      const stock = makeMedicationStock({ quantity: 20, reservedQuantity: 3, availableQuantity: 17 });
      stockRepo.findOne!.mockResolvedValue(stock);

      await expect(service.releaseStock('stock-1', 10, 'clinic-1')).rejects.toThrow(BadRequestException);
    });

    it('decrementa reservedQuantity e incrementa availableQuantity', async () => {
      const stock = makeMedicationStock({ quantity: 20, reservedQuantity: 10, availableQuantity: 10 });
      stockRepo.findOne!.mockResolvedValue(stock);
      stockRepo.save!.mockResolvedValue({ ...stock, reservedQuantity: 6, availableQuantity: 14 });

      await service.releaseStock('stock-1', 4, 'clinic-1');

      expect(stockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ reservedQuantity: 6, availableQuantity: 14 }),
      );
    });
  });

  // ─── consumeStock ─────────────────────────────────────────────────────────

  describe('consumeStock', () => {
    it('lanza BadRequestException si la cantidad a consumir excede el reservado', async () => {
      const stock = makeMedicationStock({ quantity: 20, reservedQuantity: 2, availableQuantity: 18 });
      stockRepo.findOne!.mockResolvedValue(stock);

      await expect(service.consumeStock('stock-1', 5, 'clinic-1')).rejects.toThrow(BadRequestException);
    });

    it('decrementa reservedQuantity y quantity al consumir', async () => {
      const stock = makeMedicationStock({ quantity: 20, reservedQuantity: 8, availableQuantity: 12 });
      stockRepo.findOne!.mockResolvedValue(stock);
      stockRepo.save!.mockResolvedValue({ ...stock, reservedQuantity: 3, quantity: 15 });
      movementRepo.create!.mockReturnValue({});
      movementRepo.save!.mockResolvedValue({});

      await service.consumeStock('stock-1', 5, 'clinic-1');

      expect(stockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ reservedQuantity: 3, quantity: 15 }),
      );
    });

    it('registra movimiento tipo SALE al consumir', async () => {
      const stock = makeMedicationStock({ quantity: 20, reservedQuantity: 10, availableQuantity: 10 });
      stockRepo.findOne!.mockResolvedValue(stock);
      stockRepo.save!.mockResolvedValue(stock);
      movementRepo.create!.mockReturnValue({ type: MovementType.SALE });
      movementRepo.save!.mockResolvedValue({});

      await service.consumeStock('stock-1', 5, 'clinic-1');

      expect(movementRepo.save).toHaveBeenCalled();
    });
  });

  // ─── transferStock ────────────────────────────────────────────────────────

  describe('transferStock', () => {
    const sourceClinic = makeClinic({ id: 'clinic-1' });
    const destClinic   = makeClinic({ id: 'clinic-2' });

    const makeSourceStock = (overrides: Record<string, any> = {}) =>
      makeMedicationStock({
        id: 'stock-src',
        quantity: 100,
        reservedQuantity: 0,
        availableQuantity: 100,
        isActive: true,
        clinic: sourceClinic,
        ...overrides,
      });

    const baseDto = () => ({
      sourceStockId: 'stock-src',
      toClinicId: 'clinic-2',
      quantity: 30,
    });

    const setupTransfer = (sourceOverrides: Record<string, any> = {}) => {
      const source = makeSourceStock(sourceOverrides);
      const destStock = { ...source, id: 'stock-dst', quantity: 30, clinic: destClinic };

      stockRepo.findOne!.mockResolvedValue(source);
      clinicRepo.findOne!.mockResolvedValue(destClinic);
      stockRepo.create!.mockReturnValue(destStock);
      stockRepo.save!
        .mockResolvedValueOnce({ ...source, quantity: source.quantity - 30 }) // source save
        .mockResolvedValueOnce(destStock);                                      // dest save
      movementRepo.create!.mockReturnValue({});
      movementRepo.save!.mockResolvedValue([]);

      return { source, destStock };
    };

    it('lanza BadRequestException si clinicId no se provee', async () => {
      await expect(service.transferStock(baseDto() as any, undefined)).rejects.toThrow(BadRequestException);
    });

    it('lanza BadRequestException si la cantidad a transferir es 0', async () => {
      const source = makeSourceStock();
      stockRepo.findOne!.mockResolvedValue(source);

      await expect(
        service.transferStock({ ...baseDto(), quantity: 0 } as any, 'clinic-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('lanza BadRequestException si stock disponible es insuficiente', async () => {
      const source = makeSourceStock({ quantity: 10, availableQuantity: 10 });
      stockRepo.findOne!.mockResolvedValue(source);

      await expect(
        service.transferStock({ ...baseDto(), quantity: 50 } as any, 'clinic-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('lanza BadRequestException si destino es la misma clínica', async () => {
      const source = makeSourceStock(); // clinic: { id: 'clinic-1' }
      stockRepo.findOne!.mockResolvedValue(source);

      await expect(
        service.transferStock({ ...baseDto(), toClinicId: 'clinic-1' } as any, 'clinic-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('lanza BadRequestException si la clínica destino no existe', async () => {
      const source = makeSourceStock();
      stockRepo.findOne!.mockResolvedValue(source);
      clinicRepo.findOne!.mockResolvedValue(null); // clínica no encontrada

      await expect(
        service.transferStock(baseDto() as any, 'clinic-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('reduce la cantidad del stock de origen', async () => {
      setupTransfer({ quantity: 100, availableQuantity: 100 });

      await service.transferStock(baseDto() as any, 'clinic-1');

      expect(stockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ quantity: 70 }), // 100 - 30
      );
    });

    it('crea un nuevo lote de stock en la clínica destino', async () => {
      setupTransfer();

      await service.transferStock(baseDto() as any, 'clinic-1');

      expect(stockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ quantity: 30, clinic: destClinic }),
      );
    });

    it('registra movimiento de salida (transfer_out) en el origen', async () => {
      setupTransfer();

      await service.transferStock(baseDto() as any, 'clinic-1');

      expect(movementRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: MovementType.TRANSFER, reason: 'transfer_out' }),
      );
    });

    it('registra movimiento de entrada (transfer_in) en el destino', async () => {
      setupTransfer();

      await service.transferStock(baseDto() as any, 'clinic-1');

      expect(movementRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: MovementType.TRANSFER, reason: 'transfer_in' }),
      );
    });

    it('guarda ambos movimientos en una sola llamada a save', async () => {
      setupTransfer();

      await service.transferStock(baseDto() as any, 'clinic-1');

      // movementRepo.save se llama con un array de 2 movimientos
      const saveCall = (movementRepo.save as jest.Mock).mock.calls[0][0];
      expect(Array.isArray(saveCall)).toBe(true);
      expect(saveCall).toHaveLength(2);
    });

    it('retorna source, destination y cantidad transferida', async () => {
      setupTransfer();

      const result = await service.transferStock(baseDto() as any, 'clinic-1');

      expect(result).toMatchObject({
        transferred: 30,
      });
      expect(result.source).toBeDefined();
      expect(result.destination).toBeDefined();
    });

    it('el lote destino tiene el sufijo -T en el batchNumber', async () => {
      setupTransfer();

      await service.transferStock(baseDto() as any, 'clinic-1');

      const createCall = (stockRepo.create as jest.Mock).mock.calls[0][0];
      expect(createCall.batchNumber).toMatch(/-T\d+$/);
    });
  });

  // ─── getLowStockItems / getExpiringItems ──────────────────────────────────

  describe('getLowStockItems', () => {
    it('lanza BadRequestException si clinicId no se provee', async () => {
      await expect(service.getLowStockItems(undefined as any)).rejects.toThrow(BadRequestException);
    });

    it('retorna lista de stock bajo mínimo', async () => {
      const lowStock = makeMedicationStock({ availableQuantity: 2, minimumStock: 10 });
      const qb = createMockQueryBuilder({ getMany: jest.fn().mockResolvedValue([lowStock]) });
      stockRepo.createQueryBuilder!.mockReturnValue(qb);

      const result = await service.getLowStockItems('clinic-1');

      expect(result).toHaveLength(1);
    });
  });

  describe('getExpiringItems', () => {
    it('lanza BadRequestException si clinicId no se provee', async () => {
      await expect(service.getExpiringItems(undefined as any)).rejects.toThrow(BadRequestException);
    });

    it('retorna ítems que vencen dentro del período indicado', async () => {
      const expiring = makeMedicationStock({ expiryDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000) }); // vence en 10 días
      stockRepo.find!.mockResolvedValue([expiring]);

      const result = await service.getExpiringItems('clinic-1', 30);

      expect(result).toHaveLength(1);
    });
  });
});
