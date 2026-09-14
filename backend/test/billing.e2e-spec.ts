import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  Injectable,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as request from 'supertest';

import { Appointment } from '../src/appointments/entities/appointment.entity';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { ClinicScopeGuard } from '../src/auth/guards/clinic-scope.guard';
import { UserRoleGuard } from '../src/auth/guards/user-role.guard';
import { PermissionsGuard } from '../src/auth/permissions/permissions.guard';
import { BillingController } from '../src/billing/billing.controller';
import { BillingService } from '../src/billing/billing.service';
import { CheckoutService } from '../src/billing/services/checkout.service';
import { ReceiptPdfService } from '../src/billing/services/receipt-pdf.service';
import {
  Invoice,
  InvoiceItem,
  InvoiceStatus,
  Payment,
  PaymentMethod,
  PaymentStatus,
} from '../src/billing/entities/billing.entity';
import { Charge } from '../src/charges/entities/charge.entity';
import { Clinic } from '../src/clinics/entities/clinic.entity';
import { Patient } from '../src/patients/entities/patient.entity';
import { User } from '../src/users/entities/user.entity';
import { createMockRepository, MockRepository } from '../src/test/helpers/mock-repository.factory';

const TEST_USER_ID = 'user-1';
const TEST_USER_EMAIL = 'admin@test.com';
// UUIDs v4 válidos (versión "4" y variante "8") — class-validator/validator ahora
// exige el formato RFC 4122 estricto, placeholders como '1111-1111-1111' ya no pasan @IsUUID().
const TEST_CLINIC_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_CLINIC_ID = '22222222-2222-4222-8222-222222222222';
const TEST_PATIENT_ID = '33333333-3333-4333-8333-333333333333';
const TEST_INVOICE_ID = '44444444-4444-4444-8444-444444444444';
const TEST_PAYMENT_ID = '55555555-5555-4555-8555-555555555555';

@Injectable()
class MockAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    req.user = {
      id: TEST_USER_ID,
      sub: TEST_USER_ID,
      email: TEST_USER_EMAIL,
      roles: ['admin', 'receptionist'],
      clinicRoles: { [TEST_CLINIC_ID]: ['admin'] },
    };
    return true;
  }
}

@Injectable()
class AlwaysAllowGuard implements CanActivate {
  canActivate(): boolean {
    return true;
  }
}

