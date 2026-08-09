import { BadRequestException } from '@nestjs/common';
import { InventoryController } from './inventory.controller';
import { InventoryService } from '../services/inventory.service';

const makeReq = (overrides: Record<string, any> = {}) =>
  ({ headers: { 'x-clinic-id': 'clinic-1' }, params: {}, ...overrides }) as any;

describe('InventoryController', () => {
  let controller: InventoryController;
  let service: jest.Mocked<InventoryService>;

  beforeEach(() => {
    service = {
      createMedication: jest.fn().mockResolvedValue({ id: 'med-1' }),
      findAllMedications: jest.fn().mockResolvedValue({ data: [], total: 0 }),
      searchMedications: jest.fn().mockResolvedValue([]),
      findMedicationById: jest.fn().mockResolvedValue({ id: 'med-1' }),
      updateMedication: jest.fn().mockResolvedValue({ id: 'med-1' }),
      deleteMedication: jest.fn().mockResolvedValue(undefined),
      addStock: jest.fn().mockResolvedValue({ id: 'stock-1' }),
      findAllStock: jest.fn().mockResolvedValue({ data: [], total: 0 }),
      getLowStockItems: jest.fn().mockResolvedValue([]),
      getExpiringItems: jest.fn().mockResolvedValue([]),
      findStockById: jest.fn().mockResolvedValue({ id: 'stock-1' }),
      updateStock: jest.fn().mockResolvedValue({ id: 'stock-1' }),
      deleteStock: jest.fn().mockResolvedValue(undefined),
      reserveStock: jest.fn().mockResolvedValue({ id: 'stock-1' }),
      releaseStock: jest.fn().mockResolvedValue({ id: 'stock-1' }),
      consumeStock: jest.fn().mockResolvedValue({ id: 'stock-1' }),
      transferStock: jest.fn().mockResolvedValue({ id: 'transfer-1' }),
    } as unknown as jest.Mocked<InventoryService>;
    controller = new InventoryController(service);
  });

  it('createMedication delega el dto', async () => {
    const dto = { name: 'Paracetamol' } as any;
    await controller.createMedication(dto);
    expect(service.createMedication).toHaveBeenCalledWith(dto);
  });

  describe('findAllMedications', () => {
    it('usa page/limit por defecto (1/100) si no vienen', async () => {
      await controller.findAllMedications();
      expect(service.findAllMedications).toHaveBeenCalledWith(1, 100);
    });

    it('convierte page/limit a número si vienen', async () => {
      await controller.findAllMedications(2 as any, 50 as any);
      expect(service.findAllMedications).toHaveBeenCalledWith(2, 50);
    });
  });

  it('searchMedications delega el término', async () => {
    await controller.searchMedications('paracetamol');
    expect(service.searchMedications).toHaveBeenCalledWith('paracetamol');
  });

  it('findMedicationById delega el id', async () => {
    await controller.findMedicationById('med-1');
    expect(service.findMedicationById).toHaveBeenCalledWith('med-1');
  });

  it('updateMedication delega id y dto', async () => {
    const dto = { name: 'Actualizado' } as any;
    await controller.updateMedication('med-1', dto);
    expect(service.updateMedication).toHaveBeenCalledWith('med-1', dto);
  });

  it('deleteMedication delega el id', async () => {
    await controller.deleteMedication('med-1');
    expect(service.deleteMedication).toHaveBeenCalledWith('med-1');
  });

  it('addStock resuelve clinicId y delega el dto', async () => {
    const dto = { medicationId: 'med-1' } as any;
    await controller.addStock(dto, makeReq());
    expect(service.addStock).toHaveBeenCalledWith(dto, 'clinic-1');
  });

  describe('findAllStock', () => {
    it('lanza BadRequestException si no hay contexto de clínica', () => {
      expect(() => controller.findAllStock(makeReq({ headers: {} }))).toThrow(BadRequestException);
      expect(service.findAllStock).not.toHaveBeenCalled();
    });

    it('usa page/limit por defecto (1/100) si no vienen', () => {
      controller.findAllStock(makeReq());
      expect(service.findAllStock).toHaveBeenCalledWith('clinic-1', 1, 100);
    });

    it('convierte page/limit a número si vienen', () => {
      controller.findAllStock(makeReq(), 3 as any, 10 as any);
      expect(service.findAllStock).toHaveBeenCalledWith('clinic-1', 3, 10);
    });
  });

  it('getLowStockItems lanza BadRequestException si no hay contexto de clínica', () => {
    expect(() => controller.getLowStockItems(makeReq({ headers: {} }))).toThrow(BadRequestException);
  });

  it('getLowStockItems delega clinicId', () => {
    controller.getLowStockItems(makeReq());
    expect(service.getLowStockItems).toHaveBeenCalledWith('clinic-1');
  });

  it('getExpiringItems lanza BadRequestException si no hay contexto de clínica', () => {
    expect(() => controller.getExpiringItems(makeReq({ headers: {} }))).toThrow(BadRequestException);
  });

  it('getExpiringItems delega clinicId y days', () => {
    controller.getExpiringItems(makeReq(), 15);
    expect(service.getExpiringItems).toHaveBeenCalledWith('clinic-1', 15);
  });

  it('findStockById delega id y clinicId', async () => {
    await controller.findStockById('stock-1', makeReq());
    expect(service.findStockById).toHaveBeenCalledWith('stock-1', 'clinic-1');
  });

  it('updateStock delega id, dto y clinicId', async () => {
    const dto = { availableQuantity: 5 } as any;
    await controller.updateStock('stock-1', dto, makeReq());
    expect(service.updateStock).toHaveBeenCalledWith('stock-1', dto, 'clinic-1');
  });

  it('deleteStock delega id y clinicId', async () => {
    await controller.deleteStock('stock-1', makeReq());
    expect(service.deleteStock).toHaveBeenCalledWith('stock-1', 'clinic-1');
  });

  it('reserveStock delega id, quantity y clinicId', async () => {
    await controller.reserveStock('stock-1', 3, makeReq());
    expect(service.reserveStock).toHaveBeenCalledWith('stock-1', 3, 'clinic-1');
  });

  it('releaseStock delega id, quantity y clinicId', async () => {
    await controller.releaseStock('stock-1', 3, makeReq());
    expect(service.releaseStock).toHaveBeenCalledWith('stock-1', 3, 'clinic-1');
  });

  it('consumeStock delega id, quantity y clinicId', async () => {
    await controller.consumeStock('stock-1', 3, makeReq());
    expect(service.consumeStock).toHaveBeenCalledWith('stock-1', 3, 'clinic-1');
  });

  it('transferStock delega el dto y clinicId', async () => {
    const dto = { fromStockId: 'a', toClinicId: 'b' } as any;
    await controller.transferStock(dto, makeReq());
    expect(service.transferStock).toHaveBeenCalledWith(dto, 'clinic-1');
  });
});
