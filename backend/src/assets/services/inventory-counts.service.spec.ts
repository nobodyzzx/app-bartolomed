import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Asset, AssetStatus, AssetType } from '../entities/asset.entity';
import {
  InventoryCount,
  InventoryCountItem,
  InventoryCountStatus,
} from '../entities/inventory-count.entity';
import { InventoryCountsService } from './inventory-counts.service';

const CLINIC_ID = 'clinic-1';
const USER_ID = 'user-1';

const makeAsset = (overrides: Partial<Asset> = {}): Asset =>
  ({
    id: 'asset-1',
    assetTag: 'AF-0198',
    name: 'Sillones',
    quantity: 5,
    type: AssetType.FURNITURE,
    status: AssetStatus.ACTIVE,
    location: 'SALA DE ESPERA',
    isActive: true,
    ...overrides,
  }) as Asset;

const makeItem = (overrides: Partial<InventoryCountItem> = {}): InventoryCountItem =>
  ({
    id: 'item-1',
    assetId: 'asset-1',
    assetName: 'Sillones',
    assetTag: 'AF-0198',
    expectedQuantity: 5,
    countedQuantity: null,
    ...overrides,
  }) as InventoryCountItem;

describe('InventoryCountsService', () => {
  let service: InventoryCountsService;
  let countRepo: any;
  let itemRepo: any;
  let assetRepo: any;
  let em: any;
  let guardados: Array<[unknown, any]>;

  beforeEach(async () => {
    guardados = [];
    countRepo = { findOne: jest.fn(), find: jest.fn(), save: jest.fn() };
    itemRepo = { save: jest.fn() };
    assetRepo = { find: jest.fn().mockResolvedValue([makeAsset()]) };
    em = {
      findOne: jest.fn(),
      create: jest.fn((_cls: unknown, data: any) => ({ ...data })),
      save: jest.fn((cls: unknown, entity: any) => {
        guardados.push([cls, entity]);
        return Promise.resolve(Array.isArray(entity) ? entity : { id: 'count-1', ...entity });
      }),
      query: jest.fn().mockResolvedValue([{ n: 0 }]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryCountsService,
        { provide: getRepositoryToken(InventoryCount), useValue: countRepo },
        { provide: getRepositoryToken(InventoryCountItem), useValue: itemRepo },
        { provide: getRepositoryToken(Asset), useValue: assetRepo },
        { provide: DataSource, useValue: { transaction: (cb: any) => cb(em) } },
      ],
    }).compile();

    service = module.get(InventoryCountsService);
  });

  const savedOf = (name: string) =>
    guardados.filter(([cls]) => (cls as any)?.name === name).map(([, e]) => e);

  describe('start', () => {
    it('congela la cantidad esperada de cada ítem al abrir el conteo', async () => {
      countRepo.findOne.mockResolvedValue(null);
      assetRepo.find.mockResolvedValue([makeAsset(), makeAsset({ id: 'asset-2', quantity: 2 })]);
      em.findOne.mockResolvedValue({ id: 'count-1', items: [] });

      await service.start({ location: 'SALA DE ESPERA' }, USER_ID, CLINIC_ID);

      const items = savedOf('InventoryCountItem')[0];
      expect(items).toHaveLength(2);
      // El esperado se copia acá: si alguien edita el inventario durante el
      // recorrido, la diferencia se sigue midiendo contra lo que había al abrir.
      expect(items[0].expectedQuantity).toBe(5);
      expect(items[1].expectedQuantity).toBe(2);
      // Null y no 0: "sin contar" no es "no encontrado".
      expect(items[0].countedQuantity).toBeNull();
    });

    it('numera los conteos como CONT-<año>-0001', async () => {
      countRepo.findOne.mockResolvedValue(null);
      em.findOne.mockResolvedValue({ id: 'count-1', items: [] });

      await service.start({}, USER_ID, CLINIC_ID);

      const año = new Date().getFullYear();
      expect(savedOf('InventoryCount')[0].countNumber).toBe(`CONT-${año}-0001`);
    });

    it('no deja abrir dos conteos del mismo ambiente a la vez', async () => {
      countRepo.findOne.mockResolvedValue({ countNumber: 'CONT-2026-0001' });

      await expect(service.start({ location: 'SALA DE ESPERA' }, USER_ID, CLINIC_ID)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('no abre un conteo de un ambiente sin ítems', async () => {
      countRepo.findOne.mockResolvedValue(null);
      assetRepo.find.mockResolvedValue([]);

      await expect(service.start({ location: 'VACÍO' }, USER_ID, CLINIC_ID)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('excluye del conteo lo que ya no está en el piso', async () => {
      countRepo.findOne.mockResolvedValue(null);
      em.findOne.mockResolvedValue({ id: 'count-1', items: [] });

      await service.start({}, USER_ID, CLINIC_ID);

      const where = assetRepo.find.mock.calls[0][0].where;
      let excluidos = where.status;
      while (excluidos && !Array.isArray(excluidos)) excluidos = excluidos.value;
      expect(excluidos).toEqual([AssetStatus.RETIRED, AssetStatus.SOLD, AssetStatus.LOST]);
    });
  });

  describe('close', () => {
    const abrirConteo = (items: InventoryCountItem[]) => {
      em.findOne.mockImplementation((cls: any) =>
        cls === InventoryCount
          ? Promise.resolve({ id: 'count-1', countNumber: 'CONT-2026-0001', status: InventoryCountStatus.OPEN, items })
          : Promise.resolve(makeAsset()),
      );
    };

    it('ajusta la cantidad al valor contado', async () => {
      abrirConteo([makeItem({ countedQuantity: 4 })]);

      await service.close('count-1', {}, USER_ID, CLINIC_ID);

      expect(savedOf('Asset')[0].quantity).toBe(4);
    });

    it('un ítem contado en cero pasa a extraviado, no se borra', async () => {
      abrirConteo([makeItem({ countedQuantity: 0 })]);

      await service.close('count-1', {}, USER_ID, CLINIC_ID);

      const asset = savedOf('Asset')[0];
      // Conserva código, cantidad e historial: lo que pasó es que no apareció.
      expect(asset.status).toBe(AssetStatus.LOST);
      expect(asset.notes).toContain('CONT-2026-0001');
    });

    it('no toca las líneas sin contar', async () => {
      abrirConteo([makeItem({ countedQuantity: null as unknown as number })]);

      await service.close('count-1', {}, USER_ID, CLINIC_ID);

      expect(savedOf('Asset')).toHaveLength(0);
    });

    it('no toca las líneas cuyo conteo coincide', async () => {
      abrirConteo([makeItem({ countedQuantity: 5 })]);

      await service.close('count-1', {}, USER_ID, CLINIC_ID);

      expect(savedOf('Asset')).toHaveLength(0);
    });

    it('con adjustInventory en false deja constancia sin tocar el stock', async () => {
      abrirConteo([makeItem({ countedQuantity: 1 })]);

      await service.close('count-1', { adjustInventory: false }, USER_ID, CLINIC_ID);

      expect(savedOf('Asset')).toHaveLength(0);
      expect(savedOf('InventoryCount')[0].status).toBe(InventoryCountStatus.CLOSED);
    });

    it('no deja cerrar dos veces', async () => {
      em.findOne.mockResolvedValue({ id: 'count-1', status: InventoryCountStatus.CLOSED, items: [] });

      await expect(service.close('count-1', {}, USER_ID, CLINIC_ID)).rejects.toThrow(BadRequestException);
    });
  });

  describe('summarize', () => {
    it('separa contados, faltantes, sobrantes y sin contar', () => {
      const resumen = service.summarize({
        items: [
          makeItem({ expectedQuantity: 5, countedQuantity: 4 }), // falta
          makeItem({ expectedQuantity: 1, countedQuantity: 1 }), // coincide
          makeItem({ expectedQuantity: 1, countedQuantity: 2 }), // sobra
          makeItem({ expectedQuantity: 2, countedQuantity: null as unknown as number }), // sin contar
        ],
      } as InventoryCount);

      expect(resumen).toEqual({
        items: 4,
        contados: 3,
        sinContar: 1,
        coinciden: 1,
        faltantes: 1,
        sobrantes: 1,
        unidadesEsperadas: 9,
        unidadesContadas: 7,
      });
    });
  });
});
