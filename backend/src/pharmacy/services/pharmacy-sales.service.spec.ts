import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PharmacySalesService } from './pharmacy-sales.service';
import { PharmacySale, PharmacySaleItem, SaleStatus } from '../entities/pharmacy-sale.entity';
import { MedicationStock, MovementType, StockMovement } from '../entities/pharmacy.entity';
import { Prescription } from 'src/prescriptions/entities/prescription.entity';
import { InventoryService } from './inventory.service';
import { createMockRepository, MockRepository } from 'src/test/helpers/mock-repository.factory';
import { makeMedicationStock } from 'src/test/helpers/test-data.factory';

describe('PharmacySalesService', () => {
  let service: PharmacySalesService;
  let saleRepo: MockRepository<PharmacySale>;
  let saleItemRepo: MockRepository<PharmacySaleItem>;
  let stockRepo: MockRepository<MedicationStock>;
  let movementRepo: MockRepository<StockMovement>;
  let prescriptionRepo: MockRepository<Prescription>;

  const mockInventoryService = { getStockAlerts: jest.fn() };

  /** DTO mínimo válido para una venta */
  const baseSaleDto = () => ({
    patientName: 'Cliente',
    paymentMethod: 'cash',
    items: [
      {
        medicationStockId: 'stock-1',
        quantity: 5,
        unitPrice: 25.5,
      },
    ],
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PharmacySalesService,
        { provide: getRepositoryToken(PharmacySale), useValue: createMockRepository() },
        { provide: getRepositoryToken(PharmacySaleItem), useValue: createMockRepository() },
        { provide: getRepositoryToken(MedicationStock), useValue: createMockRepository() },
        { provide: getRepositoryToken(StockMovement), useValue: createMockRepository() },
        { provide: getRepositoryToken(Prescription), useValue: createMockRepository() },
        { provide: InventoryService, useValue: mockInventoryService },
      ],
    }).compile();

    service = module.get<PharmacySalesService>(PharmacySalesService);
    saleRepo = module.get(getRepositoryToken(PharmacySale));
    saleItemRepo = module.get(getRepositoryToken(PharmacySaleItem));
    stockRepo = module.get(getRepositoryToken(MedicationStock));
    movementRepo = module.get(getRepositoryToken(StockMovement));
    prescriptionRepo = module.get(getRepositoryToken(Prescription));
  });

  afterEach(() => jest.clearAllMocks());

  // ─── Helpers ──────────────────────────────────────────────────────────────

  /** Configura mocks para una venta exitosa */
  const setupHappyPath = (stockOverrides: Record<string, any> = {}) => {
    const stock = makeMedicationStock(stockOverrides);
    const savedSale = { id: 'sale-1', saleNumber: 'VTA-001', subtotal: 0, total: 0, change: 0 };

    stockRepo.findOne!.mockResolvedValue(stock);
    saleRepo.save!.mockResolvedValue(savedSale);
    saleItemRepo.save!.mockResolvedValue({});
    stockRepo.save!.mockResolvedValue({ ...stock, quantity: stock.quantity - 5 });
    movementRepo.save!.mockResolvedValue({});
    saleRepo.findOne!.mockResolvedValue(savedSale);

    return stock;
  };

  // ─── Validación de stock ──────────────────────────────────────────────────

  describe('validación de stock', () => {
    it('lanza NotFoundException si el stock no existe', async () => {
      stockRepo.findOne!.mockResolvedValue(null);

      await expect(
        service.create(baseSaleDto() as any, 'user-1', 'clinic-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('lanza BadRequestException si el stock disponible es insuficiente', async () => {
      const stock = makeMedicationStock({ quantity: 3, reservedQuantity: 0 });
      stockRepo.findOne!.mockResolvedValue(stock);

      const dto = { ...baseSaleDto(), items: [{ medicationStockId: 'stock-1', quantity: 10, unitPrice: 25.5 }] };

      await expect(
        service.create(dto as any, 'user-1', 'clinic-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('considera el stock reservado al calcular disponibilidad', async () => {
      // 100 totales - 95 reservados = 5 disponibles, pedimos 6 → falla
      const stock = makeMedicationStock({ quantity: 100, reservedQuantity: 95 });
      stockRepo.findOne!.mockResolvedValue(stock);

      const dto = { ...baseSaleDto(), items: [{ medicationStockId: 'stock-1', quantity: 6, unitPrice: 25.5 }] };

      await expect(
        service.create(dto as any, 'user-1', 'clinic-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── Reducción de stock ───────────────────────────────────────────────────

  describe('reducción de stock al vender', () => {
    it('reduce la cantidad del stock en el número vendido', async () => {
      setupHappyPath({ quantity: 100 });

      await service.create(baseSaleDto() as any, 'user-1', 'clinic-1');

      expect(stockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ quantity: 95 }),
      );
    });

    it('registra un movimiento de stock tipo SALE', async () => {
      setupHappyPath();

      await service.create(baseSaleDto() as any, 'user-1', 'clinic-1');

      expect(movementRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'sale' }),
      );
    });

    it('crea items de venta para cada producto vendido', async () => {
      setupHappyPath();

      await service.create(baseSaleDto() as any, 'user-1', 'clinic-1');

      expect(saleItemRepo.save).toHaveBeenCalledTimes(baseSaleDto().items.length);
    });

    it('reduce stock individualmente por cada ítem de la venta', async () => {
      const stock1 = makeMedicationStock({ id: 'stock-1', quantity: 50 });
      const stock2 = makeMedicationStock({ id: 'stock-2', quantity: 30 });
      const savedSale = { id: 'sale-1', saleNumber: 'VTA-001', subtotal: 0, total: 0, change: 0 };

      stockRepo.findOne!
        .mockResolvedValueOnce(stock1)
        .mockResolvedValueOnce(stock2);
      saleRepo.save!.mockResolvedValue(savedSale);
      saleItemRepo.save!.mockResolvedValue({});
      stockRepo.save!.mockResolvedValue({});
      movementRepo.save!.mockResolvedValue({});
      saleRepo.findOne!.mockResolvedValue(savedSale);

      const dto = {
        ...baseSaleDto(),
        items: [
          { medicationStockId: 'stock-1', quantity: 10, unitPrice: 5 },
          { medicationStockId: 'stock-2', quantity: 3, unitPrice: 20 },
        ],
      };

      await service.create(dto as any, 'user-1', 'clinic-1');

      // stockRepo.save debe llamarse dos veces (una por ítem)
      expect(stockRepo.save).toHaveBeenCalledTimes(2);
      expect(stockRepo.save).toHaveBeenCalledWith(expect.objectContaining({ quantity: 40 })); // 50 - 10
      expect(stockRepo.save).toHaveBeenCalledWith(expect.objectContaining({ quantity: 27 })); // 30 - 3
    });

    it('registra un movimiento SALE por cada ítem vendido', async () => {
      const stock1 = makeMedicationStock({ id: 'stock-1', quantity: 50 });
      const stock2 = makeMedicationStock({ id: 'stock-2', quantity: 30 });
      const savedSale = { id: 'sale-1', saleNumber: 'VTA-001', subtotal: 0, total: 0, change: 0 };

      stockRepo.findOne!.mockResolvedValueOnce(stock1).mockResolvedValueOnce(stock2);
      saleRepo.save!.mockResolvedValue(savedSale);
      saleItemRepo.save!.mockResolvedValue({});
      stockRepo.save!.mockResolvedValue({});
      movementRepo.save!.mockResolvedValue({});
      saleRepo.findOne!.mockResolvedValue(savedSale);

      const dto = {
        ...baseSaleDto(),
        items: [
          { medicationStockId: 'stock-1', quantity: 2, unitPrice: 10 },
          { medicationStockId: 'stock-2', quantity: 4, unitPrice: 15 },
        ],
      };

      await service.create(dto as any, 'user-1', 'clinic-1');

      expect(movementRepo.save).toHaveBeenCalledTimes(2);
    });
  });

  // ─── Cálculo de totales ───────────────────────────────────────────────────

  describe('cálculo de totales', () => {
    it('calcula subtotal correctamente (cantidad × precio)', async () => {
      setupHappyPath();

      await service.create(baseSaleDto() as any, 'user-1', 'clinic-1');

      // 5 × 25.5 = 127.5 de subtotal
      const savedSaleCall = saleRepo.save!.mock.calls[0][0];
      expect(savedSaleCall.subtotal).toBeCloseTo(127.5);
    });

    it('calcula el cambio correctamente cuando se paga de más', async () => {
      setupHappyPath();
      const dto = { ...baseSaleDto(), amountPaid: 200 };

      await service.create(dto as any, 'user-1', 'clinic-1');

      const savedSaleCall = saleRepo.save!.mock.calls[0][0];
      expect(savedSaleCall.change).toBeGreaterThan(0);
    });

    it('el cambio es 0 cuando el pago es exacto', async () => {
      setupHappyPath();
      // subtotal = 5 × 25.5 = 127.5; tax 13% = 16.575; total = 144.075
      const dto = { ...baseSaleDto(), amountPaid: 144.075 };

      await service.create(dto as any, 'user-1', 'clinic-1');

      const savedSaleCall = saleRepo.save!.mock.calls[0][0];
      expect(savedSaleCall.change).toBeCloseTo(0);
    });

    it('subtotal de múltiples ítems se suma correctamente', async () => {
      const stock1 = makeMedicationStock({ id: 'stock-1', quantity: 50 });
      const stock2 = makeMedicationStock({ id: 'stock-2', quantity: 50 });
      const savedSale = { id: 'sale-1', saleNumber: 'VTA-001', subtotal: 0, total: 0, change: 0 };

      stockRepo.findOne!.mockResolvedValueOnce(stock1).mockResolvedValueOnce(stock2);
      saleRepo.save!.mockResolvedValue(savedSale);
      saleItemRepo.save!.mockResolvedValue({});
      stockRepo.save!.mockResolvedValue({});
      movementRepo.save!.mockResolvedValue({});
      saleRepo.findOne!.mockResolvedValue(savedSale);

      const dto = {
        patientName: 'Cliente',
        paymentMethod: 'cash',
        items: [
          { medicationStockId: 'stock-1', quantity: 2, unitPrice: 10 },  // 20
          { medicationStockId: 'stock-2', quantity: 3, unitPrice: 15 },  // 45
        ],
      };

      await service.create(dto as any, 'user-1', 'clinic-1');

      const savedSaleCall = saleRepo.save!.mock.calls[0][0];
      expect(savedSaleCall.subtotal).toBeCloseTo(65); // 20 + 45
    });
  });

  // ─── Cancelación de venta ─────────────────────────────────────────────────

  describe('cancelación de venta: restauración de stock', () => {
    const makeSaleWithItems = (items: any[] = []) => ({
      id: 'sale-1',
      saleNumber: 'VTA-001',
      status: SaleStatus.COMPLETED,
      notes: '',
      items,
    });

    it('restaura la cantidad del stock al cancelar', async () => {
      const stock = makeMedicationStock({ id: 'stock-1', quantity: 10 });
      const saleItems = [{ medicationStockId: 'stock-1', quantity: 5, unitPrice: 25, subtotal: 125 }];
      const sale = makeSaleWithItems();

      jest.spyOn(service, 'findOne').mockResolvedValue(sale as any);
      saleRepo.findOne!.mockResolvedValue(makeSaleWithItems(saleItems));
      stockRepo.findOne!.mockResolvedValue(stock);
      stockRepo.save!.mockResolvedValue({ ...stock, quantity: 15 });
      movementRepo.save!.mockResolvedValue({});
      saleRepo.save!.mockResolvedValue({ ...sale, status: SaleStatus.CANCELLED });

      await service.updateStatus('sale-1', { status: SaleStatus.CANCELLED });

      // Stock debe guardarse con 10 + 5 = 15
      expect(stockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ quantity: 15 }),
      );
    });

    it('crea un movimiento tipo ADJUSTMENT al cancelar', async () => {
      const stock = makeMedicationStock({ id: 'stock-1', quantity: 10 });
      const saleItems = [{ medicationStockId: 'stock-1', quantity: 5, unitPrice: 25, subtotal: 125 }];
      const sale = makeSaleWithItems();

      jest.spyOn(service, 'findOne').mockResolvedValue(sale as any);
      saleRepo.findOne!.mockResolvedValue(makeSaleWithItems(saleItems));
      stockRepo.findOne!.mockResolvedValue(stock);
      stockRepo.save!.mockResolvedValue(stock);
      movementRepo.save!.mockResolvedValue({});
      saleRepo.save!.mockResolvedValue({ ...sale, status: SaleStatus.CANCELLED });

      await service.updateStatus('sale-1', { status: SaleStatus.CANCELLED });

      expect(movementRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ type: MovementType.ADJUSTMENT }),
      );
    });

    it('restaura stock de múltiples ítems al cancelar', async () => {
      const stock1 = makeMedicationStock({ id: 'stock-1', quantity: 10 });
      const stock2 = makeMedicationStock({ id: 'stock-2', quantity: 20 });
      const saleItems = [
        { medicationStockId: 'stock-1', quantity: 3, unitPrice: 10, subtotal: 30 },
        { medicationStockId: 'stock-2', quantity: 7, unitPrice: 15, subtotal: 105 },
      ];
      const sale = makeSaleWithItems();

      jest.spyOn(service, 'findOne').mockResolvedValue(sale as any);
      saleRepo.findOne!.mockResolvedValue(makeSaleWithItems(saleItems));
      stockRepo.findOne!.mockResolvedValueOnce(stock1).mockResolvedValueOnce(stock2);
      stockRepo.save!.mockResolvedValue({});
      movementRepo.save!.mockResolvedValue({});
      saleRepo.save!.mockResolvedValue({ ...sale, status: SaleStatus.CANCELLED });

      await service.updateStatus('sale-1', { status: SaleStatus.CANCELLED });

      expect(stockRepo.save).toHaveBeenCalledTimes(2);
      expect(stockRepo.save).toHaveBeenCalledWith(expect.objectContaining({ quantity: 13 })); // 10 + 3
      expect(stockRepo.save).toHaveBeenCalledWith(expect.objectContaining({ quantity: 27 })); // 20 + 7
    });

    it('omite ítems sin medicationStockId al cancelar', async () => {
      const saleItems = [{ medicationStockId: null, quantity: 5 }];
      const sale = makeSaleWithItems();

      jest.spyOn(service, 'findOne').mockResolvedValue(sale as any);
      saleRepo.findOne!.mockResolvedValue(makeSaleWithItems(saleItems));
      saleRepo.save!.mockResolvedValue({ ...sale, status: SaleStatus.CANCELLED });

      await service.updateStatus('sale-1', { status: SaleStatus.CANCELLED });

      // No debe tocar el stock ni crear movimientos
      expect(stockRepo.findOne).not.toHaveBeenCalled();
      expect(movementRepo.save).not.toHaveBeenCalled();
    });

    it('no restaura stock si la venta ya estaba cancelada', async () => {
      const sale = { ...makeSaleWithItems(), status: SaleStatus.CANCELLED };

      jest.spyOn(service, 'findOne').mockResolvedValue(sale as any);
      saleRepo.findOne!.mockResolvedValue(sale);
      saleRepo.save!.mockResolvedValue(sale);

      await service.updateStatus('sale-1', { status: SaleStatus.CANCELLED });

      expect(stockRepo.findOne).not.toHaveBeenCalled();
    });
  });

  // ─── Validación de receta ─────────────────────────────────────────────────

  describe('validación de receta', () => {
    it('lanza NotFoundException si la receta no pertenece a la clínica', async () => {
      setupHappyPath();
      prescriptionRepo.findOne!.mockResolvedValue(null);

      const dto = { ...baseSaleDto(), prescriptionId: 'rx-999' };

      await expect(
        service.create(dto as any, 'user-1', 'clinic-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('lanza BadRequestException si la receta no está ACTIVE', async () => {
      setupHappyPath();
      prescriptionRepo.findOne!.mockResolvedValue({ status: 'dispensed' });

      const dto = { ...baseSaleDto(), prescriptionId: 'rx-999' };

      await expect(
        service.create(dto as any, 'user-1', 'clinic-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
