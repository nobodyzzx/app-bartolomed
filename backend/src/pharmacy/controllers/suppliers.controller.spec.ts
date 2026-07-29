import { SuppliersController } from './suppliers.controller';
import { SuppliersService } from '../services/suppliers.service';
import { CreateSupplierDto, UpdateSupplierDto } from '../dto/supplier.dto';

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

  it('create delega el dto en suppliersService.create()', async () => {
    const dto: CreateSupplierDto = { contactPerson: 'Juan', email: 'a@b.com' } as CreateSupplierDto;
    const result = await controller.create(dto);
    expect(suppliersService.create).toHaveBeenCalledWith(dto);
    expect(result).toEqual({ id: 'sup-1' });
  });

  it('findAll delega sin argumentos', async () => {
    const result = await controller.findAll();
    expect(suppliersService.findAll).toHaveBeenCalled();
    expect(result).toEqual([{ id: 'sup-1' }]);
  });

  it('findOne delega el id', async () => {
    const result = await controller.findOne('sup-1');
    expect(suppliersService.findOne).toHaveBeenCalledWith('sup-1');
    expect(result).toEqual({ id: 'sup-1' });
  });

  it('update delega id y dto', async () => {
    const dto: UpdateSupplierDto = { name: 'Actualizado' };
    const result = await controller.update('sup-1', dto);
    expect(suppliersService.update).toHaveBeenCalledWith('sup-1', dto);
    expect(result).toEqual({ id: 'sup-1', name: 'Actualizado' });
  });

  it('remove delega el id', async () => {
    await controller.remove('sup-1');
    expect(suppliersService.remove).toHaveBeenCalledWith('sup-1');
  });

  it('restore delega el id', async () => {
    const result = await controller.restore('sup-1');
    expect(suppliersService.restore).toHaveBeenCalledWith('sup-1');
    expect(result).toEqual({ id: 'sup-1', isActive: true });
  });
});
