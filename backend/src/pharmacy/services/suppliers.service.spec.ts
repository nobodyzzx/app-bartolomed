import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { SuppliersService } from './suppliers.service';
import { Supplier, SupplierStatus } from '../entities/supplier.entity';
import { createMockRepository, MockRepository } from 'src/test/helpers/mock-repository.factory';

const CLINIC_ID = 'clinic-1';

const makeSupplier = (overrides: Record<string, any> = {}) => ({
  id: 'sup-1',
  nombreComercial: 'Distribuidora Farmacéutica SA',
  code: 'SUP-001',
  isActive: true,
  clinic: { id: CLINIC_ID },
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
    it('retorna proveedor existente de la clínica actual', async () => {
      supplierRepo.findOne!.mockResolvedValue(makeSupplier());
      const result = await service.findOne('sup-1', CLINIC_ID);
      expect(result.id).toBe('sup-1');
    });

    it('lanza NotFoundException si no existe', async () => {
      supplierRepo.findOne!.mockResolvedValue(null);
      await expect(service.findOne('no-existe', CLINIC_ID)).rejects.toThrow(NotFoundException);
    });

    it('lanza ForbiddenException si el proveedor pertenece a otra clínica (bug real: antes findAll/findOne no filtraban por clínica)', async () => {
      supplierRepo.findOne!.mockResolvedValue(makeSupplier({ clinic: { id: 'otra-clinica' } }));
      await expect(service.findOne('sup-1', CLINIC_ID)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('findAll', () => {
    it('filtra proveedores activos por clínica', async () => {
      supplierRepo.find!.mockResolvedValue([makeSupplier()]);

      await service.findAll(CLINIC_ID);

      expect(supplierRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: SupplierStatus.ACTIVE, clinic: { id: CLINIC_ID } } }),
      );
    });
  });

  describe('create', () => {
    it('crea proveedor y genera código automático, asignado a la clínica actual', async () => {
      const supplier = makeSupplier();
      supplierRepo.create!.mockReturnValue(supplier);
      supplierRepo.save!.mockResolvedValue(supplier);
      supplierRepo.count!.mockResolvedValue(0);

      const result = await service.create({ nombreComercial: 'Farmacéutica SA' } as any, CLINIC_ID);
      expect(result).toBeDefined();
      expect(supplierRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ clinic: { id: CLINIC_ID } }),
      );
    });
  });

  describe('remove', () => {
    it('marca proveedor como inactivo (soft delete)', async () => {
      const supplier = makeSupplier({ isActive: true });
      supplierRepo.findOne!.mockResolvedValue(supplier);
      supplierRepo.save!.mockImplementation(async (s) => s);

      await service.remove('sup-1', CLINIC_ID);

      expect(supplierRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: SupplierStatus.INACTIVE }),
      );
    });

    it('lanza ForbiddenException si el proveedor a eliminar es de otra clínica', async () => {
      supplierRepo.findOne!.mockResolvedValue(makeSupplier({ clinic: { id: 'otra-clinica' } }));

      await expect(service.remove('sup-1', CLINIC_ID)).rejects.toThrow(ForbiddenException);
    });
  });
});