describe('Billing (e2e — mocks)', () => {
  let app: INestApplication;
  let invoiceRepo: MockRepository<Invoice>;
  let invoiceItemRepo: MockRepository<InvoiceItem>;
  let paymentRepo: MockRepository<Payment>;
  let patientRepo: MockRepository<Patient>;
  let clinicRepo: MockRepository<Clinic>;

  beforeAll(async () => {
    invoiceRepo = createMockRepository<Invoice>();
    invoiceItemRepo = createMockRepository<InvoiceItem>();
    paymentRepo = createMockRepository<Payment>();
    patientRepo = createMockRepository<Patient>();
    clinicRepo = createMockRepository<Clinic>();
    const appointmentRepo = createMockRepository<Appointment>();
    const userRepo = createMockRepository<User>();
    // La facturación por cargos sumó este repositorio al servicio; sin él Nest
    // no puede construir BillingService y la suite entera no arranca.
    const chargeRepo = createMockRepository<Charge>();

    // Mock manager.transaction → ejecuta el callback con un manager que devuelve nuestros repos
    (invoiceRepo as any).manager = {
      transaction: jest.fn(async (cb: any) =>
        cb({
          getRepository: (entity: any) => {
            if (entity === Invoice) return invoiceRepo;
            if (entity === InvoiceItem) return invoiceItemRepo;
            return createMockRepository();
          },
        }),
      ),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [BillingController],
      providers: [
        BillingService,
        { provide: getRepositoryToken(Invoice), useValue: invoiceRepo },
        { provide: getRepositoryToken(InvoiceItem), useValue: invoiceItemRepo },
        { provide: getRepositoryToken(Payment), useValue: paymentRepo },
        { provide: getRepositoryToken(Patient), useValue: patientRepo },
        { provide: getRepositoryToken(Clinic), useValue: clinicRepo },
        { provide: getRepositoryToken(Appointment), useValue: appointmentRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(Charge), useValue: chargeRepo },
        // El controlador creció con el punto de cobro y el recibo en PDF. Esta
        // suite solo ejercita facturas y pagos, así que basta con que existan.
        { provide: CheckoutService, useValue: {} },
        { provide: ReceiptPdfService, useValue: {} },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useClass(MockAuthGuard)
      .overrideGuard(UserRoleGuard)
      .useClass(AlwaysAllowGuard)
      .overrideGuard(PermissionsGuard)
      .useClass(AlwaysAllowGuard)
      .overrideGuard(ClinicScopeGuard)
      .useClass(AlwaysAllowGuard)
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: false,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Re-instalar transaction después del clearAllMocks
    (invoiceRepo as any).manager = {
      transaction: jest.fn(async (cb: any) =>
        cb({
          getRepository: (entity: any) => {
            if (entity === Invoice) return invoiceRepo;
            if (entity === InvoiceItem) return invoiceItemRepo;
            return createMockRepository();
          },
        }),
      ),
    };
  });

  // ─── Helpers ───────────────────────────────────────────────────────────────

  const buildPaymentBody = (overrides: Record<string, any> = {}) => ({
    paymentNumber: 'PAY-2026-0001',
    invoiceId: TEST_INVOICE_ID,
    amount: 100,
    method: PaymentMethod.CASH,
    paymentDate: '2026-05-06',
    ...overrides,
  });

  // La creación directa de facturas (POST /billing/invoices) ya no existe: con
  // la facturación unificada se emite desde el punto de cobro, POST
  // /billing/checkout. Los cinco tests que la cubrían apuntaban a una ruta
  // retirada y devolvían 404 —uno de ellos esperaba justo un 404 y pasaba por
  // accidente—. El checkout se sirve de CheckoutService, que esta suite no
  // monta, así que su cobertura e2e es un trabajo aparte.

  // ─── POST /billing/payments — Pagos ────────────────────────────────────────

  describe('POST /api/billing/payments', () => {
    const buildInvoiceForPayment = (overrides: Record<string, any> = {}) => ({
      id: TEST_INVOICE_ID,
      status: InvoiceStatus.DRAFT,
      totalAmount: 300,
      paidAmount: 0,
      remainingAmount: 300,
      patient: { id: TEST_PATIENT_ID },
      clinic: { id: TEST_CLINIC_ID },
      ...overrides,
    });

    it('registra un pago COMPLETED y suma al paidAmount (201)', async () => {
      invoiceRepo.findOne!.mockResolvedValue(buildInvoiceForPayment());
      paymentRepo.create!.mockImplementation((entity: any) => entity);
      paymentRepo.save!.mockImplementation(async (entity: any) => ({
        id: TEST_PAYMENT_ID,
        ...entity,
      }));
      invoiceRepo.save!.mockImplementation(async (entity: any) => entity);

      const res = await request(app.getHttpServer())
        .post('/api/billing/payments')
        .set('X-Clinic-Id', TEST_CLINIC_ID)
        .send(buildPaymentBody({ amount: 100, status: PaymentStatus.COMPLETED }))
        .expect(201);

      expect(res.body).toMatchObject({ id: TEST_PAYMENT_ID, status: PaymentStatus.COMPLETED });
      expect(invoiceRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ paidAmount: 100 }),
      );
    });

    it('registra un pago PENDING sin tocar paidAmount', async () => {
      invoiceRepo.findOne!.mockResolvedValue(buildInvoiceForPayment());
      paymentRepo.create!.mockImplementation((entity: any) => entity);
      paymentRepo.save!.mockImplementation(async (entity: any) => ({
        id: TEST_PAYMENT_ID,
        ...entity,
      }));

      await request(app.getHttpServer())
        .post('/api/billing/payments')
        .set('X-Clinic-Id', TEST_CLINIC_ID)
        .send(buildPaymentBody({ amount: 50, status: PaymentStatus.PENDING }))
        .expect(201);

      expect(invoiceRepo.save).not.toHaveBeenCalled();
    });

    it('rechaza un pago superior al remainingAmount (sobrepago, 400)', async () => {
      invoiceRepo.findOne!.mockResolvedValue(
        buildInvoiceForPayment({ paidAmount: 250, remainingAmount: 50 }),
      );

      await request(app.getHttpServer())
        .post('/api/billing/payments')
        .set('X-Clinic-Id', TEST_CLINIC_ID)
        .send(buildPaymentBody({ amount: 100 }))
        .expect(400);
    });

    it('rechaza pago sobre factura cancelada (400)', async () => {
      invoiceRepo.findOne!.mockResolvedValue(
        buildInvoiceForPayment({ status: InvoiceStatus.CANCELLED }),
      );

      await request(app.getHttpServer())
        .post('/api/billing/payments')
        .set('X-Clinic-Id', TEST_CLINIC_ID)
        .send(buildPaymentBody({ amount: 50 }))
        .expect(400);
    });

    it('rechaza pago sobre factura reembolsada (400)', async () => {
      invoiceRepo.findOne!.mockResolvedValue(
        buildInvoiceForPayment({ status: InvoiceStatus.REFUNDED }),
      );

      await request(app.getHttpServer())
        .post('/api/billing/payments')
        .set('X-Clinic-Id', TEST_CLINIC_ID)
        .send(buildPaymentBody({ amount: 50 }))
        .expect(400);
    });

    it('rechaza un estado de pago no permitido en creación', async () => {
      invoiceRepo.findOne!.mockResolvedValue(buildInvoiceForPayment());

      await request(app.getHttpServer())
        .post('/api/billing/payments')
        .set('X-Clinic-Id', TEST_CLINIC_ID)
        .send(buildPaymentBody({ status: PaymentStatus.CANCELLED }))
        .expect(400);
    });
  });

  // ─── PATCH /billing/payments/:id/confirm — Confirmación ────────────────────

  describe('PATCH /api/billing/payments/:id/confirm', () => {
    it('confirma un pago PENDING y suma al paidAmount', async () => {
      const qb: any = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({
          id: TEST_PAYMENT_ID,
          status: PaymentStatus.PENDING,
          amount: 100,
          invoice: { id: TEST_INVOICE_ID },
        }),
      };
      paymentRepo.createQueryBuilder!.mockReturnValue(qb);
      paymentRepo.save!.mockImplementation(async (entity: any) => entity);
      invoiceRepo.findOne!.mockResolvedValue({
        id: TEST_INVOICE_ID,
        status: InvoiceStatus.DRAFT,
        totalAmount: 300,
        paidAmount: 0,
        clinic: { id: TEST_CLINIC_ID },
      });
      invoiceRepo.save!.mockImplementation(async (entity: any) => entity);

      await request(app.getHttpServer())
        .patch(`/api/billing/payments/${TEST_PAYMENT_ID}/confirm`)
        .set('X-Clinic-Id', TEST_CLINIC_ID)
        .expect(200);

      expect(invoiceRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ paidAmount: 100 }),
      );
    });

    it('rechaza confirmar un pago ya completado', async () => {
      const qb: any = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({
          id: TEST_PAYMENT_ID,
          status: PaymentStatus.COMPLETED,
          amount: 100,
          invoice: { id: TEST_INVOICE_ID },
        }),
      };
      paymentRepo.createQueryBuilder!.mockReturnValue(qb);

      await request(app.getHttpServer())
        .patch(`/api/billing/payments/${TEST_PAYMENT_ID}/confirm`)
        .set('X-Clinic-Id', TEST_CLINIC_ID)
        .expect(400);
    });
  });

  // ─── PATCH /billing/payments/:id/cancel — Cancelación ──────────────────────

  describe('PATCH /api/billing/payments/:id/cancel', () => {
    it('cancela un pago COMPLETED y resta del paidAmount', async () => {
      const qb: any = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({
          id: TEST_PAYMENT_ID,
          status: PaymentStatus.COMPLETED,
          amount: 100,
          invoice: { id: TEST_INVOICE_ID },
        }),
      };
      paymentRepo.createQueryBuilder!.mockReturnValue(qb);
      paymentRepo.save!.mockImplementation(async (entity: any) => entity);
      invoiceRepo.findOne!.mockResolvedValue({
        id: TEST_INVOICE_ID,
        status: InvoiceStatus.DRAFT,
        totalAmount: 300,
        paidAmount: 100,
        clinic: { id: TEST_CLINIC_ID },
      });
      invoiceRepo.save!.mockImplementation(async (entity: any) => entity);

      await request(app.getHttpServer())
        .patch(`/api/billing/payments/${TEST_PAYMENT_ID}/cancel`)
        .set('X-Clinic-Id', TEST_CLINIC_ID)
        .expect(200);

      expect(invoiceRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ paidAmount: 0 }),
      );
    });
  });

  // ─── GET /billing/invoices/:id — findOne con scope ────────────────────────

  describe('GET /api/billing/invoices/:id', () => {
    it('devuelve la factura si pertenece a la clínica', async () => {
      invoiceRepo.findOne!.mockResolvedValue({
        id: TEST_INVOICE_ID,
        status: InvoiceStatus.DRAFT,
        clinic: { id: TEST_CLINIC_ID },
      });

      const res = await request(app.getHttpServer())
        .get(`/api/billing/invoices/${TEST_INVOICE_ID}`)
        .set('X-Clinic-Id', TEST_CLINIC_ID)
        .expect(200);

      expect(res.body).toMatchObject({ id: TEST_INVOICE_ID });
    });

    it('404 si la factura no pertenece a la clínica solicitada', async () => {
      invoiceRepo.findOne!.mockResolvedValue(null);

      await request(app.getHttpServer())
        .get(`/api/billing/invoices/${TEST_INVOICE_ID}`)
        .set('X-Clinic-Id', OTHER_CLINIC_ID)
        .expect(404);
    });
  });
});
