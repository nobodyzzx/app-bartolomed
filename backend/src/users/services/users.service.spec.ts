import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { User } from '../entities/user.entity';
import { UserClinic } from '../entities/user-clinic.entity';
import { Clinic } from 'src/clinics/entities/clinic.entity';
import { createMockRepository, createMockQueryBuilder, MockRepository } from 'src/test/helpers/mock-repository.factory';
import { makeUser, makeClinic } from 'src/test/helpers/test-data.factory';

jest.mock('bcrypt', () => ({
  hashSync: jest.fn().mockReturnValue('$hashed$'),
  compareSync: jest.fn().mockReturnValue(true),
}));

const ACTIVE_CLINIC = 'clinic-1';
const OTHER_CLINIC = 'clinic-2';

const makeAdmin = (overrides: Record<string, any> = {}) =>
  makeUser({ id: 'admin-1', roles: ['admin'], ...overrides }) as unknown as User;

const makeSuperAdmin = (overrides: Record<string, any> = {}) =>
  makeUser({ id: 'super-1', roles: ['super-admin', 'admin'], ...overrides }) as unknown as User;

describe('UsersService', () => {
  let service: UsersService;
  let userRepo: MockRepository<User>;
  let clinicRepo: MockRepository<Clinic>;
  let userClinicRepo: MockRepository<UserClinic>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: createMockRepository() },
        { provide: getRepositoryToken(Clinic), useValue: createMockRepository() },
        { provide: getRepositoryToken(UserClinic), useValue: createMockRepository() },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    userRepo = module.get(getRepositoryToken(User));
    clinicRepo = module.get(getRepositoryToken(Clinic));
    userClinicRepo = module.get(getRepositoryToken(UserClinic));
  });

  afterEach(() => jest.clearAllMocks());

  // ─── create ───────────────────────────────────────────────────────────────

  describe('create', () => {
    const baseDto = () => ({
      email: 'nuevo@test.com',
      password: 'Abc123!',
      fullName: 'Nuevo Usuario',
      roles: ['doctor'],
    });

    it('hashea la contraseña antes de guardar', async () => {
      const user = makeUser();
      const clinic = makeClinic({ id: ACTIVE_CLINIC });
      userRepo.create!.mockReturnValue(user);
      userRepo.save!.mockResolvedValue(user);
      clinicRepo.findOne!.mockResolvedValue(clinic);

      await service.create(baseDto() as any, makeAdmin(), ACTIVE_CLINIC);

      expect(userRepo.create).toHaveBeenCalledWith(expect.objectContaining({ password: '$hashed$' }));
    });

    it('lanza BadRequestException si la clínica no existe', async () => {
      clinicRepo.findOne!.mockResolvedValue(null);

      await expect(
        service.create({ ...baseDto(), clinicId: OTHER_CLINIC } as any, makeSuperAdmin(), ACTIVE_CLINIC),
      ).rejects.toThrow(BadRequestException);
    });

    it('crea membresía en user_clinics con la clínica activa', async () => {
      const user = makeUser();
      const clinic = makeClinic({ id: ACTIVE_CLINIC });
      userRepo.create!.mockReturnValue(user);
      userRepo.save!.mockResolvedValue(user);
      clinicRepo.findOne!.mockResolvedValue(clinic);
      userClinicRepo.create!.mockReturnValue({ id: 'uc-1' });
      userClinicRepo.save!.mockResolvedValue({ id: 'uc-1' });

      await service.create(baseDto() as any, makeAdmin(), ACTIVE_CLINIC);

      expect(userClinicRepo.save).toHaveBeenCalled();
    });

    it('lanza BadRequestException si el email ya está registrado (error 23505)', async () => {
      const clinic = makeClinic({ id: ACTIVE_CLINIC });
      clinicRepo.findOne!.mockResolvedValue(clinic);
      userRepo.create!.mockReturnValue(makeUser());
      userRepo.save!.mockRejectedValue({ code: '23505' });

      await expect(service.create(baseDto() as any, makeAdmin(), ACTIVE_CLINIC)).rejects.toThrow(
        BadRequestException,
      );
    });

    // Bug real: un ADMIN podía crear un usuario con roles: ['super-admin'].
    it('lanza ForbiddenException si un ADMIN intenta crear un usuario con rol super-admin', async () => {
      await expect(
        service.create({ ...baseDto(), roles: ['super-admin'] } as any, makeAdmin(), ACTIVE_CLINIC),
      ).rejects.toThrow(ForbiddenException);
    });

    it('permite a un SUPER_ADMIN crear un usuario con rol super-admin', async () => {
      const user = makeUser({ roles: ['super-admin'] });
      const clinic = makeClinic({ id: ACTIVE_CLINIC });
      userRepo.create!.mockReturnValue(user);
      userRepo.save!.mockResolvedValue(user);
      clinicRepo.findOne!.mockResolvedValue(clinic);

      await expect(
        service.create({ ...baseDto(), roles: ['super-admin'] } as any, makeSuperAdmin(), ACTIVE_CLINIC),
      ).resolves.toBeDefined();
    });

    // Bug real: un ADMIN podía crear usuarios en cualquier clínica pasando un clinicId arbitrario.
    it('lanza ForbiddenException si un ADMIN intenta crear un usuario en otra clínica', async () => {
      await expect(
        service.create({ ...baseDto(), clinicId: OTHER_CLINIC } as any, makeAdmin(), ACTIVE_CLINIC),
      ).rejects.toThrow(ForbiddenException);
    });

    it('permite a un SUPER_ADMIN crear un usuario en cualquier clínica', async () => {
      const user = makeUser();
      const clinic = makeClinic({ id: OTHER_CLINIC });
      userRepo.create!.mockReturnValue(user);
      userRepo.save!.mockResolvedValue(user);
      clinicRepo.findOne!.mockResolvedValue(clinic);

      await expect(
        service.create({ ...baseDto(), clinicId: OTHER_CLINIC } as any, makeSuperAdmin(), ACTIVE_CLINIC),
      ).resolves.toBeDefined();
    });
  });

  // ─── findAll ──────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('un ADMIN solo ve usuarios de su clínica activa', async () => {
      userRepo.findAndCount!.mockResolvedValue([[], 0]);

      await service.findAll({} as any, makeAdmin(), ACTIVE_CLINIC);

      expect(userRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: { clinic: { id: ACTIVE_CLINIC } } }),
      );
    });

    it('un SUPER_ADMIN ve usuarios de todas las clínicas (sin filtro)', async () => {
      userRepo.findAndCount!.mockResolvedValue([[], 0]);

      await service.findAll({} as any, makeSuperAdmin(), ACTIVE_CLINIC);

      expect(userRepo.findAndCount).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
    });
  });

  // ─── findOne ──────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('retorna usuario existente de la misma clínica', async () => {
      userRepo.findOne!.mockResolvedValue(makeUser({ clinic: { id: ACTIVE_CLINIC } }));
      const result = await service.findOne('user-1', makeAdmin(), ACTIVE_CLINIC);
      expect(result.id).toBe('user-1');
    });

    it('lanza NotFoundException si no existe', async () => {
      userRepo.findOne!.mockResolvedValue(null);
      await expect(service.findOne('no-existe', makeAdmin(), ACTIVE_CLINIC)).rejects.toThrow(NotFoundException);
    });

    // Bug real: un ADMIN podía ver usuarios de otras clínicas.
    it('lanza NotFoundException si un ADMIN intenta ver un usuario de otra clínica', async () => {
      userRepo.findOne!.mockResolvedValue(makeUser({ clinic: { id: OTHER_CLINIC } }));
      await expect(service.findOne('user-1', makeAdmin(), ACTIVE_CLINIC)).rejects.toThrow(NotFoundException);
    });

    it('un SUPER_ADMIN puede ver un usuario de cualquier clínica', async () => {
      userRepo.findOne!.mockResolvedValue(makeUser({ clinic: { id: OTHER_CLINIC } }));
      const result = await service.findOne('user-1', makeSuperAdmin(), ACTIVE_CLINIC);
      expect(result.id).toBe('user-1');
    });
  });

  // ─── update ───────────────────────────────────────────────────────────────

  describe('update', () => {
    it('lanza ForbiddenException si un ADMIN intenta ascender a un usuario a super-admin', async () => {
      userRepo.findOne!.mockResolvedValue(makeUser({ clinic: { id: ACTIVE_CLINIC } }));
      await expect(
        service.update('user-1', { roles: ['super-admin'] } as any, makeAdmin(), ACTIVE_CLINIC),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lanza ForbiddenException si un ADMIN intenta modificar a un SUPER_ADMIN existente', async () => {
      userRepo.findOne!.mockResolvedValue(makeUser({ clinic: { id: ACTIVE_CLINIC }, roles: ['super-admin'] }));
      await expect(
        service.update('user-1', { email: 'x@x.com' } as any, makeAdmin(), ACTIVE_CLINIC),
      ).rejects.toThrow(ForbiddenException);
    });

    it('permite a un SUPER_ADMIN modificar a otro SUPER_ADMIN', async () => {
      const user = makeUser({ clinic: { id: ACTIVE_CLINIC }, roles: ['super-admin'] });
      userRepo.findOne!.mockResolvedValue(user);
      userRepo.save!.mockResolvedValue(user);

      await expect(
        service.update('user-1', { email: 'x@x.com' } as any, makeSuperAdmin(), ACTIVE_CLINIC),
      ).resolves.toBeDefined();
    });
  });

  // ─── getClinicStatistics ──────────────────────────────────────────────────

  describe('getClinicStatistics', () => {
    /** Cada llamada a countByRole crea su propio QueryBuilder — uno por rol, en orden. Devuelve los qb creados. */
    const mockCountsInOrder = (...counts: number[]) => {
      const qbs = counts.map(count => createMockQueryBuilder({ getCount: jest.fn().mockResolvedValue(count) }));
      qbs.forEach(qb => userClinicRepo.createQueryBuilder!.mockImplementationOnce(() => qb));
      return qbs;
    };

    it('cuenta personal activo por rol de la clínica', async () => {
      mockCountsInOrder(3, 2, 1, 4); // doctors, nurses, receptionists, pharmacists

      const result = await service.getClinicStatistics('clinic-1');

      expect(result).toEqual({
        totalDoctors: 3,
        totalNurses: 2,
        totalReceptionists: 1,
        totalPharmacists: 4,
      });
    });

    it('filtra por clínica, activos y rol en cada conteo', async () => {
      const [doctorsQb, nursesQb] = mockCountsInOrder(1, 0, 0, 0);

      await service.getClinicStatistics('clinic-1');

      expect(doctorsQb.where).toHaveBeenCalledWith('uc.clinic_id = :clinicId', { clinicId: 'clinic-1' });
      expect(doctorsQb.andWhere).toHaveBeenCalledWith('user.isActive = true');
      expect(doctorsQb.andWhere).toHaveBeenCalledWith(':role = ANY(uc.roles)', { role: 'doctor' });
      expect(nursesQb.andWhere).toHaveBeenCalledWith(':role = ANY(uc.roles)', { role: 'nurse' });
    });

    it('retorna 0 en todos los roles si la clínica no tiene personal', async () => {
      mockCountsInOrder(0, 0, 0, 0);

      const result = await service.getClinicStatistics('clinic-sin-personal');

      expect(result).toEqual({
        totalDoctors: 0,
        totalNurses: 0,
        totalReceptionists: 0,
        totalPharmacists: 0,
      });
    });
  });

  // ─── updateStatus ─────────────────────────────────────────────────────────

  describe('updateStatus', () => {
    it('desactiva usuario (isActive = false)', async () => {
      const user = makeUser({ isActive: true, clinic: { id: ACTIVE_CLINIC } });
      userRepo.findOne!.mockResolvedValue(user);
      userRepo.save!.mockImplementation(async u => u);

      await service.updateStatus('user-1', false, makeAdmin(), ACTIVE_CLINIC);

      expect(userRepo.save).toHaveBeenCalledWith(expect.objectContaining({ isActive: false }));
    });

    it('lanza ForbiddenException si un ADMIN intenta desactivar a un SUPER_ADMIN', async () => {
      const user = makeUser({ isActive: true, clinic: { id: ACTIVE_CLINIC }, roles: ['super-admin'] });
      userRepo.findOne!.mockResolvedValue(user);

      await expect(service.updateStatus('user-1', false, makeAdmin(), ACTIVE_CLINIC)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ─── remove ───────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('elimina el usuario', async () => {
      const user = makeUser({ clinic: { id: ACTIVE_CLINIC } });
      userRepo.findOne!.mockResolvedValue(user);
      userRepo.remove!.mockResolvedValue(user);

      const result = await service.remove('user-1', makeAdmin(), ACTIVE_CLINIC);

      expect(userRepo.remove).toHaveBeenCalledWith(user);
      expect(result).toEqual({ message: 'Usuario eliminado correctamente' });
    });

    it('lanza ForbiddenException si un ADMIN intenta eliminar a un SUPER_ADMIN', async () => {
      const user = makeUser({ clinic: { id: ACTIVE_CLINIC }, roles: ['super-admin'] });
      userRepo.findOne!.mockResolvedValue(user);

      await expect(service.remove('user-1', makeAdmin(), ACTIVE_CLINIC)).rejects.toThrow(ForbiddenException);
    });

    // Bug real: hard-delete sin manejo de errores tiraba un 500 crudo por violación de FK.
    it('lanza BadRequestException con mensaje claro si el usuario tiene registros asociados (FK)', async () => {
      const user = makeUser({ clinic: { id: ACTIVE_CLINIC } });
      userRepo.findOne!.mockResolvedValue(user);
      userRepo.remove!.mockRejectedValue({ code: '23503' });

      await expect(service.remove('user-1', makeAdmin(), ACTIVE_CLINIC)).rejects.toThrow(BadRequestException);
    });
  });
});
