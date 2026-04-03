import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { User } from 'src/users/entities/user.entity';
import { UserClinic } from 'src/users/entities/user-clinic.entity';
import { Clinic } from 'src/clinics/entities/clinic.entity';
import { ValidRoles } from 'src/users/interfaces';
import { createMockRepository, MockRepository } from 'src/test/helpers/mock-repository.factory';
import { makeClinic, makeUser } from 'src/test/helpers/test-data.factory';

jest.mock('bcrypt');
const bcryptCompare = bcrypt.compare as jest.Mock;
const bcryptHash = bcrypt.hash as jest.Mock;

describe('AuthService', () => {
  let service: AuthService;
  let userRepo: MockRepository<User>;
  let userClinicRepo: MockRepository<UserClinic>;
  let clinicRepo: MockRepository<Clinic>;

  const mockJwtService = {
    sign: jest.fn().mockReturnValue('mock-jwt-token'),
    verify: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: createMockRepository() },
        { provide: getRepositoryToken(UserClinic), useValue: createMockRepository() },
        { provide: getRepositoryToken(Clinic), useValue: createMockRepository() },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userRepo = module.get(getRepositoryToken(User));
    userClinicRepo = module.get(getRepositoryToken(UserClinic));
    clinicRepo = module.get(getRepositoryToken(Clinic));

    bcryptHash.mockResolvedValue('$2b$10$hashedvalue');
  });

  afterEach(() => jest.clearAllMocks());

  // ─── login ────────────────────────────────────────────────────────────────

  describe('login', () => {
    it('lanza UnauthorizedException si el usuario no existe', async () => {
      userRepo.findOne!.mockResolvedValue(null);

      await expect(
        service.login({ email: 'no@existe.com', password: '123' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('lanza UnauthorizedException si la contraseña no coincide', async () => {
      userRepo.findOne!.mockResolvedValue(makeUser({ password: 'hashed' }));
      bcryptCompare.mockResolvedValue(false);

      await expect(
        service.login({ email: 'doctor@test.com', password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('retorna token y usuario si las credenciales son válidas', async () => {
      const user = makeUser({ isActive: true });
      userRepo.findOne!
        .mockResolvedValueOnce(user)   // primera llamada: buscar con select password
        .mockResolvedValueOnce(user);  // segunda llamada: cargar con relaciones

      bcryptCompare.mockResolvedValue(true);
      bcryptHash.mockResolvedValue('hash-refresh');
      userRepo.update!.mockResolvedValue({ affected: 1 });
      userClinicRepo.find!.mockResolvedValue([]);

      const result = await service.login({ email: user.email, password: 'correct' });

      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('refreshToken');
    });
  });

  // ─── getMyMemberships ─────────────────────────────────────────────────────

  describe('getMyMemberships', () => {
    it('SUPER_ADMIN ve TODAS las clínicas activas', async () => {
      const clinics = [makeClinic({ id: 'c1' }), makeClinic({ id: 'c2' }), makeClinic({ id: 'c3' })];
      clinicRepo.find!.mockResolvedValue(clinics);

      const result = await service.getMyMemberships('user-1', [ValidRoles.SUPER_ADMIN]);

      expect(result).toHaveLength(3);
      expect(clinicRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isActive: true } }),
      );
      // No debe consultar membresías
      expect(userClinicRepo.find).not.toHaveBeenCalled();
    });

    it('usuario normal solo ve sus clínicas de membresía', async () => {
      const clinic = makeClinic();
      userClinicRepo.find!.mockResolvedValue([
        { clinic: { ...clinic, isActive: true } },
      ]);

      const result = await service.getMyMemberships('user-1', [ValidRoles.DOCTOR]);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(clinic.id);
      expect(clinicRepo.find).not.toHaveBeenCalled();
    });

    it('filtra clínicas inactivas de membresías', async () => {
      userClinicRepo.find!.mockResolvedValue([
        { clinic: { id: 'c1', name: 'Activa', isActive: true } },
        { clinic: { id: 'c2', name: 'Inactiva', isActive: false } },
      ]);

      const result = await service.getMyMemberships('user-1', [ValidRoles.ADMIN]);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('c1');
    });
  });

  // ─── logout ───────────────────────────────────────────────────────────────

  describe('logout', () => {
    it('limpia el refreshTokenHash del usuario', async () => {
      userRepo.update!.mockResolvedValue({ affected: 1 });

      await service.logout('user-1');

      expect(userRepo.update).toHaveBeenCalledWith(
        { id: 'user-1' },
        { refreshTokenHash: null },
      );
    });
  });

  // ─── requestPasswordReset ─────────────────────────────────────────────────

  describe('requestPasswordReset', () => {
    it('retorna mensaje genérico aunque el email no exista (seguridad)', async () => {
      userRepo.findOne!.mockResolvedValue(null);

      const result = await service.requestPasswordReset({ email: 'fantasma@test.com' });

      expect(result.message).toBeDefined();
      expect(typeof result.message).toBe('string');
      // No debe lanzar excepción — revelaría si el email existe
    });

    it('retorna mensaje genérico para usuario inactivo', async () => {
      userRepo.findOne!.mockResolvedValue(makeUser({ isActive: false }));

      const result = await service.requestPasswordReset({ email: 'inactivo@test.com' });

      expect(result.message).toBeDefined();
    });

    it('genera token y lo persiste para usuario activo', async () => {
      userRepo.findOne!.mockResolvedValue(makeUser({ isActive: true }));
      userRepo.update!.mockResolvedValue({ affected: 1 });

      await service.requestPasswordReset({ email: 'doctor@test.com' });

      expect(userRepo.update).toHaveBeenCalledWith(
        { id: 'user-1' },
        expect.objectContaining({
          passwordResetToken: expect.any(String),
          passwordResetExpiresAt: expect.any(Date),
        }),
      );
    });
  });
});
