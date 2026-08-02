import { UsersController } from './users.controller';
import { UsersService } from './services/users.service';
import { CreateUserDto } from './dto';
import { PaginationDto } from '../common/dtos/pagination.dto';

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: jest.Mocked<UsersService>;

  beforeEach(() => {
    usersService = {
      create: jest.fn().mockResolvedValue({ id: 'user-1' }),
      findAll: jest.fn().mockResolvedValue({ data: [], total: 0 }),
      getClinicStatistics: jest
        .fn()
        .mockResolvedValue({ totalDoctors: 2, totalNurses: 1, totalReceptionists: 1, totalPharmacists: 1 }),
      findOne: jest.fn().mockResolvedValue({ id: 'user-1' }),
      updateStatus: jest.fn().mockResolvedValue(undefined),
      update: jest.fn().mockResolvedValue({ id: 'user-1', email: 'nuevo@example.com' }),
      remove: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<UsersService>;
    controller = new UsersController(usersService);
  });

  it('create delega el dto en usersService.create()', async () => {
    const dto: CreateUserDto = { email: 'a@b.com' } as CreateUserDto;
    const result = await controller.create(dto);
    expect(usersService.create).toHaveBeenCalledWith(dto);
    expect(result).toEqual({ id: 'user-1' });
  });

  it('findAll delega el dto de paginación', async () => {
    const dto: PaginationDto = { page: 1, limit: 20 } as PaginationDto;
    const result = await controller.findAll(dto);
    expect(usersService.findAll).toHaveBeenCalledWith(dto);
    expect(result).toEqual({ data: [], total: 0 });
  });

  it('getStatistics resuelve el clinicId del header x-clinic-id', async () => {
    const req = { headers: { 'x-clinic-id': 'clinic-1' }, params: {} } as any;
    const result = await controller.getStatistics(req);
    expect(usersService.getClinicStatistics).toHaveBeenCalledWith('clinic-1');
    expect(result).toEqual({ totalDoctors: 2, totalNurses: 1, totalReceptionists: 1, totalPharmacists: 1 });
  });

  it('findOne delega el id', async () => {
    const result = await controller.findOne('user-1');
    expect(usersService.findOne).toHaveBeenCalledWith('user-1');
    expect(result).toEqual({ id: 'user-1' });
  });

  it('updateStatus delega id e isActive', async () => {
    await controller.updateStatus('user-1', false);
    expect(usersService.updateStatus).toHaveBeenCalledWith('user-1', false);
  });

  it('update delega id y dto parcial', async () => {
    const dto: Partial<CreateUserDto> = { email: 'nuevo@example.com' };
    const result = await controller.update('user-1', dto);
    expect(usersService.update).toHaveBeenCalledWith('user-1', dto);
    expect(result).toEqual({ id: 'user-1', email: 'nuevo@example.com' });
  });

  it('remove delega el id', async () => {
    await controller.remove('user-1');
    expect(usersService.remove).toHaveBeenCalledWith('user-1');
  });
});
