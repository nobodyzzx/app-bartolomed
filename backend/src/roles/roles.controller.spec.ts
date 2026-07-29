import { RolesController } from './roles.controller';
import { RolesService } from './services/roles.service';
import { CreateRoleDto, UpdateRoleDto } from './dto';

describe('RolesController', () => {
  let controller: RolesController;
  let rolesService: jest.Mocked<RolesService>;

  beforeEach(() => {
    rolesService = {
      create: jest.fn().mockResolvedValue({ id: 'role-1' }),
      findAll: jest.fn().mockResolvedValue([{ id: 'role-1' }]),
      findOne: jest.fn().mockResolvedValue({ id: 'role-1' }),
      update: jest.fn().mockResolvedValue({ id: 'role-1', name: 'Actualizado' }),
      remove: jest.fn().mockResolvedValue(undefined),
      activate: jest.fn().mockResolvedValue({ id: 'role-1', isActive: true }),
    } as unknown as jest.Mocked<RolesService>;
    controller = new RolesController(rolesService);
  });

  it('create delega el dto en rolesService.create()', async () => {
    const dto: CreateRoleDto = { name: 'Enfermero' } as CreateRoleDto;
    const result = await controller.create(dto);
    expect(rolesService.create).toHaveBeenCalledWith(dto);
    expect(result).toEqual({ id: 'role-1' });
  });

  describe('findAll', () => {
    it('convierte isActive="true" a boolean true', async () => {
      await controller.findAll('true');
      expect(rolesService.findAll).toHaveBeenCalledWith(true);
    });

    it('convierte cualquier otro string a boolean false', async () => {
      await controller.findAll('false');
      expect(rolesService.findAll).toHaveBeenCalledWith(false);
    });

    it('pasa undefined si no viene el query param', async () => {
      await controller.findAll();
      expect(rolesService.findAll).toHaveBeenCalledWith(undefined);
    });
  });

  it('findOne delega el id', async () => {
    const result = await controller.findOne('role-1');
    expect(rolesService.findOne).toHaveBeenCalledWith('role-1');
    expect(result).toEqual({ id: 'role-1' });
  });

  it('update delega id y dto', async () => {
    const dto: UpdateRoleDto = { name: 'Actualizado' };
    const result = await controller.update('role-1', dto);
    expect(rolesService.update).toHaveBeenCalledWith('role-1', dto);
    expect(result).toEqual({ id: 'role-1', name: 'Actualizado' });
  });

  it('remove delega el id', async () => {
    await controller.remove('role-1');
    expect(rolesService.remove).toHaveBeenCalledWith('role-1');
  });

  it('activate delega el id', async () => {
    const result = await controller.activate('role-1');
    expect(rolesService.activate).toHaveBeenCalledWith('role-1');
    expect(result).toEqual({ id: 'role-1', isActive: true });
  });
});
