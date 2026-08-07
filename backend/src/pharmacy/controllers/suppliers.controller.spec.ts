import { SuppliersController } from './suppliers.controller';
import { SuppliersService } from '../services/suppliers.service';
import { CreateSupplierDto, UpdateSupplierDto } from '../dto/supplier.dto';

const makeReq = (overrides: Record<string, any> = {}) => ({
  headers: { 'x-clinic-id': 'clinic-1' },
  params: {},
  ...overrides,
});

describe('SuppliersController', () => {
  let controller: SuppliersController;
  let suppliersService: jest.Mocked<SuppliersService>;

  beforeEach(() => {
    suppliersService = {
      create: jest.fn().mockResolvedValue({ id: 'sup-1' }),
      findAll: jest.fn().mockResolvedValue([{ id: 'sup-1' }]),
      findOne: jest.fn().mockResolvedValue({ id: 'sup-1' }),
      update: jest.fn().mockResolvedValue({ id: 'sup-1', name: 'Actualizado' }),
      remove: jest.fn().mockResolvedValue(undefined),
      restore: jest.fn().mockResolvedValue({ id: 'sup-1', isActive: true }),
    } as unknown as jest.Mocked<SuppliersService>;
    controller = new SuppliersController(suppliersService);
  });

  it('create resuelve el clinicId y delega junto al dto (bug real: antes no se resolvía ni asignaba clínica)', async () => {
    const dto: CreateSupplierDto = { contactPerson: 'Juan', email: 'a@b.com' } as CreateSupplierDto;
    const result = await controller.create(dto, makeReq());
    expect(suppliersService.create).toHaveBeenCalledWith(dto, 'clinic-1');
    expect(result).toEqual({ id: 'sup-1' });
  });

  it('findAll resuelve y delega el clinicId (bug real: antes devolvía proveedores de todas las clínicas)', async () => {
    const result = await controller.findAll(makeReq());
    expect(suppliersService.findAll).toHaveBeenCalledWith('clinic-1');
    expect(result).toEqual([{ id: 'sup-1' }]);
  });

  it('findOne resuelve y delega el clinicId', async () => {
    const result = await controller.findOne('sup-1', makeReq());
    expect(suppliersService.findOne).toHaveBeenCalledWith('sup-1', 'clinic-1');
    expect(result).toEqual({ id: 'sup-1' });
  });

  it('update resuelve y delega el clinicId junto a id y dto', async () => {
    const dto: UpdateSupplierDto = { name: 'Actualizado' };
    const result = await controller.update('sup-1', dto, makeReq());
    expect(suppliersService.update).toHaveBeenCalledWith('sup-1', dto, 'clinic-1');
    expect(result).toEqual({ id: 'sup-1', name: 'Actualizado' });
  });

  it('remove resuelve y delega el clinicId', async () => {
    await controller.remove('sup-1', makeReq());
    expect(suppliersService.remove).toHaveBeenCalledWith('sup-1', 'clinic-1');
  });

  it('restore resuelve y delega el clinicId', async () => {
    const result = await controller.restore('sup-1', makeReq());
    expect(suppliersService.restore).toHaveBeenCalledWith('sup-1', 'clinic-1');
    expect(result).toEqual({ id: 'sup-1', isActive: true });
  });
});
