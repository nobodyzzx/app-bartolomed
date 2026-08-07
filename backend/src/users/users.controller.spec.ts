import { UsersController } from './users.controller';
import { UsersService } from './services/users.service';
import { CreateUserDto, UpdateUserDto } from './dto';
import { PaginationDto } from '../common/dtos/pagination.dto';
import { User } from './entities/user.entity';

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: jest.Mocked<UsersService>;

  const actor = { id: 'admin-1', roles: ['admin'] } as unknown as User;
  const req = { headers: { 'x-clinic-id': 'clinic-1' }, params: {} } as any;

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

  it('create delega el dto, el actor y el clinicId resuelto', async () => {
    const dto: CreateUserDto = { email: 'a@b.com' } as CreateUserDto;
    const result = await controller.create(dto, actor, req);
    expect(usersService.create).toHaveBeenCalledWith(dto, actor, 'clinic-1');
    expect(result).toEqual({ id: 'user-1' });
  });

  it('findAll delega el dto de paginación, el actor y el clinicId', async () => {
    const dto: PaginationDto = { page: 1, limit: 20 } as PaginationDto;
    const result = await controller.findAll(dto, actor, req);
    expect(usersService.findAll).toHaveBeenCalledWith(dto, actor, 'clinic-1');
    expect(result).toEqual({ data: [], total: 0 });
  });

  it('getStatistics resuelve el clinicId del header x-clinic-id', async () => {
    const result = await controller.getStatistics(req);
    expect(usersService.getClinicStatistics).toHaveBeenCalledWith('clinic-1');
    expect(result).toEqual({ totalDoctors: 2, totalNurses: 1, totalReceptionists: 1, totalPharmacists: 1 });
  });

  it('findOne delega el id, el actor y el clinicId', async () => {
    const result = await controller.findOne('user-1', actor, req);
    expect(usersService.findOne).toHaveBeenCalledWith('user-1', actor, 'clinic-1');
    expect(result).toEqual({ id: 'user-1' });
  });

  it('updateStatus delega id, isActive, actor y clinicId', async () => {
    await controller.updateStatus('user-1', false, actor, req);
    expect(usersService.updateStatus).toHaveBeenCalledWith('user-1', false, actor, 'clinic-1');
  });

  it('update delega id, dto, actor y clinicId', async () => {
    const dto: UpdateUserDto = { email: 'nuevo@example.com' } as UpdateUserDto;
    const result = await controller.update('user-1', dto, actor, req);
    expect(usersService.update).toHaveBeenCalledWith('user-1', dto, actor, 'clinic-1');
    expect(result).toEqual({ id: 'user-1', email: 'nuevo@example.com' });
  });

  it('remove delega el id, el actor y el clinicId', async () => {
    await controller.remove('user-1', actor, req);
    expect(usersService.remove).toHaveBeenCalledWith('user-1', actor, 'clinic-1');
  });
});
