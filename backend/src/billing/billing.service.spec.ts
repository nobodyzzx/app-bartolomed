import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BillingService } from './billing.service';
import { Invoice, InvoiceItem, InvoiceStatus, Payment } from './entities/billing.entity';
import { Charge } from 'src/charges/entities/charge.entity';
import { Patient } from 'src/patients/entities/patient.entity';
import { Clinic } from 'src/clinics/entities/clinic.entity';
import { Appointment, AppointmentStatus } from 'src/appointments/entities/appointment.entity';
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
const createInvoiceRepoMock = (innerRepos: { invoice?: any; item?: any } = {}) => {
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
  let patientRepo: MockRepository<Patient>;
  let clinicRepo: MockRepository<Clinic>;
  let appointmentRepo: MockRepository<Appointment>;
  let chargeRepo: MockRepository<Charge>;

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
        { provide: getRepositoryToken(Charge), useValue: createMockRepository() },
      ],
    }).compile();

    service = module.get<BillingService>(BillingService);
    invoiceRepo = module.get(getRepositoryToken(Invoice));
    patientRepo = module.get(getRepositoryToken(Patient));
    clinicRepo = module.get(getRepositoryToken(Clinic));
    appointmentRepo = module.get(getRepositoryToken(Appointment));
    chargeRepo = module.get(getRepositoryToken(Charge));
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

    /**
     * Regresión: bug real corregido en la auditoría de interrelación de
     * módulos (2026-08-04). patients/billing no filtraban isActive:true al
     * buscar la clínica (prescriptions/lab-orders sí lo hacían) — y como
     * ClinicScopeGuard deja pasar a SUPER_ADMIN sin chequear isActive, era
     * una puerta abierta para facturar en una clínica desactivada.
     */
    it('rechaza si la clínica existe pero está desactivada', async () => {
      patientRepo.findOne!.mockResolvedValue(makePatient());
      clinicRepo.findOne!.mockResolvedValue(null); // el filtro isActive:true no la encuentra

      await expect(service.create(baseDto() as any, makeUser() as any, 'clinic-1')).rejects.toThrow(NotFoundException);
      expect(clinicRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ isActive: true }) }),
      );
    });

    /**
     * Regresión: bug real corregido en la auditoría de interrelación de
     * módulos (2026-08-04). No se validaba el status de la cita — se podía
     * crear y cobrar una factura vinculada a una cita ya CANCELLED.
     */
    it('rechaza facturar una cita CANCELLED', async () => {
      patientRepo.findOne!.mockResolvedValue(makePatient());
      clinicRepo.findOne!.mockResolvedValue(makeClinic());
      appointmentRepo.findOne!.mockResolvedValue({ id: 'appt-1', status: AppointmentStatus.CANCELLED });

      await expect(
        service.create({ ...baseDto(), appointmentId: 'appt-1' } as any, makeUser() as any, 'clinic-1'),
      ).rejects.toThrow(BadRequestException);
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

      expect(managerInvoiceRepo.create).toHaveBeenCalledWith(expect.objectContaining({ subtotal: 350 }));
    });
  });

  // ─── findAll / findOne ────────────────────────────────────────────────────

  describe('findAll', () => {
    it('lanza BadRequestException si clinicId no se provee', async () => {
      await expect(service.findAll(undefined as any)).rejects.toThrow(BadRequestException);
    });

    /**
     * El motivo del descuento vive en Charge, no en Invoice — se pierde en
     * el checkout salvo que se lo vuelva a buscar acá. Nunca sale en el
     * recibo del paciente; es solo para que el staff lo vea en la lista.
     */
    it('adjunta el motivo del descuento buscándolo en los cargos de cada factura', async () => {
      const invoices = [makeInvoice({ id: 'inv-1' }), makeInvoice({ id: 'inv-2' })];
      invoiceRepo.createQueryBuilder!.mockReturnValue({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([invoices, invoices.length]),
      } as any);
      chargeRepo.createQueryBuilder!.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          { invoiceId: 'inv-1', discountReason: 'cliente frecuente' },
        ]),
      } as any);

      const result = await service.findAll(1, 20, {}, 'clinic-1');

      expect((result.items[0] as any).discountReasons).toBe('cliente frecuente');
      expect((result.items[1] as any).discountReasons).toBeNull();
    });
  });

  describe('findOne', () => {
    it('lanza NotFoundException si la factura no existe', async () => {
      invoiceRepo.findOne!.mockResolvedValue(null);
      await expect(service.findOne('no-existe', 'clinic-1')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── update ───────────────────────────────────────────────────────────────

  describe('update', () => {
    it('resuelve el appointment usando invoice.patient.id cuando solo viene appointmentId (sin patientId)', async () => {
      const patient = makePatient({ id: 'patient-1' });
      const invoice = makeInvoice({ status: InvoiceStatus.DRAFT, patient });
      // se llama dos veces: carga inicial dentro de la transacción + recarga final con relaciones
      managerInvoiceRepo.findOne!.mockResolvedValue(invoice);
      managerInvoiceRepo.save!.mockResolvedValue(invoice);
      appointmentRepo.findOne!.mockResolvedValue({ id: 'appt-1' });

      await service.update('inv-1', { appointmentId: 'appt-1' } as any, 'clinic-1');

      expect(appointmentRepo.findOne).toHaveBeenCalledWith({
        where: {
          id: 'appt-1',
          clinic: { id: 'clinic-1' },
          patient: { id: 'patient-1' },
        },
      });
    });

    it('lanza NotFoundException si el appointment no existe o no es del paciente de la factura', async () => {
      const invoice = makeInvoice({ status: InvoiceStatus.DRAFT });
      managerInvoiceRepo.findOne!.mockResolvedValueOnce(invoice);
      appointmentRepo.findOne!.mockResolvedValue(null);

      await expect(service.update('inv-1', { appointmentId: 'appt-inexistente' } as any, 'clinic-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rechaza vincular una cita CANCELLED al actualizar la factura', async () => {
      const invoice = makeInvoice({ status: InvoiceStatus.DRAFT });
      managerInvoiceRepo.findOne!.mockResolvedValueOnce(invoice);
      appointmentRepo.findOne!.mockResolvedValue({ id: 'appt-1', status: AppointmentStatus.CANCELLED });

      await expect(service.update('inv-1', { appointmentId: 'appt-1' } as any, 'clinic-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ─── Transición de estados ────────────────────────────────────────────────

  describe('setStatus', () => {
    const setupInvoice = (status: InvoiceStatus) => {
      const inv = makeInvoice({ status });
      invoiceRepo.findOne!.mockResolvedValue(inv);
      invoiceRepo.save!.mockImplementation(async v => v);
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

    // Anular por acá dejaba la factura en `cancelled` con su saldo intacto y los
    // cargos atrapados en ella: nunca volvían a `pending`, así que no había forma
    // de volver a cobrarlos, y no quedaba ni motivo ni registro de auditoría.
    it('rechaza pasar a CANCELLED: anular es sólo por el endpoint /void', async () => {
      const inv = setupInvoice(InvoiceStatus.PENDING);
      await expect(service.setStatus('inv-1', InvoiceStatus.CANCELLED, 'clinic-1')).rejects.toThrow(
        BadRequestException,
      );
      expect(invoiceRepo.save).not.toHaveBeenCalled();
      expect(inv.status).toBe(InvoiceStatus.PENDING);
    });
  });

  // ─── getStatistics ────────────────────────────────────────────────────────

  describe('getStatistics', () => {
    // El dashboard de recepción mostraba "0 facturas pendientes" junto a
    // "Por cobrar Bs 177,12", y ese monto salía entero de dos facturas anuladas:
    // `pendingRevenue` sumaba `remainingAmount` de TODAS, canceladas incluidas.
    it('excluye anuladas y devueltas del monto por cobrar', async () => {
      const invoices = [
        makeInvoice({ status: InvoiceStatus.PAID, paidAmount: 35, remainingAmount: 0 }),
        makeInvoice({ status: InvoiceStatus.PENDING, paidAmount: 0, remainingAmount: 40 }),
        makeInvoice({ status: InvoiceStatus.CANCELLED, paidAmount: 0, remainingAmount: 150 }),
        makeInvoice({ status: InvoiceStatus.REFUNDED, paidAmount: 0, remainingAmount: 27.12 }),
      ];
      invoiceRepo.createQueryBuilder!.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([invoices, invoices.length]),
      } as any);

      const stats = await service.getStatistics('clinic-1');

      expect(stats.pendingRevenue).toBe(40);
      expect(stats.pending).toBe(1);
      expect(stats.totalInvoices).toBe(4);
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
      const inv = makeInvoice({
        status: InvoiceStatus.CANCELLED,
        totalAmount: 100,
        paidAmount: 0,
        remainingAmount: 100,
      });
      invoiceRepo.findOne!.mockResolvedValue(inv);

      await expect(
        service.addPayment({ invoiceId: 'inv-1', amount: 50 } as any, makeUser() as any, 'clinic-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
