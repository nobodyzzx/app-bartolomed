import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { LabOrdersService } from './lab-orders.service';
import { LabOrder, LabOrderItem, LabOrderStatus, LabTestCategory } from './entities/lab-order.entity';
import { ChargesService } from '../charges/charges.service';
import { ServicePricesService } from '../service-prices/service-prices.service';
import { MedicalRecord } from 'src/medical-records/entities/medical-record.entity';
import { Patient } from 'src/patients/entities/patient.entity';
import { User } from 'src/users/entities/user.entity';
import { Clinic } from 'src/clinics/entities/clinic.entity';
import { createMockRepository, MockRepository } from 'src/test/helpers/mock-repository.factory';
import { makeClinic, makePatient, makeUser } from 'src/test/helpers/test-data.factory';

const makeLabOrder = (overrides: Record<string, any> = {}) => ({
  id: 'order-1',
  orderNumber: 'LAB-TEST-001',
  status: LabOrderStatus.REQUESTED,
  orderDate: new Date(),
  isUrgent: false,
  items: [{ id: 'item-1', testName: 'Hemograma completo', category: LabTestCategory.BLOOD }],
  patient: makePatient(),
  doctor: makeUser(),
  clinic: makeClinic(),
  ...overrides,
});

describe('LabOrdersService', () => {
  let service: LabOrdersService;
  let orderRepo: MockRepository<LabOrder>;
  let itemRepo: MockRepository<LabOrderItem>;
  let patientRepo: MockRepository<Patient>;
  let userRepo: MockRepository<User>;
  let clinicRepo: MockRepository<Clinic>;
  let medicalRecordRepo: MockRepository<MedicalRecord>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LabOrdersService,
        { provide: getRepositoryToken(LabOrder), useValue: createMockRepository() },
        { provide: getRepositoryToken(LabOrderItem), useValue: createMockRepository() },
        { provide: getRepositoryToken(Patient), useValue: createMockRepository() },
        { provide: getRepositoryToken(User), useValue: createMockRepository() },
        { provide: getRepositoryToken(Clinic), useValue: createMockRepository() },
        { provide: getRepositoryToken(MedicalRecord), useValue: createMockRepository() },
        // Fase 2 de facturación: crear una orden resuelve precios del
        // tarifario y genera cargos.
        {
          provide: ServicePricesService,
          useValue: { findOne: jest.fn(), findLaboratoryPriceByName: jest.fn().mockResolvedValue(null) },
        },
        { provide: ChargesService, useValue: { create: jest.fn() } },
      ],
    }).compile();

    service = module.get<LabOrdersService>(LabOrdersService);
    orderRepo = module.get(getRepositoryToken(LabOrder));
    itemRepo = module.get(getRepositoryToken(LabOrderItem));
    patientRepo = module.get(getRepositoryToken(Patient));
    userRepo = module.get(getRepositoryToken(User));
    clinicRepo = module.get(getRepositoryToken(Clinic));
    medicalRecordRepo = module.get(getRepositoryToken(MedicalRecord));
  });

  afterEach(() => jest.clearAllMocks());

  // ─── create ───────────────────────────────────────────────────────────────

  describe('create', () => {
    const baseDto = () => ({
      orderNumber: 'LAB-TEST',
      patientId: 'patient-1',
      doctorId: 'user-1',
      clinicId: 'clinic-1',
      orderDate: '2026-04-01',
      items: [{ testName: 'Hemograma completo', category: LabTestCategory.BLOOD }],
    });

    it('lanza BadRequestException si no se provee clinicId', async () => {
      await expect(service.create(baseDto() as any)).rejects.toThrow(BadRequestException);
    });

    it('rechaza clinicId del DTO diferente al contexto scoped', async () => {
      patientRepo.findOne!.mockResolvedValue(makePatient());
      userRepo.findOne!.mockResolvedValue(makeUser());

      await expect(
        service.create({ ...baseDto(), clinicId: 'otra' } as any, undefined, 'clinic-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza si paciente no existe', async () => {
      patientRepo.findOne!.mockResolvedValue(null);

      await expect(service.create(baseDto() as any, undefined, 'clinic-1')).rejects.toThrow(NotFoundException);
    });

    it('rechaza si médico no existe', async () => {
      patientRepo.findOne!.mockResolvedValue(makePatient());
      userRepo.findOne!.mockResolvedValue(null);

      await expect(service.create(baseDto() as any, undefined, 'clinic-1')).rejects.toThrow(NotFoundException);
    });

    it('crea la orden con status REQUESTED por defecto', async () => {
      patientRepo.findOne!.mockResolvedValue(makePatient());
      userRepo.findOne!.mockResolvedValue(makeUser());
      clinicRepo.findOne!.mockResolvedValue(makeClinic());
      orderRepo.create!.mockImplementation((v: any) => v);
      orderRepo.save!.mockImplementation(async (v: any) => v);

      const result = await service.create(baseDto() as any, undefined, 'clinic-1');
      expect(result.status).toBe(LabOrderStatus.REQUESTED);
      expect(medicalRecordRepo.findOne).not.toHaveBeenCalled();
    });

    /**
     * Regresión: bug real corregido en la auditoría de interrelación de
     * módulos (2026-08-04). medicalRecordId se enlazaba sin validar que
     * exista, ni que pertenezca al mismo paciente/clínica de la orden —
     * a diferencia de patient/doctor/clinic, que sí se validaban.
     */
    it('rechaza si medicalRecordId no existe o no pertenece al paciente/clínica', async () => {
      patientRepo.findOne!.mockResolvedValue(makePatient());
      userRepo.findOne!.mockResolvedValue(makeUser());
      clinicRepo.findOne!.mockResolvedValue(makeClinic());
      medicalRecordRepo.findOne!.mockResolvedValue(null);

      await expect(
        service.create({ ...baseDto(), medicalRecordId: 'record-de-otro-paciente' } as any, undefined, 'clinic-1'),
      ).rejects.toThrow(NotFoundException);
      expect(orderRepo.save).not.toHaveBeenCalled();
    });

    it('acepta medicalRecordId cuando pertenece al mismo paciente y clínica', async () => {
      patientRepo.findOne!.mockResolvedValue(makePatient());
      userRepo.findOne!.mockResolvedValue(makeUser());
      clinicRepo.findOne!.mockResolvedValue(makeClinic());
      medicalRecordRepo.findOne!.mockResolvedValue({ id: 'record-1' });
      orderRepo.create!.mockImplementation((v: any) => v);
      orderRepo.save!.mockImplementation(async (v: any) => v);

      const result = await service.create(
        { ...baseDto(), medicalRecordId: 'record-1' } as any,
        undefined,
        'clinic-1',
      );

      expect(medicalRecordRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: 'record-1',
            patient: { id: 'patient-1' },
            clinic: { id: 'clinic-1' },
          }),
        }),
      );
      expect(result.medicalRecord).toEqual({ id: 'record-1' });
    });
  });

  // ─── findAll ──────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('lanza BadRequestException si clinicId no se provee', async () => {
      await expect(service.findAll(undefined as any)).rejects.toThrow(BadRequestException);
    });
  });

  // ─── update ───────────────────────────────────────────────────────────────

  describe('update', () => {
    it('rechaza cambiar el status desde update() — exige el endpoint dedicado', async () => {
      const order = makeLabOrder();
      orderRepo.findOne!.mockResolvedValue(order);

      await expect(
        service.update('order-1', { status: LabOrderStatus.CANCELLED } as any, 'clinic-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza editar una orden completada', async () => {
      const order = makeLabOrder({ status: LabOrderStatus.COMPLETED });
      orderRepo.findOne!.mockResolvedValue(order);

      await expect(service.update('order-1', { clinicalNotes: 'x' } as any, 'clinic-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ─── setStatus (transiciones) ─────────────────────────────────────────────

  describe('setStatus', () => {
    it('permite REQUESTED -> SAMPLE_COLLECTED', async () => {
      const order = makeLabOrder({ status: LabOrderStatus.REQUESTED });
      orderRepo.findOne!.mockResolvedValue(order);
      orderRepo.save!.mockImplementation(async (v: any) => v);

      const result = await service.setStatus('order-1', LabOrderStatus.SAMPLE_COLLECTED, 'clinic-1');
      expect(result.status).toBe(LabOrderStatus.SAMPLE_COLLECTED);
    });

    it('rechaza una transición inválida (REQUESTED -> COMPLETED, saltando pasos)', async () => {
      const order = makeLabOrder({ status: LabOrderStatus.REQUESTED });
      orderRepo.findOne!.mockResolvedValue(order);

      await expect(service.setStatus('order-1', LabOrderStatus.COMPLETED, 'clinic-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rechaza cualquier transición desde CANCELLED (estado terminal)', async () => {
      const order = makeLabOrder({ status: LabOrderStatus.CANCELLED });
      orderRepo.findOne!.mockResolvedValue(order);

      await expect(service.setStatus('order-1', LabOrderStatus.IN_PROGRESS, 'clinic-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ─── enterResult ──────────────────────────────────────────────────────────

  describe('enterResult', () => {
    it('rechaza cargar resultado en una orden cancelada', async () => {
      const order = makeLabOrder({ status: LabOrderStatus.CANCELLED });
      orderRepo.findOne!.mockResolvedValue(order);

      await expect(
        service.enterResult('order-1', 'item-1', { resultValue: '14 g/dL' }, makeUser() as any, 'clinic-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza si el ítem no pertenece a la orden', async () => {
      const order = makeLabOrder({ status: LabOrderStatus.SAMPLE_COLLECTED });
      orderRepo.findOne!.mockResolvedValue(order);

      await expect(
        service.enterResult('order-1', 'item-inexistente', { resultValue: '14 g/dL' }, makeUser() as any, 'clinic-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('carga el resultado y marca resultedAt/enteredBy', async () => {
      const order = makeLabOrder({ status: LabOrderStatus.SAMPLE_COLLECTED });
      orderRepo.findOne!.mockResolvedValue(order);
      itemRepo.save!.mockImplementation(async (v: any) => v);
      orderRepo.save!.mockImplementation(async (v: any) => v);
      const actor = makeUser({ id: 'tech-1' });

      await service.enterResult('order-1', 'item-1', { resultValue: '14 g/dL' }, actor as any, 'clinic-1');

      const savedItem = (itemRepo.save as jest.Mock).mock.calls[0][0];
      expect(savedItem.resultValue).toBe('14 g/dL');
      expect(savedItem.resultedAt).toBeInstanceOf(Date);
      expect(savedItem.enteredBy).toEqual(actor);
    });

    it('completa automáticamente la orden cuando todos los ítems tienen resultado', async () => {
      const order = makeLabOrder({ status: LabOrderStatus.SAMPLE_COLLECTED });
      // Segunda llamada a findOne (refreshed) ya con el ítem resuelto
      orderRepo.findOne!
        .mockResolvedValueOnce(order)
        .mockResolvedValueOnce({ ...order, items: [{ ...order.items[0], resultedAt: new Date() }] })
        .mockResolvedValueOnce({ ...order, status: LabOrderStatus.COMPLETED, items: [{ ...order.items[0], resultedAt: new Date() }] });
      itemRepo.save!.mockImplementation(async (v: any) => v);
      orderRepo.save!.mockImplementation(async (v: any) => v);

      await service.enterResult('order-1', 'item-1', { resultValue: '14 g/dL' }, makeUser() as any, 'clinic-1');

      expect(orderRepo.save).toHaveBeenCalledWith(expect.objectContaining({ status: LabOrderStatus.COMPLETED }));
    });
  });

  // ─── remove ───────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('rechaza eliminar una orden completada', async () => {
      const order = makeLabOrder({ status: LabOrderStatus.COMPLETED });
      orderRepo.findOne!.mockResolvedValue(order);

      await expect(service.remove('order-1', 'clinic-1')).rejects.toThrow(BadRequestException);
    });

    it('permite eliminar (soft-delete) una orden no completada', async () => {
      const order = makeLabOrder({ status: LabOrderStatus.REQUESTED });
      orderRepo.findOne!.mockResolvedValue(order);
      (orderRepo as any).softDelete = jest.fn().mockResolvedValue({ affected: 1 });

      await expect(service.remove('order-1', 'clinic-1')).resolves.toBeUndefined();
      expect((orderRepo as any).softDelete).toHaveBeenCalledWith('order-1');
    });
  });
});
