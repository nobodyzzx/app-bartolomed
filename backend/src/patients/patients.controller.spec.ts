import { BadRequestException } from '@nestjs/common';
import { PatientsController } from './patients.controller';
import { PatientsService } from './services/patients.service';
import { User } from '../users/entities/user.entity';

const makeReq = (overrides: Record<string, any> = {}) =>
  ({
    headers: { 'x-clinic-id': 'clinic-1' },
    params: {},
    user: { id: 'user-1', email: 'doc@example.com' },
    ip: '10.0.0.1',
    ...overrides,
  }) as any;

describe('PatientsController', () => {
  let controller: PatientsController;
  let service: jest.Mocked<PatientsService>;

  beforeEach(() => {
    service = {
      create: jest.fn().mockResolvedValue({ id: 'patient-1' }),
      findAll: jest.fn().mockResolvedValue({ data: [], total: 0 }),
      searchPatients: jest.fn().mockResolvedValue([]),
      getPatientStatistics: jest.fn().mockResolvedValue({ total: 0 }),
      findByDocumentNumber: jest.fn().mockResolvedValue({ id: 'patient-1' }),
      findOne: jest.fn().mockResolvedValue({ id: 'patient-1' }),
      update: jest.fn().mockResolvedValue({ id: 'patient-1' }),
      remove: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<PatientsService>;
    controller = new PatientsController(service);
  });

  describe('create', () => {
    it('crea el paciente si el clinicId del dto coincide con el contexto', async () => {
      const dto = { clinicId: 'clinic-1', firstName: 'Juan' } as any;
      const user = { id: 'user-1' } as User;

      const result = await controller.create(dto, user, makeReq());

      expect(service.create).toHaveBeenCalledWith(dto, user);
      expect(result).toEqual({ id: 'patient-1' });
    });

    it('lanza BadRequestException si el clinicId del dto no coincide con el contexto', () => {
      const dto = { clinicId: 'clinic-2', firstName: 'Juan' } as any;

      expect(() => controller.create(dto, {} as User, makeReq())).toThrow(BadRequestException);
      expect(service.create).not.toHaveBeenCalled();
    });

    it('permite crear si no hay clinicId en el contexto (sin conflicto posible)', async () => {
      const dto = { clinicId: 'clinic-2', firstName: 'Juan' } as any;

      await controller.create(dto, {} as User, makeReq({ headers: {} }));

      expect(service.create).toHaveBeenCalledWith(dto, {});
    });
  });

  it('findAll delega paginación, género y clinicId', async () => {
    await controller.findAll(2, 10, 'F' as any, makeReq());
    expect(service.findAll).toHaveBeenCalledWith('clinic-1', 2, 10, 'F');
  });

  it('search delega el término, clinicId y límite', async () => {
    await controller.search('juan', 5, makeReq());
    expect(service.searchPatients).toHaveBeenCalledWith('juan', 'clinic-1', 5);
  });

  it('getStatistics resuelve clinicId del request', async () => {
    await controller.getStatistics(makeReq());
    expect(service.getPatientStatistics).toHaveBeenCalledWith('clinic-1');
  });

  it('findByDocument delega el número de documento y clinicId', async () => {
    await controller.findByDocument('1234567', makeReq());
    expect(service.findByDocumentNumber).toHaveBeenCalledWith('1234567', 'clinic-1');
  });

  it('findOne delega id y clinicId', async () => {
    await controller.findOne('patient-1', makeReq());
    expect(service.findOne).toHaveBeenCalledWith('patient-1', 'clinic-1');
  });

  describe('update', () => {
    it('actualiza si el clinicId del dto coincide con el contexto', async () => {
      const dto = { clinicId: 'clinic-1', firstName: 'Actualizado' } as any;

      await controller.update('patient-1', dto, makeReq());

      expect(service.update).toHaveBeenCalledWith('patient-1', dto, 'clinic-1', {
        id: 'user-1',
        email: 'doc@example.com',
        clinicId: 'clinic-1',
        ip: '10.0.0.1',
      });
    });

    it('lanza BadRequestException si el clinicId del dto no coincide con el contexto', () => {
      const dto = { clinicId: 'clinic-2', firstName: 'Actualizado' } as any;

      expect(() => controller.update('patient-1', dto, makeReq())).toThrow(BadRequestException);
      expect(service.update).not.toHaveBeenCalled();
    });

    it('permite actualizar si el dto no trae clinicId', async () => {
      const dto = { firstName: 'Actualizado' } as any;

      await controller.update('patient-1', dto, makeReq());

      expect(service.update).toHaveBeenCalledWith('patient-1', dto, 'clinic-1', expect.any(Object));
    });
  });

  it('remove arma el actor con id/email/clinicId/ip y delega', async () => {
    await controller.remove('patient-1', makeReq());

    expect(service.remove).toHaveBeenCalledWith('patient-1', 'clinic-1', {
      id: 'user-1',
      email: 'doc@example.com',
      clinicId: 'clinic-1',
      ip: '10.0.0.1',
    });
  });
});
