import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ClinicsService } from './clinics.service';
import { Clinic } from '../entities/clinic.entity';
import { User } from 'src/users/entities/user.entity';
import { UserClinic } from 'src/users/entities/user-clinic.entity';
import { createMockRepository, MockRepository } from 'src/test/helpers/mock-repository.factory';
import { makeClinic, makeUser } from 'src/test/helpers/test-data.factory';

describe('ClinicsService', () => {
  let service: ClinicsService;
  let clinicRepo: MockRepository<Clinic>;
  let userRepo: MockRepository<User>;
  let userClinicRepo: MockRepository<UserClinic>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClinicsService,
        { provide: getRepositoryToken(Clinic), useValue: createMockRepository() },
        { provide: getRepositoryToken(User), useValue: createMockRepository() },
        { provide: getRepositoryToken(UserClinic), useValue: createMockRepository() },
      ],
    }).compile();

    service = module.get<ClinicsService>(ClinicsService);
    clinicRepo = module.get(getRepositoryToken(Clinic));
    userRepo = module.get(getRepositoryToken(User));
    userClinicRepo = module.get(getRepositoryToken(UserClinic));
  });

  afterEach(() => jest.clearAllMocks());

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
      clinicRepo.save!.mockImplementation(async (c) => c);

      await service.deactivate('clinic-1');

      expect(clinicRepo.save).toHaveBeenCalledWith(expect.objectContaining({ isActive: false }));
    });
  });

  describe('activate', () => {
    it('establece isActive = true', async () => {
      const clinic = makeClinic({ isActive: false });
      clinicRepo.findOne!.mockResolvedValue(clinic);
      clinicRepo.save!.mockImplementation(async (c) => c);

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
