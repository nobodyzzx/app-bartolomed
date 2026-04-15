import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { Appointment, AppointmentStatus } from '../entities/appointment.entity';
import { Patient } from 'src/patients/entities/patient.entity';
import { User } from 'src/users/entities/user.entity';
import { Clinic } from 'src/clinics/entities/clinic.entity';
import { createMockRepository, createMockQueryBuilder, MockRepository } from 'src/test/helpers/mock-repository.factory';
import { makeClinic, makeUser, makePatient, makeAppointment } from 'src/test/helpers/test-data.factory';

const TOMORROW = new Date(Date.now() + 86_400_000).toISOString();
const YESTERDAY = new Date(Date.now() - 86_400_000).toISOString();

describe('AppointmentsService', () => {
  let service: AppointmentsService;
  let apptRepo: MockRepository<Appointment>;
  let patientRepo: MockRepository<Patient>;
  let userRepo: MockRepository<User>;
  let clinicRepo: MockRepository<Clinic>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentsService,
        { provide: getRepositoryToken(Appointment), useValue: createMockRepository() },
        { provide: getRepositoryToken(Patient), useValue: createMockRepository() },
        { provide: getRepositoryToken(User), useValue: createMockRepository() },
        { provide: getRepositoryToken(Clinic), useValue: createMockRepository() },
      ],
    }).compile();

    service = module.get<AppointmentsService>(AppointmentsService);
    apptRepo = module.get(getRepositoryToken(Appointment));
    patientRepo = module.get(getRepositoryToken(Patient));
    userRepo = module.get(getRepositoryToken(User));
    clinicRepo = module.get(getRepositoryToken(Clinic));
  });

  afterEach(() => jest.clearAllMocks());

  // ─── create ───────────────────────────────────────────────────────────────

  describe('create', () => {
    const baseDto = () => ({
      patientId: 'patient-1',
      doctorId: 'user-1',
      clinicId: 'clinic-1',
      appointmentDate: TOMORROW,
      duration: 30,
      type: 'consultation',
      priority: 'normal',
      reason: 'Control general',
    });

    /** Configura repos para el happy-path */
    const setupHappyPath = () => {
      patientRepo.findOne!.mockResolvedValue(makePatient());
      userRepo.findOne!.mockResolvedValue(makeUser({ roles: ['doctor'] }));
      clinicRepo.findOne!.mockResolvedValue(makeClinic());
      // assertDoctorAvailability usa createQueryBuilder
      const qb = createMockQueryBuilder({ getMany: jest.fn().mockResolvedValue([]) });
      apptRepo.createQueryBuilder!.mockReturnValue(qb);
      const saved = makeAppointment();
      apptRepo.create!.mockReturnValue(saved);
      apptRepo.save!.mockResolvedValue(saved);
    };

    it('crea una cita correctamente', async () => {
      setupHappyPath();
      const result = await service.create(baseDto() as any, makeUser() as any);
      expect(result).toBeDefined();
      expect(apptRepo.save).toHaveBeenCalled();
    });

    it('rechaza citas con fecha en el pasado', async () => {
      await expect(
        service.create({ ...baseDto(), appointmentDate: YESTERDAY } as any, makeUser() as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('lanza NotFoundException si el paciente no existe', async () => {
      patientRepo.findOne!.mockResolvedValue(null);

      await expect(service.create(baseDto() as any, makeUser() as any)).rejects.toThrow(NotFoundException);
    });

    it('lanza NotFoundException si el doctor no existe', async () => {
      patientRepo.findOne!.mockResolvedValue(makePatient());
      userRepo.findOne!.mockResolvedValue(null);

      await expect(service.create(baseDto() as any, makeUser() as any)).rejects.toThrow(NotFoundException);
    });

    it('lanza NotFoundException si el usuario no tiene rol doctor', async () => {
      patientRepo.findOne!.mockResolvedValue(makePatient());
      userRepo.findOne!.mockResolvedValue(makeUser({ roles: ['receptionist'] }));

      await expect(service.create(baseDto() as any, makeUser() as any)).rejects.toThrow(NotFoundException);
    });

    it('lanza NotFoundException si la clínica no existe', async () => {
      patientRepo.findOne!.mockResolvedValue(makePatient());
      userRepo.findOne!.mockResolvedValue(makeUser({ roles: ['doctor'] }));
      clinicRepo.findOne!.mockResolvedValue(null);

      await expect(service.create(baseDto() as any, makeUser() as any)).rejects.toThrow(NotFoundException);
    });

    it('lanza ConflictException si el doctor tiene cita solapada', async () => {
      patientRepo.findOne!.mockResolvedValue(makePatient());
      userRepo.findOne!.mockResolvedValue(makeUser({ roles: ['doctor'] }));
      clinicRepo.findOne!.mockResolvedValue(makeClinic());
      // assertDoctorAvailability usa getOne() — devolver conflicto
      const qb = createMockQueryBuilder({
        getOne: jest.fn().mockResolvedValue(makeAppointment()),
      });
      apptRepo.createQueryBuilder!.mockReturnValue(qb);

      const { ConflictException } = await import('@nestjs/common');
      await expect(service.create(baseDto() as any, makeUser() as any)).rejects.toThrow(ConflictException);
    });
  });

  // ─── cancel ───────────────────────────────────────────────────────────────

  describe('cancel', () => {
    it('cancela una cita en estado SCHEDULED', async () => {
      const appt = makeAppointment({ status: AppointmentStatus.SCHEDULED, canBeCancelled: () => true });
      apptRepo.findOne!.mockResolvedValue(appt);
      apptRepo.save!.mockResolvedValue({ ...appt, status: AppointmentStatus.CANCELLED });

      const result = await service.cancel('appt-1', 'Motivo válido', makeUser() as any, 'clinic-1');

      expect(result.status).toBe(AppointmentStatus.CANCELLED);
    });

    it('rechaza cancelar una cita ya COMPLETADA', async () => {
      const appt = makeAppointment({
        status: AppointmentStatus.COMPLETED,
        canBeCancelled: () => false,
      });
      apptRepo.findOne!.mockResolvedValue(appt);

      await expect(
        service.cancel('appt-1', 'Motivo', makeUser() as any, 'clinic-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('lanza NotFoundException si la cita no existe', async () => {
      apptRepo.findOne!.mockResolvedValue(null);

      await expect(
        service.cancel('no-existe', 'Motivo', makeUser() as any, 'clinic-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── getDoctorAvailability ────────────────────────────────────────────────

  describe('getDoctorAvailability', () => {
    it('lanza BadRequestException si no se provee clinicId', async () => {
      await expect(
        service.getDoctorAvailability('doctor-1', TOMORROW, undefined),
      ).rejects.toThrow(BadRequestException);
    });

    it('retorna available:true si no hay citas solapadas', async () => {
      const qb = createMockQueryBuilder({ getMany: jest.fn().mockResolvedValue([]) });
      apptRepo.createQueryBuilder!.mockReturnValue(qb);

      const result = await service.getDoctorAvailability('doctor-1', TOMORROW, 'clinic-1');

      expect(result.available).toBe(true);
      expect(result.conflictingAppointments).toHaveLength(0);
    });

    it('retorna available:false si hay citas solapadas', async () => {
      const qb = createMockQueryBuilder({
        getMany: jest.fn().mockResolvedValue([makeAppointment()]),
      });
      apptRepo.createQueryBuilder!.mockReturnValue(qb);

      const result = await service.getDoctorAvailability('doctor-1', TOMORROW, 'clinic-1');

      expect(result.available).toBe(false);
      expect(result.conflictingAppointments.length).toBeGreaterThan(0);
    });
  });
});
