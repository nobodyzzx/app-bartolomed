import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BillingService } from './billing.service';
import { Invoice, InvoiceItem, InvoiceStatus, Payment, PaymentStatus } from './entities/billing.entity';
import { Patient } from 'src/patients/entities/patient.entity';
import { Clinic } from 'src/clinics/entities/clinic.entity';
import { Appointment } from 'src/appointments/entities/appointment.entity';
import { User } from 'src/users/entities/user.entity';
import { createMockRepository, MockRepository } from 'src/test/helpers/mock-repository.factory';
import { makeClinic, makePatient, makeUser } from 'src/test/helpers/test-data.factory';

const makeInvoice = (overrides: Record<string, any> = {}) => ({
  id: 'inv-1',
  invoiceNumber: 'FAC-001',
  status: InvoiceStatus.DRAFT,
  subtotal: 200,
  totalAmount: 226,
  paidAmount: 0,
  remainingAmount: 226,
  items: [],
  patient: makePatient(),
  clinic: makeClinic(),
  ...overrides,
});

/**
 * Factory para un mock de invoiceRepository que incluye manager.transaction.
 * `manager.transaction` ejecuta el callback inmediatamente con un manager interno
 * cuyos getRepository() devuelven los repos proporcionados.
 */
const createInvoiceRepoMock = (
  innerRepos: { invoice?: any; item?: any } = {},
) => {
  const base = createMockRepository<Invoice>();
  (base as any).manager = {
    transaction: jest.fn().mockImplementation(async (fn: (m: any) => any) =>
      fn({
        getRepository: jest.fn().mockImplementation((entity: any) => {
          if (entity === Invoice) return innerRepos.invoice ?? createMockRepository();
          if (entity === InvoiceItem) return innerRepos.item ?? createMockRepository();
          return createMockRepository();
        }),
      }),
    ),
  };
  return base;
};

