import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { UserClinic } from '../../users/entities/user-clinic.entity';
import { AssetMovement } from '../entities/asset-movement.entity';
import { Asset, AssetStatus, AssetType } from '../entities/asset.entity';
import { AssetMovementsService } from './asset-movements.service';

const CLINIC_ID = 'clinic-1';
const OTRA_CLINICA = 'clinic-2';
const USER_ID = 'user-1';

const makeAsset = (overrides: Partial<Asset> = {}): Asset =>
  ({
    id: 'asset-1',
    assetTag: 'AF-0013',
    name: 'Sensores pectorales',
    quantity: 6,
    type: AssetType.MEDICAL_EQUIPMENT,
    status: AssetStatus.ACTIVE,
    location: 'SALA ECOGRAFIA',
    isActive: true,
    ...overrides,
  }) as Asset;

describe('AssetMovementsService', () => {
  let service: AssetMovementsService;
  let em: any;
  let membresias: any;
  let guardados: Array<[unknown, any]>;

  beforeEach(async () => {
    guardados = [];
    // Por defecto el usuario es miembro de la clínica destino: los casos que
    // prueban lo contrario lo apagan explícitamente.
    membresias = {
      findOne: jest.fn().mockResolvedValue({ id: 'uc-1' }),
      find: jest.fn().mockResolvedValue([]),
    };
    em = {
      findOne: jest.fn(),
      create: jest.fn((_cls: unknown, data: any) => ({ ...data })),
      save: jest.fn((cls: unknown, entity: any) => {
        guardados.push([cls, entity]);
        return Promise.resolve({ id: 'nuevo-id', ...entity });
      }),
      query: jest.fn().mockResolvedValue([{ max: 235 }]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssetMovementsService,
        { provide: getRepositoryToken(Asset), useValue: {} },
        { provide: getRepositoryToken(AssetMovement), useValue: { find: jest.fn(), createQueryBuilder: jest.fn() } },
        { provide: getRepositoryToken(UserClinic), useValue: membresias },
        { provide: DataSource, useValue: { transaction: (cb: any) => cb(em) } },
      ],
    }).compile();

    service = module.get(AssetMovementsService);
  });

  /** Lo guardado para una entidad concreta, en orden. */
  const savedOf = (name: string) => guardados.filter(([cls]) => (cls as any)?.name === name).map(([, e]) => e);

  it('mueve el ítem completo cambiándole el ambiente, sin crear otro', async () => {
    em.findOne.mockResolvedValueOnce(makeAsset());

    await service.move('asset-1', { toLocation: 'CUARTO' }, USER_ID, CLINIC_ID);

    const assets = savedOf('Asset');
    expect(assets).toHaveLength(1);
    expect(assets[0].location).toBe('CUARTO');
    // El código no cambia: es el que está rotulado en la cosa.
    expect(assets[0].assetTag).toBe('AF-0013');
    expect(savedOf('AssetMovement')[0]).toMatchObject({
      fromLocation: 'SALA ECOGRAFIA',
      toLocation: 'CUARTO',
      quantity: 6,
    });
  });

  it('al mover todo a un ambiente donde ya hay lo mismo, fusiona y retira la fila vacía', async () => {
    em.findOne
      .mockResolvedValueOnce(makeAsset()) // origen, 6 unidades
      .mockResolvedValueOnce(makeAsset({ id: 'asset-9', assetTag: 'AF-0200', quantity: 2, location: 'CUARTO' }));

    await service.move('asset-1', { toLocation: 'CUARTO' }, USER_ID, CLINIC_ID);

    const [destino, origen] = savedOf('Asset');
    // 2 + 6 en una sola fila: un código rotula un montón de cosas iguales, y dos
    // filas de lo mismo en el mismo cuarto harían contarlo dos veces.
    expect(destino.quantity).toBe(8);
    expect(origen.isActive).toBe(false);
    expect(origen.notes).toContain('AF-0200');
  });

  it('en un traspaso parcial descuenta del origen y suma al ítem igual del destino', async () => {
    em.findOne
      .mockResolvedValueOnce(makeAsset()) // origen
      .mockResolvedValueOnce(makeAsset({ id: 'asset-9', quantity: 3, location: 'CUARTO' })); // destino

    await service.move('asset-1', { toLocation: 'CUARTO', quantity: 2 }, USER_ID, CLINIC_ID);

    const [origen, destino] = savedOf('Asset');
    expect(origen.quantity).toBe(4);
    expect(origen.location).toBe('SALA ECOGRAFIA');
    // 3 + 2: se fusiona en vez de dejar dos filas del mismo ítem en el ambiente.
    expect(destino.quantity).toBe(5);
  });

  it('crea el ítem en destino cuando allí no existía, con el siguiente código', async () => {
    em.findOne.mockResolvedValueOnce(makeAsset()).mockResolvedValueOnce(null); // en destino no hay nada igual

    await service.move('asset-1', { toLocation: 'BAÑO', quantity: 2 }, USER_ID, CLINIC_ID);

    const [, nuevo] = savedOf('Asset');
    expect(nuevo.assetTag).toBe('AF-0236');
    expect(nuevo.quantity).toBe(2);
    expect(nuevo.location).toBe('BAÑO');
    expect(nuevo.name).toBe('Sensores pectorales');
  });

  it('no deja mover más unidades de las que hay', async () => {
    em.findOne.mockResolvedValueOnce(makeAsset({ quantity: 2 }));

    await expect(service.move('asset-1', { toLocation: 'CUARTO', quantity: 5 }, USER_ID, CLINIC_ID)).rejects.toThrow(
      BadRequestException,
    );
    expect(savedOf('Asset')).toHaveLength(0);
  });

  it('no deja mover al mismo ambiente en el que ya está', async () => {
    em.findOne.mockResolvedValueOnce(makeAsset());

    await expect(service.move('asset-1', { toLocation: 'SALA ECOGRAFIA' }, USER_ID, CLINIC_ID)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('no deja mover lo que ya está dado de baja', async () => {
    em.findOne.mockResolvedValueOnce(makeAsset({ status: AssetStatus.LOST }));

    await expect(service.move('asset-1', { toLocation: 'CUARTO' }, USER_ID, CLINIC_ID)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('exige un ambiente de destino con contenido', async () => {
    await expect(service.move('asset-1', { toLocation: '   ' }, USER_ID, CLINIC_ID)).rejects.toThrow(
      BadRequestException,
    );
    expect(em.findOne).not.toHaveBeenCalled();
  });

  it('falla si el activo no es de la clínica que pide el movimiento', async () => {
    em.findOne.mockResolvedValueOnce(null);

    await expect(service.move('asset-1', { toLocation: 'CUARTO' }, USER_ID, CLINIC_ID)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('copia el nombre en el movimiento para que el historial no dependa de la ficha', async () => {
    em.findOne.mockResolvedValueOnce(makeAsset());

    await service.move('asset-1', { toLocation: 'CUARTO', notes: 'se llevó Ana' }, USER_ID, CLINIC_ID);

    expect(savedOf('AssetMovement')[0]).toMatchObject({
      assetName: 'Sensores pectorales',
      notes: 'se llevó Ana',
    });
  });

  describe('cruzando a la otra clínica', () => {
    it('el ítem completo cambia de clínica y se lleva su código', async () => {
      em.findOne.mockResolvedValueOnce(makeAsset());

      await service.move('asset-1', { toLocation: 'FARMACIA', toClinicId: OTRA_CLINICA }, USER_ID, CLINIC_ID);

      const [asset] = savedOf('Asset');
      expect(asset.clinic).toEqual({ id: OTRA_CLINICA });
      expect(asset.location).toBe('FARMACIA');
      expect(asset.assetTag).toBe('AF-0013');
      // Origen y destino quedan anotados: cada clínica ve su lado del traspaso.
      expect(savedOf('AssetMovement')[0]).toMatchObject({
        clinic: { id: CLINIC_ID },
        toClinic: { id: OTRA_CLINICA },
        quantity: 6,
      });
    });

    it('el traspaso parcial crea el ítem en la otra clínica, no en la propia', async () => {
      em.findOne.mockResolvedValueOnce(makeAsset()).mockResolvedValueOnce(null); // allá no hay nada igual

      await service.move(
        'asset-1',
        { toLocation: 'FARMACIA', toClinicId: OTRA_CLINICA, quantity: 2 },
        USER_ID,
        CLINIC_ID,
      );

      const [origen, nuevo] = savedOf('Asset');
      expect(origen.quantity).toBe(4);
      expect(origen.clinic).toBeUndefined(); // el de origen no se muda
      expect(nuevo.quantity).toBe(2);
      expect(nuevo.clinic).toEqual({ id: OTRA_CLINICA });
    });

    it('no deja mandar a una clínica de la que el usuario no es miembro', async () => {
      membresias.findOne.mockResolvedValue(null);

      await expect(
        service.move('asset-1', { toLocation: 'FARMACIA', toClinicId: OTRA_CLINICA }, USER_ID, CLINIC_ID),
      ).rejects.toThrow(ForbiddenException);
      // Ni siquiera se toca el ítem: se corta antes de abrir la transacción.
      expect(em.findOne).not.toHaveBeenCalled();
    });

    it('admite el mismo nombre de ambiente en la otra clínica', async () => {
      em.findOne.mockResolvedValueOnce(makeAsset());

      await service.move('asset-1', { toLocation: 'SALA ECOGRAFIA', toClinicId: OTRA_CLINICA }, USER_ID, CLINIC_ID);

      // La "SALA ECOGRAFIA" de la otra clínica es otro sitio, no el mismo.
      expect(savedOf('Asset')[0].clinic).toEqual({ id: OTRA_CLINICA });
    });

    it('sin clínica de destino el movimiento se queda en casa', async () => {
      em.findOne.mockResolvedValueOnce(makeAsset());

      await service.move('asset-1', { toLocation: 'CUARTO' }, USER_ID, CLINIC_ID);

      expect(membresias.findOne).not.toHaveBeenCalled();
      expect(savedOf('AssetMovement')[0].toClinic).toBeUndefined();
    });
  });
});
