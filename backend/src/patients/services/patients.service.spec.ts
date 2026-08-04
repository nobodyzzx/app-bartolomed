import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { AuditService } from 'src/audit/audit.service';
import { PatientsService } from './patients.service';
import { Patient } from '../entities/patient.entity';
import { Clinic } from 'src/clinics/entities/clinic.entity';
import { Appointment } from 'src/appointments/entities/appointment.entity';
import { Prescription } from 'src/prescriptions/entities/prescription.entity';
import { Invoice } from 'src/billing/entities/billing.entity';
import { LabOrder } from 'src/lab-orders/entities/lab-order.entity';
import { createMockRepository, MockRepository } from 'src/test/helpers/mock-repository.factory';
import { makeClinic, makePatient, makeCreatePatientDto, makeUser } from 'src/test/helpers/test-data.factory';

describe('PatientsService', () => {
  let service: PatientsService;
  let patientRepo: MockRepository<Patient>;
  let clinicRepo: MockRepository<Clinic>;
  let appointmentRepo: MockRepository<Appointment>;
  let prescriptionRepo: MockRepository<Prescription>;
  let invoiceRepo: MockRepository<Invoice>;
  let labOrderRepo: MockRepository<LabOrder>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PatientsService,
        { provide: getRepositoryToken(Patient), useValue: createMockRepository() },
        { provide: getRepositoryToken(Clinic), useValue: createMockRepository() },
        { provide: getRepositoryToken(Appointment), useValue: createMockRepository() },
        { provide: getRepositoryToken(Prescription), useValue: createMockRepository() },
        { provide: getRepositoryToken(Invoice), useValue: createMockRepository() },
        { provide: getRepositoryToken(LabOrder), useValue: createMockRepository() },
        { provide: AuditService, useValue: { log: jest.fn() } },
      ],
    }).compile();

    service = module.get<PatientsService>(PatientsService);
    patientRepo = module.get(getRepositoryToken(Patient));
    clinicRepo = module.get(getRepositoryToken(Clinic));
    appointmentRepo = module.get(getRepositoryToken(Appointment));
    prescriptionRepo = module.get(getRepositoryToken(Prescription));
    invoiceRepo = module.get(getRepositoryToken(Invoice));
    labOrderRepo = module.get(getRepositoryToken(LabOrder));

    // Por defecto, sin registros activos pendientes (remove() no debe bloquear)
    appointmentRepo.count!.mockResolvedValue(0);
    prescriptionRepo.count!.mockResolvedValue(0);
    invoiceRepo.count!.mockResolvedValue(0);
    labOrderRepo.count!.mockResolvedValue(0);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── create ───────────────────────────────────────────────────────────────

  describe('create', () => {
    it('crea un paciente correctamente', async () => {
      const dto = makeCreatePatientDto();
      const clinic = makeClinic();
      const user = makeUser();
      const saved = makePatient({ documentNumber: dto.documentNumber });

      clinicRepo.findOne!.mockResolvedValue(clinic);
      patientRepo.findOne!.mockResolvedValue(null); // no duplicado
      patientRepo.create!.mockReturnValue(saved);
      patientRepo.save!.mockResolvedValue(saved);

      const result = await service.create(dto as any, user as any);

      expect(result).toEqual(saved);
      expect(patientRepo.save).toHaveBeenCalledWith(saved);
    });

    it('rechaza si la clínica no existe', async () => {
      clinicRepo.findOne!.mockResolvedValue(null);

      await expect(
        service.create(makeCreatePatientDto() as any, makeUser() as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('rechaza si ya existe un paciente ACTIVO con el mismo CI', async () => {
      clinicRepo.findOne!.mockResolvedValue(makeClinic());
      patientRepo.findOne!.mockResolvedValue(makePatient()); // duplicado activo

      await expect(
        service.create(makeCreatePatientDto() as any, makeUser() as any),
      ).rejects.toThrow(ConflictException);
    });

    /**
     * Regresión: bug corregido el 2026-04-02.
     * Un paciente eliminado (isActive=false) con el mismo CI no debe bloquear
     * el registro de un nuevo paciente.
     */
    it('permite crear paciente con CI de un paciente ELIMINADO (soft-delete)', async () => {
      const dto = makeCreatePatientDto();
      const saved = makePatient({ documentNumber: dto.documentNumber });

      clinicRepo.findOne!.mockResolvedValue(makeClinic());
      // La consulta filtra isActive:true → no encuentra el eliminado → devuelve null
      patientRepo.findOne!.mockResolvedValue(null);
      patientRepo.create!.mockReturnValue(saved);
      patientRepo.save!.mockResolvedValue(saved);

      await expect(
        service.create(dto as any, makeUser() as any),
      ).resolves.toBeDefined();

      // Verificar que la consulta de duplicado incluye isActive: true
      expect(patientRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ isActive: true }) }),
      );
    });

    it('rechaza fechas de nacimiento futuras', async () => {
      const dto = makeCreatePatientDto({ birthDate: '2099-01-01' });
      clinicRepo.findOne!.mockResolvedValue(makeClinic());

      await expect(
        service.create(dto as any, makeUser() as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza fechas de nacimiento inválidas', async () => {
      const dto = makeCreatePatientDto({ birthDate: 'no-es-fecha' });
      clinicRepo.findOne!.mockResolvedValue(makeClinic());

      await expect(
        service.create(dto as any, makeUser() as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── remove (soft-delete) ─────────────────────────────────────────────────

  describe('remove', () => {
    it('hace soft-delete estableciendo isActive = false', async () => {
      const patient = makePatient();
      patientRepo.findOne!.mockResolvedValue(patient);
      patientRepo.save!.mockResolvedValue({ ...patient, isActive: false });

      await service.remove('patient-1', 'clinic-1');

      expect(patientRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: false }),
      );
    });

    /**
     * Regresión: bug corregido en la auditoría de interrelación de módulos
     * (2026-08-04). remove() reescribía documentNumber a `DEL_<timestamp>_<CI>`
     * para liberar el CI, lo que corrompía el CI mostrado en PDFs históricos
     * (recetas) de ese paciente generados después del borrado. El índice
     * único ahora es parcial (solo entre activos), así que remove() ya no
     * necesita mutar el CI.
     */
    it('no reescribe documentNumber al hacer soft-delete', async () => {
      const patient = makePatient({ documentNumber: '12345678' });
      patientRepo.findOne!.mockResolvedValue(patient);
      patientRepo.save!.mockResolvedValue({ ...patient, isActive: false });

      await service.remove('patient-1', 'clinic-1');

      expect(patientRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ documentNumber: '12345678' }),
      );
    });

    it('lanza NotFoundException si el paciente no existe', async () => {
      patientRepo.findOne!.mockResolvedValue(null);

      await expect(service.remove('no-existe', 'clinic-1')).rejects.toThrow(NotFoundException);
    });

    /**
     * Regresión: bug corregido en la auditoría de interrelación de módulos
     * (2026-08-04). remove() no validaba citas/recetas/facturas/lab-orders
     * activas del paciente antes de desactivarlo — quedaban huérfanas.
     */
    it('rechaza el borrado si el paciente tiene citas SCHEDULED/CONFIRMED/IN_PROGRESS', async () => {
      patientRepo.findOne!.mockResolvedValue(makePatient());
      appointmentRepo.count!.mockResolvedValue(2);

      await expect(service.remove('patient-1', 'clinic-1')).rejects.toThrow(ConflictException);
      expect(patientRepo.save).not.toHaveBeenCalled();
    });

    it('rechaza el borrado si el paciente tiene recetas DRAFT/ACTIVE/DISPENSED', async () => {
      patientRepo.findOne!.mockResolvedValue(makePatient());
      prescriptionRepo.count!.mockResolvedValue(1);

      await expect(service.remove('patient-1', 'clinic-1')).rejects.toThrow(ConflictException);
      expect(patientRepo.save).not.toHaveBeenCalled();
    });

    it('rechaza el borrado si el paciente tiene facturas PENDING/PARTIALLY_PAID/OVERDUE', async () => {
      patientRepo.findOne!.mockResolvedValue(makePatient());
      invoiceRepo.count!.mockResolvedValue(1);

      await expect(service.remove('patient-1', 'clinic-1')).rejects.toThrow(ConflictException);
      expect(patientRepo.save).not.toHaveBeenCalled();
    });

    it('rechaza el borrado si el paciente tiene órdenes de laboratorio en curso', async () => {
      patientRepo.findOne!.mockResolvedValue(makePatient());
      labOrderRepo.count!.mockResolvedValue(1);

      await expect(service.remove('patient-1', 'clinic-1')).rejects.toThrow(ConflictException);
      expect(patientRepo.save).not.toHaveBeenCalled();
    });

    it('permite el borrado cuando no hay registros activos relacionados', async () => {
      const patient = makePatient();
      patientRepo.findOne!.mockResolvedValue(patient);
      patientRepo.save!.mockResolvedValue({ ...patient, isActive: false });

      await expect(service.remove('patient-1', 'clinic-1')).resolves.toBeUndefined();
    });
  });

  // ─── update ───────────────────────────────────────────────────────────────

  describe('update', () => {
    it('permite cambiar CI al de un paciente ELIMINADO', async () => {
      const existing = makePatient({ documentNumber: 'CI-VIEJO' });
      // Primera llamada: findOne para cargar el paciente actual
      // Segunda llamada: findOne para buscar duplicado con isActive:true → null (eliminado)
      patientRepo.findOne!
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce(null);
      patientRepo.save!.mockResolvedValue({ ...existing, documentNumber: 'CI-NUEVO' });

      await expect(
        service.update('patient-1', { documentNumber: 'CI-NUEVO' } as any, 'clinic-1'),
      ).resolves.toBeDefined();

      // La segunda llamada debe filtrar por isActive: true
      expect(patientRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ isActive: true }) }),
      );
    });

    it('rechaza cambiar CI al de un paciente ACTIVO existente', async () => {
      const existing = makePatient({ documentNumber: 'CI-VIEJO' });
      patientRepo.findOne!
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce(makePatient({ documentNumber: 'CI-NUEVO' }));

      await expect(
        service.update('patient-1', { documentNumber: 'CI-NUEVO' } as any, 'clinic-1'),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ─── findAll ──────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('lanza BadRequestException si no se provee clinicId', async () => {
      await expect(service.findAll('')).rejects.toThrow(BadRequestException);
    });
  });
});