describe('BillingService', () => {
  let service: BillingService;
  let invoiceRepo: MockRepository<Invoice> & { manager: any };
  let paymentRepo: MockRepository<Payment>;
  let patientRepo: MockRepository<Patient>;
  let clinicRepo: MockRepository<Clinic>;

  // Repos internos al manager (usados dentro de create())
  let managerInvoiceRepo: MockRepository<Invoice>;
  let managerItemRepo: MockRepository<InvoiceItem>;

  beforeEach(async () => {
    managerInvoiceRepo = createMockRepository<Invoice>();
    managerItemRepo = createMockRepository<InvoiceItem>();

    const invoiceMock = createInvoiceRepoMock({
      invoice: managerInvoiceRepo,
      item: managerItemRepo,
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingService,
        { provide: getRepositoryToken(Invoice), useValue: invoiceMock },
        { provide: getRepositoryToken(InvoiceItem), useValue: createMockRepository() },
        { provide: getRepositoryToken(Payment), useValue: createMockRepository() },
        { provide: getRepositoryToken(Patient), useValue: createMockRepository() },
        { provide: getRepositoryToken(Clinic), useValue: createMockRepository() },
        { provide: getRepositoryToken(Appointment), useValue: createMockRepository() },
        { provide: getRepositoryToken(User), useValue: createMockRepository() },
      ],
    }).compile();

    service = module.get<BillingService>(BillingService);
    invoiceRepo = module.get(getRepositoryToken(Invoice));
    paymentRepo = module.get(getRepositoryToken(Payment));
    patientRepo = module.get(getRepositoryToken(Patient));
    clinicRepo = module.get(getRepositoryToken(Clinic));
  });

  afterEach(() => jest.clearAllMocks());

  // ─── create ───────────────────────────────────────────────────────────────

  describe('create', () => {
    const baseDto = () => ({
      invoiceNumber: 'FAC-001',
      patientId: 'patient-1',
      clinicId: 'clinic-1',
      issueDate: '2026-04-01',
      dueDate: '2026-04-30',
      items: [{ description: 'Consulta', quantity: 1, unitPrice: 200 }],
    });

    it('rechaza si clinicId falta', async () => {
      await expect(service.create(baseDto() as any, makeUser() as any, undefined)).rejects.toThrow(BadRequestException);
    });

    it('rechaza si clinicId del DTO no coincide con contexto', async () => {
      await expect(
        service.create({ ...baseDto(), clinicId: 'otra-clinica' } as any, makeUser() as any, 'clinic-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza si el paciente no existe', async () => {
      patientRepo.findOne!.mockResolvedValue(null);

      await expect(service.create(baseDto() as any, makeUser() as any, 'clinic-1')).rejects.toThrow(NotFoundException);
    });

    it('rechaza si la clínica no existe', async () => {
      patientRepo.findOne!.mockResolvedValue(makePatient());
      clinicRepo.findOne!.mockResolvedValue(null);

      await expect(service.create(baseDto() as any, makeUser() as any, 'clinic-1')).rejects.toThrow(NotFoundException);
    });

    it('calcula subtotal correctamente: 2×100 + 3×50 = 350', async () => {
      const dto = {
        ...baseDto(),
        items: [
          { description: 'Consulta', quantity: 2, unitPrice: 100 },
          { description: 'Medicamento', quantity: 3, unitPrice: 50 },
        ],
      };
      const saved = makeInvoice({ id: 'inv-new' });
      patientRepo.findOne!.mockResolvedValue(makePatient());
      clinicRepo.findOne!.mockResolvedValue(makeClinic());
      managerInvoiceRepo.create!.mockReturnValue(saved);
      managerInvoiceRepo.save!.mockResolvedValue(saved);
      managerInvoiceRepo.findOne!.mockResolvedValue(saved);
      managerItemRepo.save!.mockResolvedValue([]);

      await service.create(dto as any, makeUser() as any, 'clinic-1');

      expect(managerInvoiceRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ subtotal: 350 }),
      );
    });
  });

  // ─── findAll / findOne ────────────────────────────────────────────────────

  describe('findAll', () => {
    it('lanza BadRequestException si clinicId no se provee', async () => {
      await expect(service.findAll(undefined as any)).rejects.toThrow(BadRequestException);
    });
  });

  describe('findOne', () => {
    it('lanza NotFoundException si la factura no existe', async () => {
      invoiceRepo.findOne!.mockResolvedValue(null);
      await expect(service.findOne('no-existe', 'clinic-1')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── Transición de estados ────────────────────────────────────────────────

  describe('setStatus', () => {
    const setupInvoice = (status: InvoiceStatus) => {
      const inv = makeInvoice({ status });
      invoiceRepo.findOne!.mockResolvedValue(inv);
      invoiceRepo.save!.mockImplementation(async (v) => v);
      return inv;
    };

    it('permite DRAFT → PENDING', async () => {
      setupInvoice(InvoiceStatus.DRAFT);
      await expect(service.setStatus('inv-1', InvoiceStatus.PENDING, 'clinic-1')).resolves.toBeDefined();
    });

    it('rechaza DRAFT → PAID (transición inválida)', async () => {
      setupInvoice(InvoiceStatus.DRAFT);
      await expect(service.setStatus('inv-1', InvoiceStatus.PAID, 'clinic-1')).rejects.toThrow(BadRequestException);
    });

    it('rechaza CANCELLED → cualquier estado', async () => {
      setupInvoice(InvoiceStatus.CANCELLED);
      await expect(service.setStatus('inv-1', InvoiceStatus.PENDING, 'clinic-1')).rejects.toThrow(BadRequestException);
    });

    it('rechaza REFUNDED → cualquier estado', async () => {
      setupInvoice(InvoiceStatus.REFUNDED);
      await expect(service.setStatus('inv-1', InvoiceStatus.PAID, 'clinic-1')).rejects.toThrow(BadRequestException);
    });

    it('permite PAID → REFUNDED', async () => {
      setupInvoice(InvoiceStatus.PAID);
      await expect(service.setStatus('inv-1', InvoiceStatus.REFUNDED, 'clinic-1')).resolves.toBeDefined();
    });
  });

  // ─── addPayment ───────────────────────────────────────────────────────────

  describe('addPayment', () => {
    it('rechaza pago que excede el monto pendiente', async () => {
      // remainingAmount = 100 - 80 = 20; pago solicitado = 50 → excede
      const inv = makeInvoice({ totalAmount: 100, paidAmount: 80, remainingAmount: 20, status: InvoiceStatus.PENDING });
      invoiceRepo.findOne!.mockResolvedValue(inv);

      await expect(
        service.addPayment({ invoiceId: 'inv-1', amount: 50 } as any, makeUser() as any, 'clinic-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza pago en factura cancelada', async () => {
      const inv = makeInvoice({ status: InvoiceStatus.CANCELLED, totalAmount: 100, paidAmount: 0, remainingAmount: 100 });
      invoiceRepo.findOne!.mockResolvedValue(inv);

      await expect(
        service.addPayment({ invoiceId: 'inv-1', amount: 50 } as any, makeUser() as any, 'clinic-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
