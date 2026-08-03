import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ClinicsService } from './clinics.service';
import { Clinic } from '../entities/clinic.entity';
import { User } from 'src/users/entities/user.entity';
import { UserClinic } from 'src/users/entities/user-clinic.entity';
import { createMockRepository, MockRepository } from 'src/test/helpers/mock-repository.factory';
import { makeClinic, makeUser } from 'src/test/helpers/test-data.factory';

const makeEm = (overrides: Record<string, jest.Mock> = {}) => {
  const em: Record<string, jest.Mock> = {
    create: jest.fn().mockImplementation((_cls: any, data: any) => ({ ...data })),
    save: jest.fn().mockImplementation((_cls: any, data: any) => Promise.resolve(data)),
    ...overrides,
  };
  em.createQueryBuilder = jest.fn().mockReturnValue({
    where: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue([]),
  });
  return em;
};

const makeMockDataSource = (em: ReturnType<typeof makeEm>) => ({
  transaction: jest.fn().mockImplementation(async (fn: (em: any) => Promise<any>) => fn(em)),
});

describe('ClinicsService', () => {
  let service: ClinicsService;
  let clinicRepo: MockRepository<Clinic>;
  let userRepo: MockRepository<User>;
  let userClinicRepo: MockRepository<UserClinic>;
  let em: ReturnType<typeof makeEm>;
  let mockDataSource: ReturnType<typeof makeMockDataSource>;

  beforeEach(async () => {
    em = makeEm();
    mockDataSource = makeMockDataSource(em);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClinicsService,
        { provide: getRepositoryToken(Clinic), useValue: createMockRepository() },
        { provide: getRepositoryToken(User), useValue: createMockRepository() },
        { provide: getRepositoryToken(UserClinic), useValue: createMockRepository() },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<ClinicsService>(ClinicsService);
    clinicRepo = module.get(getRepositoryToken(Clinic));
    userRepo = module.get(getRepositoryToken(User));
    userClinicRepo = module.get(getRepositoryToken(UserClinic));
  });

  afterEach(() => jest.clearAllMocks());

  // ─── create ───────────────────────────────────────────────────────────────
  // Bug real: sin transacción, si linkSuperAdminsToClinic() fallaba después de
  // guardar la clínica, esta quedaba persistida sin rollback (huérfana).

  describe('create', () => {
    it('crea la clínica y vincula a los SUPER_ADMIN existentes dentro de una transacción', async () => {
      const superAdmin = makeUser({ id: 'sa-1' });
      em.createQueryBuilder = jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([superAdmin]),
      });

      const result = await service.create({ name: 'Nueva Clínica' } as any, makeUser() as any);

      expect(mockDataSource.transaction).toHaveBeenCalled();
      expect(result).toMatchObject({ name: 'Nueva Clínica' });
      expect(em.save).toHaveBeenCalledWith(
        UserClinic,
        expect.arrayContaining([expect.objectContaining({ user: superAdmin, roles: ['admin', 'super-admin'] })]),
      );
    });

    it('no vincula membresías si no hay SUPER_ADMIN existentes', async () => {
      await service.create({ name: 'Nueva Clínica' } as any, makeUser() as any);

      expect(em.save).toHaveBeenCalledTimes(1); // solo el save de la clínica
    });

    it('propaga el error si algo falla dentro de la transacción (rollback)', async () => {
      mockDataSource.transaction.mockImplementation(async () => {
        throw { code: '23505', detail: 'Key (name)=(x) already exists' };
      });

      await expect(service.create({ name: 'Dup' } as any, makeUser() as any)).rejects.toThrow(BadRequestException);
    });
  });

  // ─── update ───────────────────────────────────────────────────────────────
  // Bug real: usaba findOne() (filtra isActive:true) — PATCH sobre una
  // clínica desactivada daba 404, sin forma de corregir sus datos antes de
  // reactivarla.

  describe('update', () => {
    it('permite editar una clínica desactivada (no filtra por isActive)', async () => {
      const clinic = makeClinic({ isActive: false });
      clinicRepo.findOne!.mockResolvedValue(clinic);
      clinicRepo.save!.mockImplementation(async c => c);

      const result = await service.update('clinic-1', { name: 'Nombre corregido' } as any);

      expect(clinicRepo.findOne).toHaveBeenCalledWith({ where: { id: 'clinic-1' } });
      expect(result.name).toBe('Nombre corregido');
    });

    it('lanza NotFoundException si la clínica no existe', async () => {
      clinicRepo.findOne!.mockResolvedValue(null);
      await expect(service.update('no-existe', {} as any)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── findOne ──────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('retorna clínica activa', async () => {
      clinicRepo.findOne!.mockResolvedValue(makeClinic());
      const result = await service.findOne('clinic-1');
      expect(result.id).toBe('clinic-1');
    });

    it('lanza NotFoundException si no existe', async () => {
      clinicRepo.findOne!.mockResolvedValue(null);
      await expect(service.findOne('no-existe')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── activate / deactivate ────────────────────────────────────────────────

  describe('deactivate', () => {
    it('establece isActive = false', async () => {
      const clinic = makeClinic({ isActive: true });
      clinicRepo.findOne!.mockResolvedValue(clinic);
      clinicRepo.save!.mockImplementation(async c => c);

      await service.deactivate('clinic-1');

      expect(clinicRepo.save).toHaveBeenCalledWith(expect.objectContaining({ isActive: false }));
    });
  });

  describe('activate', () => {
    it('establece isActive = true', async () => {
      const clinic = makeClinic({ isActive: false });
      clinicRepo.findOne!.mockResolvedValue(clinic);
      clinicRepo.save!.mockImplementation(async c => c);

      await service.activate('clinic-1');

      expect(clinicRepo.save).toHaveBeenCalledWith(expect.objectContaining({ isActive: true }));
    });
  });

  // ─── addMemberWithRoles ───────────────────────────────────────────────────

  describe('addMemberWithRoles', () => {
    it('lanza NotFoundException si el usuario no existe', async () => {
      clinicRepo.findOne!.mockResolvedValue(makeClinic());
      userRepo.findOne!.mockResolvedValue(null);

      await expect(
        service.addMemberWithRoles('clinic-1', { userId: 'no-existe', roles: ['doctor'] } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('lanza BadRequestException si el usuario ya es miembro', async () => {
      clinicRepo.findOne!.mockResolvedValue(makeClinic());
      userRepo.findOne!.mockResolvedValue(makeUser());
      userClinicRepo.findOne!.mockResolvedValue({ id: 'uc-1' }); // ya existe

      await expect(
        service.addMemberWithRoles('clinic-1', { userId: 'user-1', roles: ['doctor'] } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('crea membresía si el usuario no es miembro aún', async () => {
      clinicRepo.findOne!.mockResolvedValue(makeClinic());
      userRepo.findOne!.mockResolvedValue(makeUser());
      userClinicRepo.findOne!.mockResolvedValue(null); // no es miembro
      userClinicRepo.create!.mockReturnValue({ id: 'uc-new' });
      userClinicRepo.save!.mockResolvedValue({ id: 'uc-new' });

      await service.addMemberWithRoles('clinic-1', { userId: 'user-1', roles: ['doctor'] } as any);

      expect(userClinicRepo.save).toHaveBeenCalled();
    });
  });
});
