import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AuditService } from 'src/audit/audit.service';
import { PharmacySalesService } from './pharmacy-sales.service';
import { PharmacySale, PharmacySaleItem, SaleStatus } from '../entities/pharmacy-sale.entity';
import { ChargesService } from '../../charges/charges.service';
import { Medication, MedicationStock, MovementType, StockMovement } from '../entities/pharmacy.entity';
import { Prescription, PrescriptionStatus } from 'src/prescriptions/entities/prescription.entity';
import { InventoryService } from './inventory.service';
import { createMockRepository, MockRepository } from 'src/test/helpers/mock-repository.factory';
import { makeMedicationStock } from 'src/test/helpers/test-data.factory';

describe('PharmacySalesService', () => {
  let service: PharmacySalesService;
  let saleRepo: MockRepository<PharmacySale>;
  let saleItemRepo: MockRepository<PharmacySaleItem>;
  let stockRepo: MockRepository<MedicationStock>;
  let movementRepo: MockRepository<StockMovement>;
  let medicationRepo: any;
  let lockedBuilder: any;
  let prescriptionRepo: MockRepository<Prescription>;
  let chargesService: { create: jest.Mock; findByOrigin: jest.Mock; cancel: jest.Mock };

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
        { provide: AuditService, useValue: { log: jest.fn() } },
        // Fase 4: la venta con receta puede quedar a cuenta del paciente.
        {
          provide: ChargesService,
          useValue: { create: jest.fn(), findByOrigin: jest.fn(), cancel: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<PharmacySalesService>(PharmacySalesService);
    saleRepo = module.get(getRepositoryToken(PharmacySale));
    saleItemRepo = module.get(getRepositoryToken(PharmacySaleItem));
    stockRepo = module.get(getRepositoryToken(MedicationStock));
    movementRepo = module.get(getRepositoryToken(StockMovement));
    prescriptionRepo = module.get(getRepositoryToken(Prescription));
    chargesService = module.get(ChargesService);
    medicationRepo = {
      createQueryBuilder: jest.fn().mockReturnValue({
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({ id: 'med-1', name: 'Paracetamol 500mg' }),
      }),
    } as any;

    // create() ahora corre dentro de una transacción; el manager mockeado devuelve
    // los mismos mocks de arriba para que las aserciones existentes sigan funcionando.
    (saleRepo as any).manager = {
      transaction: jest.fn().mockImplementation(async (fn: (m: any) => any) =>
        fn({
          getRepository: (entity: any) => {
            if (entity === PharmacySale) return saleRepo;
            if (entity === PharmacySaleItem) return saleItemRepo;
            if (entity === MedicationStock) return stockRepo;
            if (entity === StockMovement) return movementRepo;
            if (entity === Prescription) return prescriptionRepo;
            // El nombre del medicamento se lee aparte del stock: el lock va sin
            // joins porque `medication` es una relación eager.
            if (entity === Medication) return medicationRepo;
            throw new Error('Unexpected entity in manager.getRepository mock');
          },
        }),
      ),
    };

    // El stock se relee con QueryBuilder + setLock (sin joins, porque
    // `medication` es eager y Postgres rechaza FOR UPDATE sobre un outer join).
    // El mock delega en `findOne` para que los tests sigan expresándose con él.
    lockedBuilder = {
      setLock: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: () => stockRepo.findOne!(),
    };
    stockRepo.createQueryBuilder!.mockImplementation(() => lockedBuilder as any);
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

      await expect(service.create(baseSaleDto() as any, 'user-1', 'clinic-1')).rejects.toThrow(NotFoundException);
    });

    it('lanza BadRequestException si el stock disponible es insuficiente', async () => {
      const stock = makeMedicationStock({ quantity: 3, reservedQuantity: 0 });
      stockRepo.findOne!.mockResolvedValue(stock);

      const dto = { ...baseSaleDto(), items: [{ medicationStockId: 'stock-1', quantity: 10, unitPrice: 25.5 }] };

      await expect(service.create(dto as any, 'user-1', 'clinic-1')).rejects.toThrow(BadRequestException);
    });

    it('considera el stock reservado al calcular disponibilidad', async () => {
      // 100 totales - 95 reservados = 5 disponibles, pedimos 6 → falla
      const stock = makeMedicationStock({ quantity: 100, reservedQuantity: 95 });
      stockRepo.findOne!.mockResolvedValue(stock);

      const dto = { ...baseSaleDto(), items: [{ medicationStockId: 'stock-1', quantity: 6, unitPrice: 25.5 }] };

      await expect(service.create(dto as any, 'user-1', 'clinic-1')).rejects.toThrow(BadRequestException);
    });

    it('relee el stock CON LOCK dentro de la transacción (bug real: antes se validaba con un valor cacheado antes de abrir la transacción, permitiendo stock negativo en ventas concurrentes)', async () => {
      setupHappyPath({ quantity: 100 });

      await service.create(baseSaleDto() as any, 'user-1', 'clinic-1');

      // El lock se toma con QueryBuilder: `findOne` con `lock` no sirve aquí
      // porque las relaciones eager lo convierten en un outer join y Postgres
      // rechaza FOR UPDATE sobre ellos (rompía TODA venta con un 500).
      expect(stockRepo.createQueryBuilder).toHaveBeenCalled();
      expect(lockedBuilder.setLock).toHaveBeenCalledWith('pessimistic_write');
    });
  });

  // ─── Reducción de stock ───────────────────────────────────────────────────

  describe('reducción de stock al vender', () => {
    it('reduce la cantidad del stock en el número vendido', async () => {
      setupHappyPath({ quantity: 100 });

      await service.create(baseSaleDto() as any, 'user-1', 'clinic-1');

      expect(stockRepo.save).toHaveBeenCalledWith(expect.objectContaining({ quantity: 95 }));
    });

    it('registra un movimiento de stock tipo SALE', async () => {
      setupHappyPath();

      await service.create(baseSaleDto() as any, 'user-1', 'clinic-1');

      expect(movementRepo.save).toHaveBeenCalledWith(expect.objectContaining({ type: 'sale' }));
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

      stockRepo.findOne!.mockResolvedValueOnce(stock1).mockResolvedValueOnce(stock2);
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
      // Sin IVA: subtotal = 5 × 25.5 = 127.5 y el total es ese mismo.
      const dto = { ...baseSaleDto(), amountPaid: 127.5 };

      await service.create(dto as any, 'user-1', 'clinic-1');

      const savedSaleCall = saleRepo.save!.mock.calls[0][0];
      expect(savedSaleCall.change).toBeCloseTo(0);
    });

    /**
     * Un descuento sin motivo no se registra: es la regla que ya tenía el punto de
     * cobro, donde `charges` guarda `discount_reason` y quién lo autorizó. Aquí se
     * podía rebajar cualquier importe sin dejar constancia de por qué.
     */
    it('rechaza un descuento sobre el total sin motivo', async () => {
      setupHappyPath();
      const dto = { ...baseSaleDto(), discountAmount: 10 };

      await expect(service.create(dto as any, 'user-1', 'clinic-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rechaza un descuento por línea sin motivo', async () => {
      setupHappyPath();
      const dto = { ...baseSaleDto() };
      dto.items[0] = { ...dto.items[0], discountPercent: 10 } as any;

      await expect(service.create(dto as any, 'user-1', 'clinic-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('guarda el motivo y quién autorizó el descuento', async () => {
      setupHappyPath();
      const dto = { ...baseSaleDto(), discountAmount: 10, discountReason: '  Programa municipal  ' };

      await service.create(dto as any, 'user-1', 'clinic-1');

      const saved = saleRepo.save!.mock.calls[0][0];
      expect(saved.discountReason).toBe('Programa municipal');
      expect(saved.discountAuthorizedById).toBe('user-1');
    });

    it('no marca autorizante si no hubo descuento', async () => {
      setupHappyPath();

      await service.create(baseSaleDto() as any, 'user-1', 'clinic-1');

      const saved = saleRepo.save!.mock.calls[0][0];
      expect(saved.discountAuthorizedById).toBeNull();
      expect(saved.discountReason).toBeNull();
    });

    /**
     * La pantalla mostraba `subtotal - descuento` como total mientras el backend
     * añadía un 13% por defecto: el farmacéutico cobraba 20,00 y la venta quedaba
     * registrada en 22,60. El precio del tarifario es el precio final.
     */
    it('no aplica IVA: el total es subtotal menos descuento', async () => {
      setupHappyPath();
      const dto = { ...baseSaleDto(), taxRate: 0.13, discountAmount: 7.5, discountReason: 'Promoción' };

      await service.create(dto as any, 'user-1', 'clinic-1');

      const saved = saleRepo.save!.mock.calls[0][0];
      expect(saved.subtotal).toBeCloseTo(127.5);
      expect(saved.tax).toBe(0);
      expect(saved.taxRate).toBe(0);
      expect(saved.total).toBeCloseTo(120);
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
          { medicationStockId: 'stock-1', quantity: 2, unitPrice: 10 }, // 20
          { medicationStockId: 'stock-2', quantity: 3, unitPrice: 15 }, // 45
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

    /**
     * Al cancelar, la venta a cuenta tiene que deshacer TODO lo que hizo: el
     * stock (ya cubierto abajo), el cargo pendiente y la receta. Antes solo
     * devolvía el stock, así que el paciente conservaba el cobro de un
     * medicamento devuelto y la receta quedaba consumida para siempre.
     */
    const setupCancel = (saleOverrides: Record<string, any> = {}) => {
      const stock = makeMedicationStock({ id: 'stock-1', quantity: 10 });
      const saleItems = [{ medicationStockId: 'stock-1', quantity: 5, unitPrice: 25, subtotal: 125 }];
      const sale = { ...makeSaleWithItems(), ...saleOverrides };

      jest.spyOn(service, 'findOne').mockResolvedValue(sale as any);
      saleRepo.findOne!.mockResolvedValue(makeSaleWithItems(saleItems));
      stockRepo.findOne!.mockResolvedValue(stock);
      stockRepo.save!.mockResolvedValue({ ...stock, quantity: 15 });
      movementRepo.save!.mockResolvedValue({});
      saleRepo.save!.mockResolvedValue({ ...sale, status: SaleStatus.CANCELLED });
      prescriptionRepo.update!.mockResolvedValue({} as any);
      return sale;
    };

    it('anula el cargo a cuenta al cancelar la venta', async () => {
      setupCancel({ chargedToAccount: true });
      chargesService.findByOrigin.mockResolvedValue({ id: 'charge-1', status: 'pending' });

      await service.updateStatus('sale-1', { status: SaleStatus.CANCELLED }, 'clinic-1');

      expect(chargesService.cancel).toHaveBeenCalledWith(
        'charge-1',
        expect.stringContaining('VTA-001'),
        'clinic-1',
      );
    });

    it('rechaza cancelar si el cargo ya se facturó, y no toca el stock', async () => {
      setupCancel({ chargedToAccount: true });
      chargesService.findByOrigin.mockResolvedValue({ id: 'charge-1', status: 'invoiced' });

      await expect(
        service.updateStatus('sale-1', { status: SaleStatus.CANCELLED }, 'clinic-1'),
      ).rejects.toThrow(BadRequestException);

      expect(stockRepo.save).not.toHaveBeenCalled();
      expect(chargesService.cancel).not.toHaveBeenCalled();
    });

    it('devuelve la receta a ACTIVE al cancelar', async () => {
      setupCancel({ prescriptionId: 'presc-1' });

      await service.updateStatus('sale-1', { status: SaleStatus.CANCELLED }, 'clinic-1');

      expect(prescriptionRepo.update).toHaveBeenCalledWith('presc-1', {
        status: PrescriptionStatus.ACTIVE,
      });
    });

    it('no busca cargo cuando la venta no quedó a cuenta', async () => {
      setupCancel({ chargedToAccount: false });

      await service.updateStatus('sale-1', { status: SaleStatus.CANCELLED }, 'clinic-1');

      expect(chargesService.findByOrigin).not.toHaveBeenCalled();
      expect(chargesService.cancel).not.toHaveBeenCalled();
    });

    // El bloque de ajuste leía `(sale as any).totalAmount` —inexistente— así que
    // el total era siempre 0 y el vuelto salía igual a lo recibido; además lo
    // escribía en `changeAmount`, una propiedad fantasma que no se persiste.
    it('calcula el vuelto contra el total real de la venta', async () => {
      const sale = { ...makeSaleWithItems(), total: 80, change: 0, amountPaid: 0 };
      jest.spyOn(service, 'findOne').mockResolvedValue(sale as any);
      saleRepo.save!.mockImplementation(async (v: any) => v);

      await service.updateStatus(
        'sale-1',
        { status: SaleStatus.COMPLETED, amountPaid: 100 },
        'clinic-1',
      );

      expect(saleRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ amountPaid: 100, change: 20 }),
      );
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

      await service.updateStatus('sale-1', { status: SaleStatus.CANCELLED }, 'clinic-1');

      // Stock debe guardarse con 10 + 5 = 15
      expect(stockRepo.save).toHaveBeenCalledWith(expect.objectContaining({ quantity: 15 }));
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

      await service.updateStatus('sale-1', { status: SaleStatus.CANCELLED }, 'clinic-1');

      expect(movementRepo.save).toHaveBeenCalledWith(expect.objectContaining({ type: MovementType.ADJUSTMENT }));
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

      await service.updateStatus('sale-1', { status: SaleStatus.CANCELLED }, 'clinic-1');

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

      await service.updateStatus('sale-1', { status: SaleStatus.CANCELLED }, 'clinic-1');

      // No debe tocar el stock ni crear movimientos
      expect(stockRepo.findOne).not.toHaveBeenCalled();
      expect(movementRepo.save).not.toHaveBeenCalled();
    });

    it('no restaura stock si la venta ya estaba cancelada', async () => {
      const sale = { ...makeSaleWithItems(), status: SaleStatus.CANCELLED };

      jest.spyOn(service, 'findOne').mockResolvedValue(sale as any);
      saleRepo.findOne!.mockResolvedValue(sale);
      saleRepo.save!.mockResolvedValue(sale);

      await service.updateStatus('sale-1', { status: SaleStatus.CANCELLED }, 'clinic-1');

      expect(stockRepo.findOne).not.toHaveBeenCalled();
    });
  });

  // ─── Validación de receta ─────────────────────────────────────────────────

  describe('validación de receta', () => {
    it('lanza NotFoundException si la receta no pertenece a la clínica', async () => {
      setupHappyPath();
      prescriptionRepo.findOne!.mockResolvedValue(null);

      const dto = { ...baseSaleDto(), prescriptionId: 'rx-999' };

      await expect(service.create(dto as any, 'user-1', 'clinic-1')).rejects.toThrow(NotFoundException);
    });

    it('lanza BadRequestException si la receta no está ACTIVE', async () => {
      setupHappyPath();
      prescriptionRepo.findOne!.mockResolvedValue({ status: 'dispensed' });

      const dto = { ...baseSaleDto(), prescriptionId: 'rx-999' };

      await expect(service.create(dto as any, 'user-1', 'clinic-1')).rejects.toThrow(BadRequestException);
    });
  });

  // ─── Scoping por clínica (bug real: findOne/update/updateStatus/remove no filtraban) ──

  describe('scoping por clínica', () => {
    const otherClinicSale = { id: 'sale-1', clinicId: 'clinic-OTHER', items: [], status: SaleStatus.PENDING };

    it('findOne lanza ForbiddenException si la venta pertenece a otra clínica', async () => {
      saleRepo.findOne!.mockResolvedValue(otherClinicSale);

      await expect(service.findOne('sale-1', 'clinic-1')).rejects.toThrow('Access denied to this sale');
    });

    it('findOne no filtra si no se pasa clinicId (uso interno tras create())', async () => {
      saleRepo.findOne!.mockResolvedValue(otherClinicSale);

      await expect(service.findOne('sale-1')).resolves.toEqual(otherClinicSale);
    });

    it('update propaga el ForbiddenException de findOne si la venta es de otra clínica', async () => {
      saleRepo.findOne!.mockResolvedValue(otherClinicSale);

      await expect(service.update('sale-1', {} as any, 'clinic-1')).rejects.toThrow('Access denied to this sale');
    });

    it('updateStatus propaga el ForbiddenException de findOne si la venta es de otra clínica', async () => {
      saleRepo.findOne!.mockResolvedValue(otherClinicSale);

      await expect(service.updateStatus('sale-1', { status: SaleStatus.CANCELLED } as any, 'clinic-1')).rejects.toThrow(
        'Access denied to this sale',
      );
    });

    it('remove propaga el ForbiddenException de findOne si la venta es de otra clínica', async () => {
      saleRepo.findOne!.mockResolvedValue(otherClinicSale);

      await expect(service.remove('sale-1', 'clinic-1')).rejects.toThrow('Access denied to this sale');
    });
  });

  // ─── update: recálculo de totales al editar ítems ────────────────────────

  describe('update — recálculo de totales al editar ítems', () => {
    /**
     * Regresión: bug real corregido en la auditoría de interrelación de
     * módulos (2026-08-04). update() recalculaba el impuesto con 0.13
     * hardcodeado en vez de la tasa con la que se creó la venta (persistida
     * ahora en taxRate) — una venta exenta (taxRate: 0) quedaba recalculada
     * al 13% al editar sus ítems.
     */
    it('usa la taxRate original de la venta (exenta), no 13% fijo', async () => {
      const sale = { id: 'sale-1', clinicId: 'clinic-1', status: SaleStatus.PENDING, taxRate: 0, items: [] };
      saleRepo.findOne!.mockResolvedValue(sale);
      saleItemRepo.delete!.mockResolvedValue({});
      saleItemRepo.create!.mockImplementation((v: any) => v);
      saleItemRepo.save!.mockResolvedValue({});
      saleRepo.save!.mockImplementation(async (v: any) => v);

      await service.update(
        'sale-1',
        { items: [{ medicationStockId: 'stock-1', quantity: 2, unitPrice: 50 }] } as any,
        'clinic-1',
      );

      const saved = saleRepo.save!.mock.calls[0][0];
      expect(saved.tax).toBe(0);
      expect(saved.total).toBe(100);
    });

    it('usa la taxRate original de la venta (13%) al editar ítems', async () => {
      const sale = { id: 'sale-1', clinicId: 'clinic-1', status: SaleStatus.PENDING, taxRate: 0.13, items: [] };
      saleRepo.findOne!.mockResolvedValue(sale);
      saleItemRepo.delete!.mockResolvedValue({});
      saleItemRepo.create!.mockImplementation((v: any) => v);
      saleItemRepo.save!.mockResolvedValue({});
      saleRepo.save!.mockImplementation(async (v: any) => v);

      await service.update(
        'sale-1',
        { items: [{ medicationStockId: 'stock-1', quantity: 2, unitPrice: 50 }] } as any,
        'clinic-1',
      );

      const saved = saleRepo.save!.mock.calls[0][0];
      expect(saved.tax).toBeCloseTo(13);
      expect(saved.total).toBeCloseTo(113);
    });
  });

  // ─── listWithFilters — búsqueda ───────────────────────────────────────────

  describe('listWithFilters: búsqueda', () => {
    const makeQb = () => ({
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    });

    /**
     * La pantalla filtraba con `MatTableDataSource.filter`, que solo mira las filas
     * de la página cargada: buscar algo de la página 3 devolvía "sin resultados".
     * La búsqueda tiene que ir a la consulta.
     */
    it('filtra por número de venta o nombre del paciente, en minúsculas', async () => {
      const qb = makeQb();
      saleRepo.createQueryBuilder!.mockReturnValue(qb as any);

      await service.listWithFilters({ clinicId: 'clinic-1', search: '  Ana  ' });

      const [sql, params] = qb.andWhere.mock.calls.find(c => String(c[0]).includes('saleNumber'))!;
      expect(String(sql)).toContain('translate');
      expect(params).toEqual({ term: '%ana%' });
    });

    // En Bolivia los nombres llevan tilde y nadie la escribe al buscar: "Noemi"
    // tiene que encontrar a "Noemí". Se resuelve con `translate` en los dos lados
    // —consulta y término— para no depender de la extensión `unaccent`.
    it('ignora los acentos del término de búsqueda', async () => {
      const qb = makeQb();
      saleRepo.createQueryBuilder!.mockReturnValue(qb as any);

      await service.listWithFilters({ clinicId: 'clinic-1', search: 'Noemí' });

      const [, params] = qb.andWhere.mock.calls.find(c => String(c[0]).includes('saleNumber'))!;
      expect(params).toEqual({ term: '%noemi%' });
    });

    it('no añade la condición si la búsqueda viene vacía o en blanco', async () => {
      const qb = makeQb();
      saleRepo.createQueryBuilder!.mockReturnValue(qb as any);

      await service.listWithFilters({ clinicId: 'clinic-1', search: '   ' });

      const condiciones = qb.andWhere.mock.calls.map(c => String(c[0]));
      expect(condiciones.some(c => c.includes('saleNumber'))).toBe(false);
    });
  });
});
