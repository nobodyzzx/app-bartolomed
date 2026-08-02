import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
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
      userRepo.create!.mockReturnValue(user);
      userRepo.save!.mockResolvedValue(user);

      await service.create(baseDto() as any);

      expect(userRepo.create).toHaveBeenCalledWith(expect.objectContaining({ password: '$hashed$' }));
    });

    it('lanza BadRequestException si la clínica no existe', async () => {
      clinicRepo.findOne!.mockResolvedValue(null);

      await expect(service.create({ ...baseDto(), clinicId: 'clinic-no-existe' } as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('crea membresía en user_clinics si se provee clinicId', async () => {
      const user = makeUser();
      const clinic = makeClinic();
      userRepo.create!.mockReturnValue(user);
      userRepo.save!.mockResolvedValue(user);
      clinicRepo.findOne!.mockResolvedValue(clinic);
      userClinicRepo.create!.mockReturnValue({ id: 'uc-1' });
      userClinicRepo.save!.mockResolvedValue({ id: 'uc-1' });

      await service.create({ ...baseDto(), clinicId: 'clinic-1' } as any);

      expect(userClinicRepo.save).toHaveBeenCalled();
    });

    it('lanza BadRequestException si el email ya está registrado (error 23505)', async () => {
      userRepo.create!.mockReturnValue(makeUser());
      userRepo.save!.mockRejectedValue({ code: '23505' });

      await expect(service.create(baseDto() as any)).rejects.toThrow(BadRequestException);
    });
  });

  // ─── findOne ──────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('retorna usuario existente', async () => {
      userRepo.findOne!.mockResolvedValue(makeUser());
      const result = await service.findOne('user-1');
      expect(result.id).toBe('user-1');
    });

    it('lanza NotFoundException si no existe', async () => {
      userRepo.findOne!.mockResolvedValue(null);
      await expect(service.findOne('no-existe')).rejects.toThrow(NotFoundException);
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
      const user = makeUser({ isActive: true });
      userRepo.findOne!.mockResolvedValue(user);
      userRepo.save!.mockImplementation(async u => u);

      await service.updateStatus('user-1', false);

      expect(userRepo.save).toHaveBeenCalledWith(expect.objectContaining({ isActive: false }));
    });
  });
});
