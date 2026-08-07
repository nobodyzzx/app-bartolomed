import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrescriptionsService } from './prescriptions.service';
import { Prescription, PrescriptionStatus } from './entities/prescription.entity';
import { PrescriptionItem } from './entities/prescription.entity';
import { Patient } from 'src/patients/entities/patient.entity';
import { User } from 'src/users/entities/user.entity';
import { Clinic } from 'src/clinics/entities/clinic.entity';
import { createMockRepository, MockRepository } from 'src/test/helpers/mock-repository.factory';
import { makeClinic, makePatient, makeUser } from 'src/test/helpers/test-data.factory';
import { ValidRoles } from 'src/users/interfaces';

const makePrescription = (overrides: Record<string, any> = {}) => ({
  id: 'rx-1',
  prescriptionNumber: 'RX-TEST-001',
  status: PrescriptionStatus.DRAFT,
  // Fechas relativas al "ahora" para que los tests no caduquen con el tiempo
  prescriptionDate: new Date(Date.now() - 86_400_000),
  expiryDate: new Date(Date.now() + 30 * 86_400_000),
  items: [{ id: 'item-1', medicationName: 'Paracetamol', duration: 5 }],
  patient: makePatient(),
  doctor: makeUser({ roles: [ValidRoles.DOCTOR] }),
  clinic: makeClinic(),
  refillsAllowed: 0,
  refillsUsed: 0,
  ...overrides,
});

