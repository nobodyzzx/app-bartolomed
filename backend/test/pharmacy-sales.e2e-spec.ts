import { CanActivate, ExecutionContext, INestApplication, Injectable, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as request from 'supertest';

import { PharmacySalesController } from '../src/pharmacy/controllers/pharmacy-sales.controller';
import { PharmacySalesService } from '../src/pharmacy/services/pharmacy-sales.service';
import { PharmacyReceiptPdfService } from '../src/pharmacy/services/pharmacy-receipt-pdf.service';
import { InventoryService } from '../src/pharmacy/services/inventory.service';
import { ChargesService } from '../src/charges/charges.service';
import { AuditService } from '../src/audit/audit.service';
import {
  PharmacySale,
  PharmacySaleItem,
  SaleStatus,
  PaymentMethod,
} from '../src/pharmacy/entities/pharmacy-sale.entity';
import {
  MedicationStock,
  MovementType,
  StockMovement,
} from '../src/pharmacy/entities/pharmacy.entity';
import { Prescription, PrescriptionStatus } from '../src/prescriptions/entities/prescription.entity';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { UserRoleGuard } from '../src/auth/guards/user-role.guard';
import { PermissionsGuard } from '../src/auth/permissions/permissions.guard';
import { ClinicScopeGuard } from '../src/auth/guards/clinic-scope.guard';
import { createMockRepository, MockRepository } from '../src/test/helpers/mock-repository.factory';
import { makeMedicationStock } from '../src/test/helpers/test-data.factory';

const TEST_USER_ID = 'user-1';
const TEST_USER_EMAIL = 'pharmacist@test.com';
const TEST_CLINIC_ID = 'clinic-1';
// El controlador valida `:id` con ParseUUIDPipe — un id como 'sale-1' nunca
// llega al servicio: Nest lo rechaza con 400 antes de resolver la ruta. Los
// tests de abajo usaban 'sale-1'/'nonexistent' y varios "pasaban" por ese 400
// equivocado (ej. los que esperaban 400 por regla de negocio), sin ejercitar
// nunca el código que dicen probar.
const TEST_SALE_ID = '11111111-1111-4111-8111-111111111111';
const TEST_NONEXISTENT_ID = '22222222-2222-4222-8222-222222222222';

@Injectable()
class MockAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    req.user = {
      id: TEST_USER_ID,
      sub: TEST_USER_ID,
      email: TEST_USER_EMAIL,
      roles: ['pharmacist', 'admin'],
      clinicRoles: { [TEST_CLINIC_ID]: ['pharmacist'] },
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

describe('Pharmacy Sales (e2e — mocks)', () => {
  let app: INestApplication;
  let saleRepo: MockRepository<PharmacySale>;
  let saleItemRepo: MockRepository<PharmacySaleItem>;
  let stockRepo: MockRepository<MedicationStock>;
  let movementRepo: MockRepository<StockMovement>;
  let prescriptionRepo: MockRepository<Prescription>;

  const auditServiceMock = { log: jest.fn() };
  const inventoryServiceMock = { getStockAlerts: jest.fn() };
  // Fase 4: la venta con receta puede quedar a cuenta del paciente (ver
  // pharmacy-sales.service.spec.ts) — sin este mock, PharmacySalesService no
  // resuelve sus dependencias y la suite entera falla al compilar el módulo.
  const chargesServiceMock = { create: jest.fn(), findByOrigin: jest.fn(), cancel: jest.fn() };
  // Frente 3 (recibo PDF): PharmacySalesService también depende de este
  // servicio para armar el recibo — sin el mock, la suite entera vuelve a
  // fallar al compilar el módulo, igual que pasó con ChargesService.
  const receiptPdfServiceMock = { generate: jest.fn().mockResolvedValue(Buffer.from('%PDF')) };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [PharmacySalesController],
      providers: [
        PharmacySalesService,
        { provide: InventoryService, useValue: inventoryServiceMock },
        { provide: ChargesService, useValue: chargesServiceMock },
        { provide: PharmacyReceiptPdfService, useValue: receiptPdfServiceMock },
        { provide: AuditService, useValue: auditServiceMock },
        { provide: getRepositoryToken(PharmacySale), useValue: createMockRepository() },
        { provide: getRepositoryToken(PharmacySaleItem), useValue: createMockRepository() },
        { provide: getRepositoryToken(MedicationStock), useValue: createMockRepository() },
        { provide: getRepositoryToken(StockMovement), useValue: createMockRepository() },
        { provide: getRepositoryToken(Prescription), useValue: createMockRepository() },
      ],
    })
      .overrideGuard(JwtAuthGuard).useClass(MockAuthGuard)
      .overrideGuard(UserRoleGuard).useClass(AlwaysAllowGuard)
      .overrideGuard(PermissionsGuard).useClass(AlwaysAllowGuard)
      .overrideGuard(ClinicScopeGuard).useClass(AlwaysAllowGuard)
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

    saleRepo = moduleRef.get(getRepositoryToken(PharmacySale));
    saleItemRepo = moduleRef.get(getRepositoryToken(PharmacySaleItem));
    stockRepo = moduleRef.get(getRepositoryToken(MedicationStock));
    movementRepo = moduleRef.get(getRepositoryToken(StockMovement));
    prescriptionRepo = moduleRef.get(getRepositoryToken(Prescription));

    // create() ahora corre dentro de una transacción; el manager mockeado devuelve
    // los mismos mocks de arriba para que las aserciones existentes sigan funcionando.
    (saleRepo as any).manager = {
      transaction: jest.fn().mockImplementation(async (fn: (m: any) => any) =>
        fn({
          getRepository: (entity: any) => {
            if (entity === PharmacySale) return saleRepo;
            if (entity === PharmacySaleItem) return saleItemRepo;
            if (entity === MedicationStock) return stockRepo;
            if (entity === StockMovement) return movementRepo;
            if (entity === Prescription) return prescriptionRepo;
            throw new Error('Unexpected entity in manager.getRepository mock');
          },
        }),
      ),
    };

    // El stock se relee CON LOCK vía QueryBuilder dentro de la transacción (ver
    // el comentario en pharmacy-sales.service.ts), no con `findOne` directo.
    // El mock delega en `stockRepo.findOne` para que los tests de este archivo
    // sigan expresándose con él, igual que en pharmacy-sales.service.spec.ts.
    stockRepo.createQueryBuilder!.mockImplementation(() => ({
      setLock: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: () => stockRepo.findOne!(),
    } as any));
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock del generador de saleNumber: count() siempre devuelve 0 → SAL-YYYYMMDD-0001
    saleRepo.count!.mockResolvedValue(0);
  });

  // ─── Helpers ──────────────────────────────────────────────────────────────

  const buildValidSaleBody = (overrides: Record<string, any> = {}) => ({
    patientName: 'Cliente Test',
    clinicId: TEST_CLINIC_ID,
    paymentMethod: PaymentMethod.CASH,
    amountPaid: 200,
    items: [{ medicationStockId: 'stock-1', quantity: 5, unitPrice: 25.5 }],
    ...overrides,
  });

  const happyPathStock = (overrides: Record<string, any> = {}) => {
    const stock = makeMedicationStock({ quantity: 100, reservedQuantity: 0, ...overrides });
    stockRepo.findOne!.mockResolvedValue(stock);
    saleRepo.save!.mockImplementation(async (entity: any) => ({ id: TEST_SALE_ID, ...entity }));
    saleItemRepo.save!.mockResolvedValue({});
    stockRepo.save!.mockImplementation(async (entity: any) => entity);
    movementRepo.save!.mockResolvedValue({});
    saleRepo.findOne!.mockResolvedValue({
      id: TEST_SALE_ID,
      saleNumber: 'SAL-TEST-0001',
      items: [],
      status: SaleStatus.COMPLETED,
    });
    return stock;
  };

  // ─── POST /pharmacy-sales — Creación ──────────────────────────────────────

  describe('POST /api/pharmacy-sales', () => {
    it('crea una venta exitosa con stock suficiente (201)', async () => {
      happyPathStock();

      const res = await request(app.getHttpServer())
        .post('/api/pharmacy-sales')
        .set('X-Clinic-Id', TEST_CLINIC_ID)
        .send(buildValidSaleBody())
        .expect(201);

      expect(res.body).toMatchObject({ id: TEST_SALE_ID });
    });

    it('reduce el stock y crea un movimiento SALE', async () => {
      happyPathStock({ quantity: 100 });

      await request(app.getHttpServer())
        .post('/api/pharmacy-sales')
        .set('X-Clinic-Id', TEST_CLINIC_ID)
        .send(buildValidSaleBody())
        .expect(201);

      expect(stockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ quantity: 95 }),
      );
      expect(movementRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ type: MovementType.SALE, quantity: 5 }),
      );
    });

    it('rechaza con 404 si el stock no existe', async () => {
      stockRepo.findOne!.mockResolvedValue(null);

      await request(app.getHttpServer())
        .post('/api/pharmacy-sales')
        .set('X-Clinic-Id', TEST_CLINIC_ID)
        .send(buildValidSaleBody())
        .expect(404);
    });

    it('rechaza con 400 si el stock disponible es insuficiente', async () => {
      const stock = makeMedicationStock({ quantity: 2, reservedQuantity: 0 });
      stockRepo.findOne!.mockResolvedValue(stock);

      await request(app.getHttpServer())
        .post('/api/pharmacy-sales')
        .set('X-Clinic-Id', TEST_CLINIC_ID)
        .send(buildValidSaleBody({ items: [{ medicationStockId: 'stock-1', quantity: 10, unitPrice: 25 }] }))
        .expect(400);
    });

    it('considera la cantidad reservada al validar disponibilidad', async () => {
      const stock = makeMedicationStock({ quantity: 100, reservedQuantity: 98 });
      stockRepo.findOne!.mockResolvedValue(stock);

      await request(app.getHttpServer())
        .post('/api/pharmacy-sales')
        .set('X-Clinic-Id', TEST_CLINIC_ID)
        .send(buildValidSaleBody({ items: [{ medicationStockId: 'stock-1', quantity: 5, unitPrice: 25 }] }))
        .expect(400);
    });

    it('rechaza DTO inválido (sin items) con 400 por ValidationPipe', async () => {
      await request(app.getHttpServer())
        .post('/api/pharmacy-sales')
        .set('X-Clinic-Id', TEST_CLINIC_ID)
        .send({ patientName: 'X', paymentMethod: 'cash' })
        .expect(400);
    });

    it('rechaza paymentMethod no válido (400)', async () => {
      await request(app.getHttpServer())
        .post('/api/pharmacy-sales')
        .set('X-Clinic-Id', TEST_CLINIC_ID)
        .send(buildValidSaleBody({ paymentMethod: 'bitcoin' }))
        .expect(400);
    });

    // Sin IVA (decisión del 2026-08-08, ver pharmacy-sales.service.ts): el
    // precio del tarifario ya es el precio final. Estos dos tests seguían
    // afirmando el 13% que el service ya no aplica desde antes de esta
    // sesión — pasaban por casualidad porque ParseUUIDPipe/el check de
    // clinicId cortaban la request antes de llegar a esta aserción.
    it('calcula correctamente subtotal, tax y total (sin IVA)', async () => {
      happyPathStock();

      await request(app.getHttpServer())
        .post('/api/pharmacy-sales')
        .set('X-Clinic-Id', TEST_CLINIC_ID)
        .send(buildValidSaleBody())
        .expect(201);

      const saved = saleRepo.save!.mock.calls[0][0];
      expect(saved.subtotal).toBeCloseTo(127.5);  // 5 × 25.5
      expect(saved.tax).toBe(0);
      expect(saved.total).toBeCloseTo(127.5);     // subtotal, sin impuesto
    });

    it('calcula cambio correctamente cuando se paga de más', async () => {
      happyPathStock();

      await request(app.getHttpServer())
        .post('/api/pharmacy-sales')
        .set('X-Clinic-Id', TEST_CLINIC_ID)
        .send(buildValidSaleBody({ amountPaid: 200 }))
        .expect(201);

      const saved = saleRepo.save!.mock.calls[0][0];
      expect(saved.change).toBeCloseTo(200 - 127.5);
    });

    it('procesa múltiples ítems reduciendo stock individualmente', async () => {
      const stock1 = makeMedicationStock({ id: 'stock-1', quantity: 50 });
      const stock2 = makeMedicationStock({ id: 'stock-2', quantity: 30 });

      stockRepo.findOne!
        .mockResolvedValueOnce(stock1)
        .mockResolvedValueOnce(stock2);
      saleRepo.save!.mockImplementation(async (e: any) => ({ id: TEST_SALE_ID, ...e }));
      saleItemRepo.save!.mockResolvedValue({});
      stockRepo.save!.mockImplementation(async (e: any) => e);
      movementRepo.save!.mockResolvedValue({});
      saleRepo.findOne!.mockResolvedValue({ id: TEST_SALE_ID, items: [] });
      saleRepo.count!.mockResolvedValue(0);

      await request(app.getHttpServer())
        .post('/api/pharmacy-sales')
        .set('X-Clinic-Id', TEST_CLINIC_ID)
        .send(buildValidSaleBody({
          items: [
            { medicationStockId: 'stock-1', quantity: 10, unitPrice: 5 },
            { medicationStockId: 'stock-2', quantity: 3, unitPrice: 20 },
          ],
        }))
        .expect(201);

      expect(stockRepo.save).toHaveBeenCalledTimes(2);
      expect(stockRepo.save).toHaveBeenCalledWith(expect.objectContaining({ quantity: 40 }));
      expect(stockRepo.save).toHaveBeenCalledWith(expect.objectContaining({ quantity: 27 }));
      expect(movementRepo.save).toHaveBeenCalledTimes(2);
    });

    it('aplica descuento por item correctamente', async () => {
      happyPathStock();

      await request(app.getHttpServer())
        .post('/api/pharmacy-sales')
        .set('X-Clinic-Id', TEST_CLINIC_ID)
        .send(buildValidSaleBody({
          items: [{
            medicationStockId: 'stock-1', quantity: 10, unitPrice: 20,
            discountAmount: 20, discountReason: 'Cliente frecuente',
          }],
        }))
        .expect(201);

      const saved = saleRepo.save!.mock.calls[0][0];
      // 10 × 20 = 200, descuento plano de Bs 20, subtotal efectivo = 180
      expect(saved.subtotal).toBeCloseTo(180);
    });
  });

  // ─── Validación de receta ─────────────────────────────────────────────────

  describe('POST /api/pharmacy-sales con prescriptionId', () => {
    it('rechaza con 404 si la receta no pertenece a la clínica', async () => {
      happyPathStock();
      prescriptionRepo.findOne!.mockResolvedValue(null);

      await request(app.getHttpServer())
        .post('/api/pharmacy-sales')
        .set('X-Clinic-Id', TEST_CLINIC_ID)
        .send(buildValidSaleBody({ prescriptionId: '11111111-1111-4111-8111-111111111111' }))
        .expect(404);
    });

    it('rechaza con 400 si la receta no está ACTIVE', async () => {
      happyPathStock();
      prescriptionRepo.findOne!.mockResolvedValue({
        id: 'rx-1',
        status: PrescriptionStatus.DISPENSED,
      });

      await request(app.getHttpServer())
        .post('/api/pharmacy-sales')
        .set('X-Clinic-Id', TEST_CLINIC_ID)
        .send(buildValidSaleBody({ prescriptionId: '22222222-2222-4222-8222-222222222222' }))
        .expect(400);
    });

    it('marca la receta como DISPENSED tras venta exitosa', async () => {
      happyPathStock();
      const RX_ID = '22222222-2222-4222-8222-222222222222';
      prescriptionRepo.findOne!.mockResolvedValue({ id: RX_ID, status: PrescriptionStatus.ACTIVE });
      prescriptionRepo.update!.mockResolvedValue({ affected: 1 });

      await request(app.getHttpServer())
        .post('/api/pharmacy-sales')
        .set('X-Clinic-Id', TEST_CLINIC_ID)
        .send(buildValidSaleBody({ prescriptionId: RX_ID }))
        .expect(201);

      expect(prescriptionRepo.update).toHaveBeenCalledWith(
        RX_ID,
        expect.objectContaining({ status: PrescriptionStatus.DISPENSED }),
      );
    });
  });

  // ─── GET /pharmacy-sales — Listado ────────────────────────────────────────

  describe('GET /api/pharmacy-sales', () => {
    it('devuelve lista paginada filtrada por clinicId', async () => {
      const mockQb: any = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        // Desempate estable por id (ver listWithFilters): faltaba en este mock
        // y el service real sí lo encadena, así que la ruta completa fallaba
        // con 500 ("addOrderBy is not a function") antes de llegar al test.
        addOrderBy: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[{ id: TEST_SALE_ID }], 1]),
      };
      saleRepo.createQueryBuilder!.mockReturnValue(mockQb);

      const res = await request(app.getHttpServer())
        .get('/api/pharmacy-sales?page=1&limit=25')
        .set('X-Clinic-Id', TEST_CLINIC_ID)
        .expect(200);

      expect(res.body).toMatchObject({ data: [{ id: TEST_SALE_ID }], total: 1, page: 1, limit: 25 });
      expect(mockQb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('clinicId'),
        { clinicId: TEST_CLINIC_ID },
      );
    });
  });

  // ─── PATCH /pharmacy-sales/:id — Actualización ────────────────────────────

  describe('PATCH /api/pharmacy-sales/:id', () => {
    it('rechaza actualizar venta COMPLETED (400)', async () => {
      saleRepo.findOne!.mockResolvedValue({
        id: TEST_SALE_ID,
        clinicId: TEST_CLINIC_ID,
        status: SaleStatus.COMPLETED,
        items: [],
      });

      await request(app.getHttpServer())
        .patch(`/api/pharmacy-sales/${TEST_SALE_ID}`)
        .set('X-Clinic-Id', TEST_CLINIC_ID)
        .send({ patientName: 'Nuevo nombre' })
        .expect(400);
    });
  });

  // ─── DELETE /pharmacy-sales/:id ───────────────────────────────────────────

  describe('DELETE /api/pharmacy-sales/:id', () => {
    it('rechaza eliminar venta COMPLETED (400)', async () => {
      saleRepo.findOne!.mockResolvedValue({
        id: TEST_SALE_ID,
        clinicId: TEST_CLINIC_ID,
        status: SaleStatus.COMPLETED,
        items: [],
      });

      await request(app.getHttpServer())
        .delete(`/api/pharmacy-sales/${TEST_SALE_ID}`)
        .set('X-Clinic-Id', TEST_CLINIC_ID)
        .expect(400);
    });

    it('permite eliminar venta PENDING (200)', async () => {
      saleRepo.findOne!.mockResolvedValue({
        id: TEST_SALE_ID,
        clinicId: TEST_CLINIC_ID,
        status: SaleStatus.PENDING,
        items: [],
      });
      saleRepo.remove!.mockResolvedValue({});

      await request(app.getHttpServer())
        .delete(`/api/pharmacy-sales/${TEST_SALE_ID}`)
        .set('X-Clinic-Id', TEST_CLINIC_ID)
        .expect(200);

      expect(saleRepo.remove).toHaveBeenCalled();
    });
  });

  // ─── PATCH /pharmacy-sales/:id/status — Cancelación ───────────────────────

  describe('PATCH /api/pharmacy-sales/:id/status', () => {
    it('cancela venta y restaura stock', async () => {
      const stock = makeMedicationStock({ id: 'stock-1', quantity: 50 });
      const sale = {
        id: TEST_SALE_ID,
        clinicId: TEST_CLINIC_ID,
        saleNumber: 'SAL-001',
        status: SaleStatus.COMPLETED,
        notes: '',
        items: [{ medicationStockId: 'stock-1', quantity: 5, unitPrice: 25, subtotal: 125 }],
      };

      // Reset específicos porque pruebas anteriores setearon mocks con otras respuestas
      stockRepo.findOne!.mockReset();
      saleRepo.findOne!.mockReset();
      stockRepo.save!.mockReset();
      movementRepo.save!.mockReset();

      saleRepo.findOne!
        .mockResolvedValueOnce(sale)
        .mockResolvedValueOnce(sale)
        .mockResolvedValueOnce({ ...sale, status: SaleStatus.CANCELLED });
      stockRepo.findOne!.mockResolvedValue(stock);
      stockRepo.save!.mockImplementation(async (e: any) => e);
      movementRepo.save!.mockResolvedValue({});
      saleRepo.save!.mockResolvedValue({ ...sale, status: SaleStatus.CANCELLED });

      await request(app.getHttpServer())
        .patch(`/api/pharmacy-sales/${TEST_SALE_ID}/status`)
        .set('X-Clinic-Id', TEST_CLINIC_ID)
        .send({ status: SaleStatus.CANCELLED, notes: 'Devolución cliente' })
        .expect(200);

      // Stock restaurado: 50 + 5 = 55
      expect(stockRepo.save).toHaveBeenCalledWith(expect.objectContaining({ quantity: 55 }));
      // Movimiento tipo ADJUSTMENT
      expect(movementRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ type: MovementType.ADJUSTMENT }),
      );
    });

    /**
     * Frente 2 (rastro de auditoría) de la revisión ventas de farmacia vs
     * punto de cobro: cancelar sin motivo, o con uno demasiado corto, se
     * rechaza en el ValidationPipe — no llega ni a intentar tocar el stock.
     * Mismo criterio que VoidInvoiceDto en facturación.
     */
    it('rechaza cancelar sin motivo (400, ValidationPipe)', async () => {
      await request(app.getHttpServer())
        .patch(`/api/pharmacy-sales/${TEST_SALE_ID}/status`)
        .set('X-Clinic-Id', TEST_CLINIC_ID)
        .send({ status: SaleStatus.CANCELLED })
        .expect(400);

      expect(stockRepo.save).not.toHaveBeenCalled();
    });

    it('rechaza cancelar con un motivo demasiado corto (400, ValidationPipe)', async () => {
      await request(app.getHttpServer())
        .patch(`/api/pharmacy-sales/${TEST_SALE_ID}/status`)
        .set('X-Clinic-Id', TEST_CLINIC_ID)
        .send({ status: SaleStatus.CANCELLED, notes: 'x' })
        .expect(400);
    });
  });

  // ─── PATCH /pharmacy-sales/:id/adjust-payment ─────────────────────────────

  describe('PATCH /api/pharmacy-sales/:id/adjust-payment', () => {
    it('rechaza corregir pago de venta CANCELLED (400)', async () => {
      saleRepo.findOne!.mockResolvedValue({
        id: TEST_SALE_ID,
        clinicId: TEST_CLINIC_ID,
        status: SaleStatus.CANCELLED,
        total: 100,
        items: [],
      });

      await request(app.getHttpServer())
        .patch(`/api/pharmacy-sales/${TEST_SALE_ID}/adjust-payment`)
        .set('X-Clinic-Id', TEST_CLINIC_ID)
        .send({
          paymentMethod: PaymentMethod.CASH,
          amountPaid: 100,
          reason: 'Corrección',
        })
        .expect(400);
    });

    it('actualiza método de pago y registra auditoría', async () => {
      const sale = {
        id: TEST_SALE_ID,
        clinicId: TEST_CLINIC_ID,
        saleNumber: 'SAL-001',
        status: SaleStatus.COMPLETED,
        total: 100,
        amountPaid: 100,
        change: 0,
        paymentMethod: PaymentMethod.CASH,
        notes: '',
        items: [],
      };
      saleRepo.findOne!.mockResolvedValue(sale);
      saleRepo.save!.mockImplementation(async (e: any) => e);

      await request(app.getHttpServer())
        .patch(`/api/pharmacy-sales/${TEST_SALE_ID}/adjust-payment`)
        .set('X-Clinic-Id', TEST_CLINIC_ID)
        .send({
          paymentMethod: PaymentMethod.QR,
          amountPaid: 100,
          reason: 'Cliente pagó por QR',
        })
        .expect(200);

      expect(saleRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ paymentMethod: PaymentMethod.QR }),
      );
      expect(auditServiceMock.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PAYMENT_ADJUSTED',
          resourceId: TEST_SALE_ID,
        }),
      );
    });
  });

  // ─── GET /pharmacy-sales/:id ──────────────────────────────────────────────

  describe('GET /api/pharmacy-sales/:id', () => {
    it('devuelve 404 si no existe', async () => {
      saleRepo.findOne!.mockResolvedValue(null);

      await request(app.getHttpServer())
        .get(`/api/pharmacy-sales/${TEST_NONEXISTENT_ID}`)
        .set('X-Clinic-Id', TEST_CLINIC_ID)
        .expect(404);
    });

    it('devuelve la venta si existe', async () => {
      saleRepo.findOne!.mockResolvedValue({
        id: TEST_SALE_ID,
        clinicId: TEST_CLINIC_ID,
        saleNumber: 'SAL-001',
        total: 100,
        items: [],
      });

      const res = await request(app.getHttpServer())
        .get(`/api/pharmacy-sales/${TEST_SALE_ID}`)
        .set('X-Clinic-Id', TEST_CLINIC_ID)
        .expect(200);

      expect(res.body).toMatchObject({ id: TEST_SALE_ID, saleNumber: 'SAL-001' });
    });
  });

  // ─── GET /pharmacy-sales/:id/receipt (Frente 3: PDF real) ─────────────────

  describe('GET /api/pharmacy-sales/:id/receipt', () => {
    it('devuelve el PDF con el nombre de archivo del recibo', async () => {
      saleRepo.findOne!.mockResolvedValue({
        id: TEST_SALE_ID,
        clinicId: TEST_CLINIC_ID,
        saleNumber: 'SAL-001',
        total: 100,
        items: [],
      });

      const res = await request(app.getHttpServer())
        .get(`/api/pharmacy-sales/${TEST_SALE_ID}/receipt`)
        .set('X-Clinic-Id', TEST_CLINIC_ID)
        .expect(200);

      expect(res.headers['content-type']).toContain('application/pdf');
      expect(res.headers['content-disposition']).toContain('SAL-001.pdf');
      expect(receiptPdfServiceMock.generate).toHaveBeenCalled();
    });
  });
});
