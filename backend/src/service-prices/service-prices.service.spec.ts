import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuditService } from '../audit/audit.service';
import { AppointmentType } from '../appointments/entities/appointment.entity';
import { User } from '../users/entities/user.entity';
import { ServiceCategory, ServicePrice } from './entities/service-price.entity';
import { ServicePricesService } from './service-prices.service';

const CLINIC_ID = 'clinic-1';
const OTHER_CLINIC_ID = 'clinic-2';

const makePrice = (overrides: Partial<ServicePrice> = {}): ServicePrice =>
  Object.assign(new ServicePrice(), {
    id: 'price-1',
    code: 'CONS-GEN',
    name: 'Consulta general',
    category: ServiceCategory.CONSULTATION,
    appointmentType: AppointmentType.CONSULTATION,
    price: 80,
    isActive: true,
    clinicId: CLINIC_ID,
    ...overrides,
  });

const actor = { id: 'user-1', email: 'admin@bartolomed.local' } as User;

describe('ServicePricesService', () => {
  let service: ServicePricesService;
  let repo: {
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
    softRemove: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let audit: { log: jest.Mock };
  let qb: Record<string, jest.Mock>;

  beforeEach(async () => {
    qb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[makePrice()], 1]),
    };
    repo = {
      create: jest.fn(dto => dto),
      save: jest.fn(entity => Promise.resolve(entity)),
      findOne: jest.fn().mockResolvedValue(null),
      softRemove: jest.fn().mockResolvedValue(undefined),
      createQueryBuilder: jest.fn().mockReturnValue(qb),
    };
    audit = { log: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServicePricesService,
        { provide: getRepositoryToken(ServicePrice), useValue: repo },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = module.get(ServicePricesService);
  });

  // ─── scoping por clínica ──────────────────────────────────────────────────

  describe('scoping por clínica', () => {
    it.each([
      ['create', () => service.create({ code: 'X' } as any, actor, undefined)],
      ['findAll', () => service.findAll({}, undefined)],
      ['findOne', () => service.findOne('price-1', undefined)],
      ['update', () => service.update('price-1', {}, actor, undefined)],
      ['remove', () => service.remove('price-1', undefined)],
    ])('%s exige clinicId', async (_name, call) => {
      await expect(call()).rejects.toThrow(BadRequestException);
    });

    it('findAll filtra siempre por la clínica del request', async () => {
      await service.findAll({}, CLINIC_ID);

      expect(qb.where).toHaveBeenCalledWith('sp.clinic_id = :clinicId', { clinicId: CLINIC_ID });
    });

    it('findOne no devuelve un precio de otra clínica', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.findOne('price-1', OTHER_CLINIC_ID)).rejects.toThrow(NotFoundException);
      expect(repo.findOne).toHaveBeenCalledWith({
        where: { id: 'price-1', clinicId: OTHER_CLINIC_ID },
      });
    });
  });

  // ─── código único ─────────────────────────────────────────────────────────

  describe('unicidad del código', () => {
    it('rechaza un código ya usado en la clínica', async () => {
      repo.findOne.mockResolvedValue(makePrice());

      await expect(
        service.create({ code: 'CONS-GEN', category: ServiceCategory.OTHER } as any, actor, CLINIC_ID),
      ).rejects.toThrow(ConflictException);
    });

    it('considera también los dados de baja, porque el índice único los incluye', async () => {
      repo.findOne.mockResolvedValue(makePrice({ deletedAt: new Date() }));

      await expect(
        service.create({ code: 'CONS-GEN', category: ServiceCategory.OTHER } as any, actor, CLINIC_ID),
      ).rejects.toThrow(ConflictException);
      expect(repo.findOne).toHaveBeenCalledWith(expect.objectContaining({ withDeleted: true }));
    });

    it('al editar no choca consigo mismo', async () => {
      repo.findOne.mockResolvedValueOnce(makePrice()); // findOne del update
      repo.findOne.mockResolvedValueOnce(null); // chequeo de duplicado

      await expect(service.update('price-1', { code: 'CONS-NEW' }, actor, CLINIC_ID)).resolves.toBeDefined();
    });
  });

  // ─── appointmentType ──────────────────────────────────────────────────────

  describe('normalización de appointmentType', () => {
    it('lo conserva en una consulta', async () => {
      const saved = await service.create(
        {
          code: 'CONS-SEG',
          name: 'Seguimiento',
          category: ServiceCategory.CONSULTATION,
          appointmentType: AppointmentType.FOLLOW_UP,
          price: 50,
        },
        actor,
        CLINIC_ID,
      );

      expect(saved.appointmentType).toBe(AppointmentType.FOLLOW_UP);
    });

    it('lo anula fuera de una consulta: en un examen no significaría nada', async () => {
      const saved = await service.create(
        {
          code: 'LAB-HEM',
          name: 'Hemograma',
          category: ServiceCategory.LABORATORY,
          appointmentType: AppointmentType.CONSULTATION,
          price: 45,
        },
        actor,
        CLINIC_ID,
      );

      expect(saved.appointmentType).toBeNull();
    });

    it('lo anula al cambiar la categoría de consulta a otra', async () => {
      repo.findOne.mockResolvedValueOnce(makePrice());

      const saved = await service.update('price-1', { category: ServiceCategory.PROCEDURE }, actor, CLINIC_ID);

      expect(saved.appointmentType).toBeNull();
    });
  });

  // ─── auditoría del precio ─────────────────────────────────────────────────

  describe('auditoría del cambio de precio', () => {
    it('registra el valor anterior y el nuevo', async () => {
      repo.findOne.mockResolvedValueOnce(makePrice({ price: 80 }));

      await service.update('price-1', { price: 95 }, actor, CLINIC_ID);

      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PRICE_CHANGED',
          details: expect.objectContaining({ priceFrom: 80, priceTo: 95 }),
        }),
      );
    });

    it('no registra nada si el precio no cambió (el interceptor ya cubre el PATCH)', async () => {
      repo.findOne.mockResolvedValueOnce(makePrice({ price: 80 }));

      await service.update('price-1', { name: 'Otro nombre' }, actor, CLINIC_ID);

      expect(audit.log).not.toHaveBeenCalled();
    });
  });

  // ─── resolución de tarifa ─────────────────────────────────────────────────

  describe('findConsultationPrice', () => {
    it('busca solo tarifas activas de consulta del tipo pedido', async () => {
      repo.findOne.mockResolvedValue(makePrice());

      await service.findConsultationPrice(AppointmentType.EMERGENCY, CLINIC_ID);

      expect(repo.findOne).toHaveBeenCalledWith({
        where: {
          clinicId: CLINIC_ID,
          category: ServiceCategory.CONSULTATION,
          appointmentType: AppointmentType.EMERGENCY,
          isActive: true,
        },
      });
    });

    it('devuelve null en vez de lanzar, para no bloquear el cierre de una cita sin tarifa', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.findConsultationPrice(AppointmentType.SURGERY, CLINIC_ID)).resolves.toBeNull();
    });
  });

  // ─── baja lógica ──────────────────────────────────────────────────────────

  it('da de baja sin borrar físicamente: el histórico del tarifario debe seguir consultable', async () => {
    const existing = makePrice();
    repo.findOne.mockResolvedValue(existing);

    await service.remove('price-1', CLINIC_ID);

    expect(repo.softRemove).toHaveBeenCalledWith(existing);
  });

  // ─── filtros ──────────────────────────────────────────────────────────────

  describe('filtros', () => {
    it('interpreta isActive=false como booleano, no como string truthy', async () => {
      await service.findAll({ isActive: 'false' }, CLINIC_ID);

      expect(qb.andWhere).toHaveBeenCalledWith('sp.is_active = :isActive', { isActive: false });
    });

    it('busca por código o nombre', async () => {
      await service.findAll({ search: 'hemo' }, CLINIC_ID);

      expect(qb.andWhere).toHaveBeenCalledWith('(sp.code ILIKE :search OR sp.name ILIKE :search)', {
        search: '%hemo%',
      });
    });
  });
});
