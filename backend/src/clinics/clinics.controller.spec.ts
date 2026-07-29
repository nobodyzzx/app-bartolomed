import { ClinicsController } from './clinics.controller';
import { ClinicsService } from './services/clinics.service';
import { User } from '../users/entities/user.entity';

describe('ClinicsController', () => {
  let controller: ClinicsController;
  let service: jest.Mocked<ClinicsService>;

  beforeEach(() => {
    service = {
      create: jest.fn().mockResolvedValue({ id: 'clinic-1' }),
      findAll: jest.fn().mockResolvedValue([{ id: 'clinic-1' }]),
      searchClinics: jest.fn().mockResolvedValue([]),
      getClinicStatistics: jest.fn().mockResolvedValue({ total: 1 }),
      findOne: jest.fn().mockResolvedValue({ id: 'clinic-1' }),
      update: jest.fn().mockResolvedValue({ id: 'clinic-1' }),
      remove: jest.fn().mockResolvedValue(undefined),
      activate: jest.fn().mockResolvedValue({ id: 'clinic-1', isActive: true }),
      deactivate: jest.fn().mockResolvedValue({ id: 'clinic-1', isActive: false }),
      getClinicMembers: jest.fn().mockResolvedValue([]),
      addMemberWithRoles: jest.fn().mockResolvedValue({ ok: true }),
      updateMemberRoles: jest.fn().mockResolvedValue({ ok: true }),
      removeUserFromClinic: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<ClinicsService>;
    controller = new ClinicsController(service);
  });

  it('create delega dto y user', async () => {
    const dto = { name: 'Clínica Norte' } as any;
    const user = { id: 'user-1' } as User;
    await controller.create(dto, user);
    expect(service.create).toHaveBeenCalledWith(dto, user);
  });

  describe('findAll', () => {
    it('convierte isActive="true" a boolean true', async () => {
      await controller.findAll('true');
      expect(service.findAll).toHaveBeenCalledWith(true);
    });

    it('convierte cualquier otro string a boolean false', async () => {
      await controller.findAll('no');
      expect(service.findAll).toHaveBeenCalledWith(false);
    });

    it('pasa undefined si no viene el query param', async () => {
      await controller.findAll();
      expect(service.findAll).toHaveBeenCalledWith(undefined);
    });
  });

  it('search delega el término', async () => {
    await controller.search('norte');
    expect(service.searchClinics).toHaveBeenCalledWith('norte');
  });

  it('getStatistics delega sin argumentos', async () => {
    const result = await controller.getStatistics();
    expect(service.getClinicStatistics).toHaveBeenCalled();
    expect(result).toEqual({ total: 1 });
  });

  it('findOne delega el id', async () => {
    await controller.findOne('clinic-1');
    expect(service.findOne).toHaveBeenCalledWith('clinic-1');
  });

  it('update delega id y dto', async () => {
    const dto = { name: 'Actualizado' } as any;
    await controller.update('clinic-1', dto);
    expect(service.update).toHaveBeenCalledWith('clinic-1', dto);
  });

  it('remove delega el id', async () => {
    await controller.remove('clinic-1');
    expect(service.remove).toHaveBeenCalledWith('clinic-1');
  });

  it('activate delega el id', async () => {
    await controller.activate('clinic-1');
    expect(service.activate).toHaveBeenCalledWith('clinic-1');
  });

  it('deactivate delega el id', async () => {
    await controller.deactivate('clinic-1');
    expect(service.deactivate).toHaveBeenCalledWith('clinic-1');
  });

  it('getMembers delega el clinicId', async () => {
    await controller.getMembers('clinic-1');
    expect(service.getClinicMembers).toHaveBeenCalledWith('clinic-1');
  });

  it('addMember delega clinicId y dto', async () => {
    const dto = { userId: 'user-2', roles: ['doctor'] } as any;
    await controller.addMember('clinic-1', dto);
    expect(service.addMemberWithRoles).toHaveBeenCalledWith('clinic-1', dto);
  });

  it('updateMember delega clinicId, userId y dto', async () => {
    const dto = { roles: ['admin'] } as any;
    await controller.updateMember('clinic-1', 'user-2', dto);
    expect(service.updateMemberRoles).toHaveBeenCalledWith('clinic-1', 'user-2', dto);
  });

  it('removeMember delega userId y clinicId en ese orden al service', async () => {
    await controller.removeMember('clinic-1', 'user-2');
    expect(service.removeUserFromClinic).toHaveBeenCalledWith('user-2', 'clinic-1');
  });
});
