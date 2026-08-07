import { BadRequestException } from '@nestjs/common';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './services/appointments.service';
import { AppointmentStatus } from './entities/appointment.entity';
import { User } from '../users/entities/user.entity';

const makeReq = (overrides: Record<string, any> = {}) =>
  ({ headers: { 'x-clinic-id': 'clinic-1' }, params: {}, ...overrides }) as any;

describe('AppointmentsController', () => {
  let controller: AppointmentsController;
  let service: jest.Mocked<AppointmentsService>;
  const user = { id: 'user-1' } as User;

  beforeEach(() => {
    service = {
      create: jest.fn().mockResolvedValue({ id: 'apt-1' }),
      findAll: jest.fn().mockResolvedValue({ data: [], total: 0 }),
      getAppointmentStatistics: jest.fn().mockResolvedValue({ total: 0 }),
      getDoctorAvailability: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue({ id: 'apt-1' }),
      update: jest.fn().mockResolvedValue({ id: 'apt-1' }),
      confirm: jest.fn().mockResolvedValue({ id: 'apt-1', status: AppointmentStatus.CONFIRMED }),
      complete: jest.fn().mockResolvedValue({ id: 'apt-1', status: AppointmentStatus.COMPLETED }),
      cancel: jest.fn().mockResolvedValue({ id: 'apt-1', status: AppointmentStatus.CANCELLED }),
      remove: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<AppointmentsService>;
    controller = new AppointmentsController(service);
  });

  describe('create', () => {
    it('crea la cita si el clinicId del dto coincide con el contexto', async () => {
      const dto = { clinicId: 'clinic-1', doctorId: 'doc-1' } as any;
      await controller.create(dto, user, makeReq());
      expect(service.create).toHaveBeenCalledWith(dto, user);
    });

    it('lanza BadRequestException (síncrono) si el clinicId del dto no coincide', () => {
      const dto = { clinicId: 'clinic-2', doctorId: 'doc-1' } as any;
      expect(() => controller.create(dto, user, makeReq())).toThrow(BadRequestException);
      expect(service.create).not.toHaveBeenCalled();
    });

    it('permite crear si no hay clinicId en el contexto', async () => {
      const dto = { clinicId: 'clinic-2', doctorId: 'doc-1' } as any;
      await controller.create(dto, user, makeReq({ headers: {} }));
      expect(service.create).toHaveBeenCalledWith(dto, user);
    });
  });

  it('findAll delega todos los filtros y el clinicId resuelto', async () => {
    await controller.findAll(makeReq(), 'doc-1', 'pat-1', AppointmentStatus.SCHEDULED, '2026-01-01', '2026-01-31');
    expect(service.findAll).toHaveBeenCalledWith(
      'clinic-1',
      'doc-1',
      'pat-1',
      AppointmentStatus.SCHEDULED,
      '2026-01-01',
      '2026-01-31',
    );
  });

  it('getStatistics delega doctorId/fechas/clinicId', async () => {
    await controller.getStatistics(makeReq(), 'doc-1', '2026-01-01', '2026-01-31');
    expect(service.getAppointmentStatistics).toHaveBeenCalledWith('clinic-1', 'doc-1', '2026-01-01', '2026-01-31');
  });

  it('getDoctorAvailability delega doctorId/fecha/clinicId', async () => {
    await controller.getDoctorAvailability('doc-1', makeReq(), '2026-02-01');
    expect(service.getDoctorAvailability).toHaveBeenCalledWith('doc-1', '2026-02-01', 'clinic-1');
  });

  it('findOne delega id y clinicId', async () => {
    await controller.findOne('apt-1', makeReq());
    expect(service.findOne).toHaveBeenCalledWith('apt-1', 'clinic-1');
  });

  it('update delega id, dto, user y clinicId', async () => {
    const dto = { notes: 'x' } as any;
    await controller.update('apt-1', dto, makeReq(), user);
    expect(service.update).toHaveBeenCalledWith('apt-1', dto, user, 'clinic-1');
  });

  it('confirm delega id, user y clinicId', async () => {
    await controller.confirm('apt-1', makeReq(), user);
    expect(service.confirm).toHaveBeenCalledWith('apt-1', user, 'clinic-1');
  });

  it('complete delega id, user y clinicId', async () => {
    await controller.complete('apt-1', makeReq(), user);
    expect(service.complete).toHaveBeenCalledWith('apt-1', user, 'clinic-1');
  });

  it('cancel delega id, motivo, user y clinicId', async () => {
    await controller.cancel('apt-1', 'Paciente no puede asistir', makeReq(), user);
    expect(service.cancel).toHaveBeenCalledWith('apt-1', 'Paciente no puede asistir', user, 'clinic-1');
  });

  it('remove delega id y clinicId', async () => {
    await controller.remove('apt-1', makeReq());
    expect(service.remove).toHaveBeenCalledWith('apt-1', 'clinic-1');
  });
});
