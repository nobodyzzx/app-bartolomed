import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrescriptionsService } from './prescriptions.service';
import { Prescription, PrescriptionStatus } from './entities/prescription.entity';
import { PrescriptionItem } from './entities/prescription.entity';
import { Patient } from 'src/patients/entities/patient.entity';
import { User } from 'src/users/entities/user.entity';
import { Clinic } from 'src/clinics/entities/clinic.entity';
import { createMockRepository, createMockQueryBuilder, MockRepository } from 'src/test/helpers/mock-repository.factory';
import { makeClinic, makePatient, makeUser } from 'src/test/helpers/test-data.factory';
import { ValidRoles } from 'src/users/interfaces';

const makePrescription = (overrides: Record<string, any> = {}) => ({
  id: 'rx-1',
  prescriptionNumber: 'RX-20260402-001',
  status: PrescriptionStatus.DRAFT,
  prescriptionDate: new Date('2026-04-01'),
  expiryDate: new Date('2026-04-30'),
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
  let itemRepo: MockRepository<PrescriptionItem>;
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
    itemRepo = module.get(getRepositoryToken(PrescriptionItem));
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
  });
});
