import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { SuppliersService } from './suppliers.service';
import { Supplier, SupplierStatus } from '../entities/supplier.entity';
import { createMockRepository, MockRepository } from 'src/test/helpers/mock-repository.factory';

const makeSupplier = (overrides: Record<string, any> = {}) => ({
  id: 'sup-1',
  nombreComercial: 'Distribuidora Farmacéutica SA',
  code: 'SUP-001',
  isActive: true,
  ...overrides,
});

describe('SuppliersService', () => {
  let service: SuppliersService;
  let supplierRepo: MockRepository<Supplier>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SuppliersService,
        { provide: getRepositoryToken(Supplier), useValue: createMockRepository() },
      ],
    }).compile();

    service = module.get<SuppliersService>(SuppliersService);
    supplierRepo = module.get(getRepositoryToken(Supplier));
  });

  afterEach(() => jest.clearAllMocks());

  describe('findOne', () => {
    it('retorna proveedor existente', async () => {
      supplierRepo.findOne!.mockResolvedValue(makeSupplier());
      const result = await service.findOne('sup-1');
      expect(result.id).toBe('sup-1');
    });

    it('lanza NotFoundException si no existe', async () => {
      supplierRepo.findOne!.mockResolvedValue(null);
      await expect(service.findOne('no-existe')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('crea proveedor y genera código automático', async () => {
      const supplier = makeSupplier();
      supplierRepo.create!.mockReturnValue(supplier);
      supplierRepo.save!.mockResolvedValue(supplier);
      supplierRepo.count!.mockResolvedValue(0);

      const result = await service.create({ nombreComercial: 'Farmacéutica SA' } as any);
      expect(result).toBeDefined();
      expect(supplierRepo.save).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('marca proveedor como inactivo (soft delete)', async () => {
      const supplier = makeSupplier({ isActive: true });
      supplierRepo.findOne!.mockResolvedValue(supplier);
      supplierRepo.save!.mockImplementation(async (s) => s);

      await service.remove('sup-1');

      expect(supplierRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: SupplierStatus.INACTIVE }),
      );
    });
  });
});
