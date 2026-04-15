import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PurchaseOrdersService } from './purchase-orders.service';
import { PurchaseOrder, PurchaseOrderItem, PurchaseOrderStatus } from '../entities/purchase-order.entity';
import { Supplier, SupplierStatus } from '../entities/supplier.entity';
import { InventoryService } from './inventory.service';
import { createMockRepository, MockRepository } from 'src/test/helpers/mock-repository.factory';

const makeSupplier = (overrides: Record<string, any> = {}) => ({
  id: 'sup-1',
  nombreComercial: 'Distribuidora SA',
  status: SupplierStatus.ACTIVE,
  isActive: true,
  ...overrides,
});

const makePurchaseOrder = (overrides: Record<string, any> = {}) => ({
  id: 'po-1',
  orderNumber: 'PO-202604-0001',
  status: PurchaseOrderStatus.DRAFT,
  clinicId: 'clinic-1',
  supplierId: 'sup-1',
  items: [],
  subtotal: 500,
  totalAmount: 500,
  taxRate: 0,
  taxAmount: 0,
  discountAmount: 0,
  shippingCost: 0,
  ...overrides,
});

const mockInventoryService = {
  addStock: jest.fn(),
};

describe('PurchaseOrdersService', () => {
  let service: PurchaseOrdersService;
  let orderRepo: MockRepository<PurchaseOrder>;
  let itemRepo: MockRepository<PurchaseOrderItem>;
  let supplierRepo: MockRepository<Supplier>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PurchaseOrdersService,
        { provide: getRepositoryToken(PurchaseOrder), useValue: createMockRepository() },
        { provide: getRepositoryToken(PurchaseOrderItem), useValue: createMockRepository() },
        { provide: getRepositoryToken(Supplier), useValue: createMockRepository() },
        { provide: InventoryService, useValue: mockInventoryService },
      ],
    }).compile();

    service = module.get<PurchaseOrdersService>(PurchaseOrdersService);
    orderRepo = module.get(getRepositoryToken(PurchaseOrder));
    itemRepo = module.get(getRepositoryToken(PurchaseOrderItem));
    supplierRepo = module.get(getRepositoryToken(Supplier));
  });

  afterEach(() => jest.clearAllMocks());

  // ─── create ───────────────────────────────────────────────────────────────

  describe('create', () => {
    const baseDto = () => ({
      supplierId: 'sup-1',
      clinicId: 'clinic-1',
      orderDate: '2026-04-01',
      items: [
        { medicationName: 'Paracetamol', quantity: 10, unitPrice: 5 },
        { medicationName: 'Ibuprofeno', quantity: 20, unitPrice: 15 },
      ],
      taxRate: 0,
      discountAmount: 0,
      shippingCost: 0,
    });

    it('lanza NotFoundException si el proveedor no existe o está inactivo', async () => {
      supplierRepo.findOne!.mockResolvedValue(null);

      await expect(service.create(baseDto() as any, 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('calcula el total correctamente: 10×5 + 20×15 = 350', async () => {
      supplierRepo.findOne!.mockResolvedValue(makeSupplier());
      orderRepo.count!.mockResolvedValue(0);
      const savedOrder = makePurchaseOrder({ totalAmount: 350 });
      orderRepo.create!.mockReturnValue(savedOrder);
      orderRepo.save!.mockResolvedValue(savedOrder);
      itemRepo.create!.mockReturnValue({});
      itemRepo.save!.mockResolvedValue({});
      jest.spyOn(service, 'findOne').mockResolvedValue(savedOrder as any);

      await service.create(baseDto() as any, 'user-1');

      expect(orderRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ totalAmount: 350 }),
      );
    });
  });

  // ─── findAll ──────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('lanza BadRequestException si clinicId no se provee', async () => {
      await expect(service.findAll(undefined)).rejects.toThrow(BadRequestException);
    });

    it('retorna órdenes de una clínica', async () => {
      orderRepo.find!.mockResolvedValue([makePurchaseOrder()]);
      const result = await service.findAll('clinic-1');
      expect(result).toHaveLength(1);
    });
  });

  // ─── remove ───────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('rechaza eliminar una orden ya entregada', async () => {
      const order = makePurchaseOrder({ status: PurchaseOrderStatus.DELIVERED });
      orderRepo.findOne!.mockResolvedValue(order);

      await expect(service.remove('po-1', 'clinic-1')).rejects.toThrow(BadRequestException);
    });

    it('elimina orden en estado DRAFT', async () => {
      const order = makePurchaseOrder({ status: PurchaseOrderStatus.DRAFT });
      orderRepo.findOne!.mockResolvedValue(order);
      orderRepo.remove!.mockResolvedValue(order);

      await service.remove('po-1', 'clinic-1');

      expect(orderRepo.remove).toHaveBeenCalledWith(order);
    });
  });

  // ─── receive ──────────────────────────────────────────────────────────────

  describe('receive: recepción de mercancía y creación de stock', () => {
    /** Ítem de orden de compra con medicationId para que se cree stock */
    const makeOrderItem = (overrides: Record<string, any> = {}) => ({
      id: 'item-1',
      medicationId: 'med-1',
      medicationName: 'Paracetamol',
      productName: 'Paracetamol',
      quantity: 100,
      receivedQuantity: 0,
      unitPrice: 5,
      ...overrides,
    });

    const makeOrderWithItems = (items: any[]) =>
      makePurchaseOrder({ status: PurchaseOrderStatus.APPROVED, items });

    const setupReceive = (items: any[], finalOrder?: any) => {
      const order = makeOrderWithItems(items);
      orderRepo.findOne!
        .mockResolvedValueOnce(order)                // primera llamada dentro de receive()
        .mockResolvedValueOnce(finalOrder ?? order);  // findOne al final vía this.findOne()
      itemRepo.save!.mockResolvedValue({});
      orderRepo.save!.mockResolvedValue(order);
      mockInventoryService.addStock.mockResolvedValue({});
    };

    it('lanza BadRequestException si clinicId no se provee', async () => {
      await expect(
        service.receive('po-1', { items: [{ itemId: 'item-1', receivingQuantity: 10 }] }, undefined),
      ).rejects.toThrow(BadRequestException);
    });

    it('lanza NotFoundException si la orden no existe', async () => {
      orderRepo.findOne!.mockResolvedValue(null);

      await expect(
        service.receive('no-existe', { items: [{ itemId: 'item-1', receivingQuantity: 1 }] }, 'clinic-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('lanza BadRequestException si no se envían ítems', async () => {
      orderRepo.findOne!.mockResolvedValue(makeOrderWithItems([makeOrderItem()]));

      await expect(
        service.receive('po-1', { items: [] }, 'clinic-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('lanza BadRequestException si el ítem no pertenece a la orden', async () => {
      setupReceive([makeOrderItem({ id: 'item-correcto' })]);

      await expect(
        service.receive('po-1', { items: [{ itemId: 'item-inexistente', receivingQuantity: 5 }] }, 'clinic-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('lanza BadRequestException si la cantidad recibida excede lo pendiente', async () => {
      // ordered: 100, ya recibidos: 0, intenta recibir 150
      setupReceive([makeOrderItem({ quantity: 100, receivedQuantity: 0 })]);

      await expect(
        service.receive('po-1', { items: [{ itemId: 'item-1', receivingQuantity: 150 }] }, 'clinic-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('llama a inventoryService.addStock al recibir ítems con medicationId', async () => {
      setupReceive([makeOrderItem()]);

      await service.receive(
        'po-1',
        { items: [{ itemId: 'item-1', receivingQuantity: 50, batchNumber: 'L-001', expiryDate: '2027-06-30' }] },
        'clinic-1',
      );

      expect(mockInventoryService.addStock).toHaveBeenCalledWith(
        expect.objectContaining({
          medicationId: 'med-1',
          quantity: 50,
          clinicId: 'clinic-1',
        }),
        'clinic-1',
      );
    });

    it('no llama a addStock si el ítem no tiene medicationId', async () => {
      setupReceive([makeOrderItem({ medicationId: null })]);

      await service.receive(
        'po-1',
        { items: [{ itemId: 'item-1', receivingQuantity: 10 }] },
        'clinic-1',
      );

      expect(mockInventoryService.addStock).not.toHaveBeenCalled();
    });

    it('actualiza receivedQuantity acumulando con recepciones anteriores', async () => {
      // Ya habían llegado 30, llegan 40 más → debe quedar 70
      setupReceive([makeOrderItem({ quantity: 100, receivedQuantity: 30 })]);

      await service.receive(
        'po-1',
        { items: [{ itemId: 'item-1', receivingQuantity: 40 }] },
        'clinic-1',
      );

      expect(itemRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ receivedQuantity: 70 }),
      );
    });

    it('pone estado RECEIVED cuando todos los ítems se reciben completos', async () => {
      setupReceive([makeOrderItem({ quantity: 100, receivedQuantity: 0 })]);

      await service.receive(
        'po-1',
        { items: [{ itemId: 'item-1', receivingQuantity: 100 }] },
        'clinic-1',
      );

      expect(orderRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: PurchaseOrderStatus.RECEIVED }),
      );
    });

    it('pone estado PARTIALLY_RECEIVED cuando no se completan todos los ítems', async () => {
      setupReceive([makeOrderItem({ quantity: 100, receivedQuantity: 0 })]);

      await service.receive(
        'po-1',
        { items: [{ itemId: 'item-1', receivingQuantity: 60 }] }, // solo 60 de 100
        'clinic-1',
      );

      expect(orderRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: PurchaseOrderStatus.PARTIALLY_RECEIVED }),
      );
    });

    it('continúa aunque addStock falle (error tolerante)', async () => {
      setupReceive([makeOrderItem()]);
      mockInventoryService.addStock.mockRejectedValue(new Error('Stock error'));

      // No debe lanzar excepción; la recepción continúa
      await expect(
        service.receive(
          'po-1',
          { items: [{ itemId: 'item-1', receivingQuantity: 10 }] },
          'clinic-1',
        ),
      ).resolves.not.toThrow();
    });
  });
});
