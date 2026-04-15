import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { RolesService } from './roles.service';
import { Role } from '../entities/role.entity';
import { createMockRepository, MockRepository } from 'src/test/helpers/mock-repository.factory';

const makeRole = (overrides: Record<string, any> = {}): Role => ({
  id: 'role-1',
  name: 'doctor',
  description: 'Médico tratante',
  permissions: [],
  isActive: true,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  ...overrides,
});

describe('RolesService', () => {
  let service: RolesService;
  let roleRepo: MockRepository<Role>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesService,
        { provide: getRepositoryToken(Role), useValue: createMockRepository() },
      ],
    }).compile();

    service = module.get<RolesService>(RolesService);
    roleRepo = module.get(getRepositoryToken(Role));
  });

  afterEach(() => jest.clearAllMocks());

  // ─── findOne ──────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('retorna rol si existe', async () => {
      roleRepo.findOne!.mockResolvedValue(makeRole());
      const result = await service.findOne('role-1');
      expect(result.id).toBe('role-1');
    });

    it('lanza NotFoundException si no existe', async () => {
      roleRepo.findOne!.mockResolvedValue(null);
      await expect(service.findOne('no-existe')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── create ───────────────────────────────────────────────────────────────

  describe('create', () => {
    it('crea rol correctamente', async () => {
      const role = makeRole();
      roleRepo.create!.mockReturnValue(role);
      roleRepo.save!.mockResolvedValue(role);

      const result = await service.create({ name: 'doctor', permissions: [] });
      expect(result).toBeDefined();
      expect(roleRepo.save).toHaveBeenCalled();
    });
  });

  // ─── remove (soft-delete) ─────────────────────────────────────────────────

  describe('remove', () => {
    it('establece isActive = false (soft-delete)', async () => {
      const role = makeRole({ isActive: true });
      roleRepo.findOne!.mockResolvedValue(role);
      roleRepo.save!.mockImplementation(async (r) => r);

      await service.remove('role-1');

      expect(roleRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: false }),
      );
    });
  });

  // ─── activate ─────────────────────────────────────────────────────────────

  describe('activate', () => {
    it('establece isActive = true', async () => {
      const role = makeRole({ isActive: false });
      roleRepo.findOne!.mockResolvedValue(role);
      roleRepo.save!.mockImplementation(async (r) => r);

      await service.activate('role-1');

      expect(roleRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: true }),
      );
    });
  });

  // ─── findAll ──────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('retorna todos los roles sin filtro', async () => {
      roleRepo.find!.mockResolvedValue([makeRole(), makeRole({ id: 'role-2', name: 'nurse' })]);
      const result = await service.findAll();
      expect(result).toHaveLength(2);
    });

    it('filtra por isActive cuando se pasa el parámetro', async () => {
      roleRepo.find!.mockResolvedValue([makeRole()]);
      await service.findAll(true);
      expect(roleRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isActive: true } }),
      );
    });
  });
});
