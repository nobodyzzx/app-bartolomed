import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PatientsService } from './patients.service';
import { Patient } from '../entities/patient.entity';
import { Clinic } from 'src/clinics/entities/clinic.entity';
import { createMockRepository, createMockQueryBuilder, MockRepository } from 'src/test/helpers/mock-repository.factory';
import { makeClinic, makePatient, makeCreatePatientDto, makeUser } from 'src/test/helpers/test-data.factory';

describe('PatientsService', () => {
  let service: PatientsService;
  let patientRepo: MockRepository<Patient>;
  let clinicRepo: MockRepository<Clinic>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PatientsService,
        { provide: getRepositoryToken(Patient), useValue: createMockRepository() },
        { provide: getRepositoryToken(Clinic), useValue: createMockRepository() },
      ],
    }).compile();

    service = module.get<PatientsService>(PatientsService);
    patientRepo = module.get(getRepositoryToken(Patient));
    clinicRepo = module.get(getRepositoryToken(Clinic));
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

    it('lanza NotFoundException si el paciente no existe', async () => {
      patientRepo.findOne!.mockResolvedValue(null);

      await expect(service.remove('no-existe', 'clinic-1')).rejects.toThrow(NotFoundException);
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