describe('PrescriptionsService', () => {
  let service: PrescriptionsService;
  let rxRepo: MockRepository<Prescription>;
  let patientRepo: MockRepository<Patient>;
  let userRepo: MockRepository<User>;
  let clinicRepo: MockRepository<Clinic>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrescriptionsService,
        { provide: getRepositoryToken(Prescription), useValue: createMockRepository() },
        { provide: getRepositoryToken(PrescriptionItem), useValue: createMockRepository() },
        { provide: getRepositoryToken(Patient), useValue: createMockRepository() },
        { provide: getRepositoryToken(User), useValue: createMockRepository() },
        { provide: getRepositoryToken(Clinic), useValue: createMockRepository() },
      ],
    }).compile();

    service = module.get<PrescriptionsService>(PrescriptionsService);
    rxRepo = module.get(getRepositoryToken(Prescription));
    patientRepo = module.get(getRepositoryToken(Patient));
    userRepo = module.get(getRepositoryToken(User));
    clinicRepo = module.get(getRepositoryToken(Clinic));
  });

  afterEach(() => jest.clearAllMocks());

  // ─── create ───────────────────────────────────────────────────────────────

  describe('create', () => {
    const baseDto = () => ({
      prescriptionNumber: 'RX-TEST',
      patientId: 'patient-1',
      doctorId: 'user-1',
      clinicId: 'clinic-1',
      prescriptionDate: '2026-04-01',
      expiryDate: '2026-04-30',
      items: [{ medicationName: 'Amoxicilina', strength: '500mg', dosageForm: 'tableta', quantity: '10', dosage: '1', frequency: 'cada 8h' }],
    });

    it('rechaza si fecha de expiración es anterior a la de prescripción', async () => {
      patientRepo.findOne!.mockResolvedValue(makePatient());
      userRepo.findOne!.mockResolvedValue(makeUser());
      clinicRepo.findOne!.mockResolvedValue(makeClinic());

      const dto = { ...baseDto(), prescriptionDate: '2026-04-30', expiryDate: '2026-04-01' };
      await expect(service.create(dto as any)).rejects.toThrow(BadRequestException);
    });

    it('rechaza si la duración del ítem excede el rango de fechas', async () => {
      patientRepo.findOne!.mockResolvedValue(makePatient());
      userRepo.findOne!.mockResolvedValue(makeUser());
      clinicRepo.findOne!.mockResolvedValue(makeClinic());

      // Rango = 29 días, duración del ítem = 60 → inválido
      const dto = {
        ...baseDto(),
        items: [{ ...baseDto().items[0], duration: 60 }],
      };
      await expect(service.create(dto as any)).rejects.toThrow(BadRequestException);
    });

    it('rechaza si paciente no existe', async () => {
      patientRepo.findOne!.mockResolvedValue(null);

      await expect(service.create(baseDto() as any, undefined, 'clinic-1')).rejects.toThrow(NotFoundException);
    });

    it('rechaza clinicId del DTO diferente al contexto scoped', async () => {
      patientRepo.findOne!.mockResolvedValue(makePatient());
      userRepo.findOne!.mockResolvedValue(makeUser());

      await expect(
        service.create({ ...baseDto(), clinicId: 'otra' } as any, undefined, 'clinic-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── findAll ──────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('lanza BadRequestException si clinicId no se provee', async () => {
      await expect(service.findAll(undefined as any)).rejects.toThrow(BadRequestException);
    });
  });

  // ─── sign (activar receta) ────────────────────────────────────────────────

  describe('sign', () => {
    it('lanza BadRequestException si actor no es doctor ni admin', async () => {
      const rx = makePrescription({ status: PrescriptionStatus.DRAFT });
      rxRepo.findOne!.mockResolvedValue(rx);
      // La enfermera debe tener un id DISTINTO al del médico prescriptor (user-1)
      const nurse = makeUser({ id: 'nurse-99', roles: [ValidRoles.NURSE] });

      await expect(service.sign('rx-1', 'clinic-1', nurse as any)).rejects.toThrow(BadRequestException);
    });

    it('permite firmar a un doctor', async () => {
      const rx = makePrescription({ status: PrescriptionStatus.DRAFT });
      rxRepo.findOne!.mockResolvedValue(rx);
      rxRepo.save!.mockImplementation(async (v) => v);
      const doctor = makeUser({ roles: [ValidRoles.DOCTOR] });

      await expect(service.sign('rx-1', 'clinic-1', doctor as any)).resolves.toBeDefined();
    });

    it('rechaza firmar receta sin ítems', async () => {
      const rx = makePrescription({ status: PrescriptionStatus.DRAFT, items: [] });
      rxRepo.findOne!.mockResolvedValue(rx);
      const doctor = makeUser({ roles: [ValidRoles.DOCTOR] });

      await expect(service.sign('rx-1', 'clinic-1', doctor as any)).rejects.toThrow(BadRequestException);
    });

    /**
     * Regresión: bug real corregido en la auditoría de interrelación de
     * módulos (2026-08-04). canAdminSign comparaba contra el string crudo
     * 'super_admin' (guion bajo) en vez de ValidRoles.SUPER_ADMIN
     * ('super-admin', con guion) — un SUPER_ADMIN sin el rol 'admin'
     * explícito en su array nunca podía firmar la receta de otro médico.
     */
    it('permite firmar a un SUPER_ADMIN sin el rol admin explícito', async () => {
      const rx = makePrescription({ status: PrescriptionStatus.DRAFT });
      rxRepo.findOne!.mockResolvedValue(rx);
      rxRepo.save!.mockImplementation(async (v) => v);
      const superAdmin = makeUser({ id: 'super-99', roles: [ValidRoles.SUPER_ADMIN] });

      await expect(service.sign('rx-1', 'clinic-1', superAdmin as any)).resolves.toBeDefined();
    });
  });

  // ─── refill ───────────────────────────────────────────────────────────────

  describe('refill', () => {
    it('rechaza refill cuando no hay recambios disponibles', async () => {
      const rx = makePrescription({
        status: PrescriptionStatus.ACTIVE,
        refillsAllowed: 2,
        refillsUsed: 2, // ya usados todos
        expiryDate: new Date(Date.now() + 86_400_000),
      });
      rxRepo.findOne!.mockResolvedValue(rx);

      await expect(service.refill('rx-1', 'clinic-1')).rejects.toThrow(BadRequestException);
    });

    it('rechaza refill en receta expirada', async () => {
      const rx = makePrescription({
        status: PrescriptionStatus.ACTIVE,
        refillsAllowed: 3,
        refillsUsed: 0,
        expiryDate: new Date(Date.now() - 86_400_000), // ayer
      });
      rxRepo.findOne!.mockResolvedValue(rx);

      await expect(service.refill('rx-1', 'clinic-1')).rejects.toThrow(BadRequestException);
    });

    it('permite refill de una receta ACTIVE con recambios disponibles', async () => {
      const rx = makePrescription({
        status: PrescriptionStatus.ACTIVE,
        refillsAllowed: 3,
        refillsUsed: 0,
        expiryDate: new Date(Date.now() + 86_400_000),
      });
      rxRepo.findOne!.mockResolvedValue(rx);
      rxRepo.save!.mockImplementation(async (v) => v);

      const result = await service.refill('rx-1', 'clinic-1');
      expect(result.status).toBe(PrescriptionStatus.DISPENSED);
    });

    /**
     * Regresión: bug real corregido en la auditoría de interrelación de
     * módulos (2026-08-04). refill() no validaba el status actual antes de
     * forzar DISPENSED — podía reactivar una receta CANCELLED o DRAFT
     * saltándose la máquina de estados de validateStatusTransition().
     */
    it.each([PrescriptionStatus.CANCELLED, PrescriptionStatus.DRAFT, PrescriptionStatus.COMPLETED, PrescriptionStatus.EXPIRED])(
      'rechaza refill de una receta en estado %s',
      async status => {
        const rx = makePrescription({
          status,
          refillsAllowed: 3,
          refillsUsed: 0,
          expiryDate: new Date(Date.now() + 86_400_000),
        });
        rxRepo.findOne!.mockResolvedValue(rx);

        await expect(service.refill('rx-1', 'clinic-1')).rejects.toThrow(BadRequestException);
        expect(rxRepo.save).not.toHaveBeenCalled();
      },
    );
  });
});
