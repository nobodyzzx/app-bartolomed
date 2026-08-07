import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AuditService } from '../../audit/audit.service';
import { Charge, ChargeStatus } from '../../charges/entities/charge.entity';
import { User } from '../../users/entities/user.entity';
import { Invoice, InvoiceStatus, Payment, PaymentStatus } from '../entities/billing.entity';
import { CheckoutService } from './checkout.service';

/**
 * Cubre solo `voidInvoice`. Es lógica con dinero de por medio: si al anular los
 * cargos no vuelven a la cuenta, o el pago sigue vivo, la caja cuadra con
 * dinero que ya no corresponde a ninguna factura.
 */
describe('CheckoutService — voidInvoice', () => {
  let service: CheckoutService;
  let invoiceRepo: any;
  let chargeRepo: any;
  let paymentRepo: any;
  let auditService: { log: jest.Mock };

  const user = { id: 'user-1', email: 'rec@clinica.local' } as User;

  const makeInvoice = (overrides: Partial<Invoice> = {}) =>
    ({
      id: 'inv-1',
      invoiceNumber: 'FAC-000001',
      status: InvoiceStatus.PAID,
      totalAmount: 100,
      paidAmount: 100,
      remainingAmount: 0,
      ...overrides,
    }) as Invoice;

  const makeCharge = (overrides: Partial<Charge> = {}) =>
    ({
      id: 'chg-1',
      status: ChargeStatus.INVOICED,
      invoiceId: 'inv-1',
      quantity: 1,
      listPrice: 100,
      discountAmount: 20,
      discountReason: 'Descuento que no correspondía',
      discountAuthorizedById: 'user-9',
      total: 80,
      ...overrides,
    }) as Charge;

  beforeEach(() => {
    chargeRepo = { find: jest.fn().mockResolvedValue([]), save: jest.fn(x => Promise.resolve(x)) };
    paymentRepo = { find: jest.fn().mockResolvedValue([]), save: jest.fn(x => Promise.resolve(x)) };
    invoiceRepo = {
      findOne: jest.fn(),
      save: jest.fn(x => Promise.resolve(x)),
      manager: {
        transaction: jest.fn((fn: (m: any) => any) =>
          fn({
            getRepository: (entity: any) => {
              if (entity === Invoice) return invoiceRepo;
              if (entity === Charge) return chargeRepo;
              if (entity === Payment) return paymentRepo;
              return {};
            },
          }),
        ),
      },
    };
    auditService = { log: jest.fn() };

    service = new CheckoutService(
      invoiceRepo,
      chargeRepo,
      auditService as unknown as AuditService,
      { buildReceipt: jest.fn() } as any,
    );
  });

  it('exige clinicId', async () => {
    await expect(service.voidInvoice('inv-1', 'motivo suficiente', user, undefined)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('exige un motivo', async () => {
    await expect(service.voidInvoice('inv-1', '   ', user, 'clinic-1')).rejects.toThrow(
      'La anulación requiere un motivo',
    );
  });

  it('falla si la factura no existe en esa clínica', async () => {
    invoiceRepo.findOne.mockResolvedValue(null);
    await expect(service.voidInvoice('inv-1', 'motivo suficiente', user, 'clinic-1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('no permite anular dos veces', async () => {
    invoiceRepo.findOne.mockResolvedValue(makeInvoice({ status: InvoiceStatus.CANCELLED }));
    await expect(service.voidInvoice('inv-1', 'motivo suficiente', user, 'clinic-1')).rejects.toThrow(
      'La factura ya está anulada',
    );
  });

  it('conserva la factura con su número y deja el rastro de quién y por qué', async () => {
    const invoice = makeInvoice();
    invoiceRepo.findOne.mockResolvedValue(invoice);

    const result = await service.voidInvoice('inv-1', 'Descuento mal aplicado', user, 'clinic-1');

    // No se borra: un hueco en la numeración sería indistinguible de un cobro
    // que alguien hizo desaparecer.
    expect(result.invoiceNumber).toBe('FAC-000001');
    expect(result.totalAmount).toBe(100);
    expect(result.status).toBe(InvoiceStatus.CANCELLED);
    expect(result.voidReason).toBe('Descuento mal aplicado');
    expect(result.voidedBy).toBe(user);
    expect(result.voidedAt).toBeInstanceOf(Date);
    expect(result.paidAmount).toBe(0);
  });

  it('devuelve los cargos a pendientes y les limpia el descuento', async () => {
    invoiceRepo.findOne.mockResolvedValue(makeInvoice());
    const charge = makeCharge();
    chargeRepo.find.mockResolvedValue([charge]);

    await service.voidInvoice('inv-1', 'Descuento mal aplicado', user, 'clinic-1');

    // A `pending`, no a `cancelled`: el servicio se prestó, lo que estuvo mal
    // fue el descuento. Anularlos obligaría a recrearlos a mano.
    expect(charge.status).toBe(ChargeStatus.PENDING);
    expect(charge.invoiceId).toBeNull();
    expect(charge.discountAmount).toBe(0);
    expect(charge.discountReason).toBeNull();
    expect(charge.discountAuthorizedById).toBeNull();
    expect(chargeRepo.save).toHaveBeenCalledWith(charge);
  });

  it('cancela los pagos, para que la caja no cuadre con dinero sin factura', async () => {
    invoiceRepo.findOne.mockResolvedValue(makeInvoice());
    const payment = { id: 'pay-1', status: PaymentStatus.COMPLETED } as Payment;
    paymentRepo.find.mockResolvedValue([payment]);

    await service.voidInvoice('inv-1', 'Descuento mal aplicado', user, 'clinic-1');

    expect(payment.status).toBe(PaymentStatus.CANCELLED);
    expect(paymentRepo.save).toHaveBeenCalledWith(payment);
  });

  it('no vuelve a tocar un pago ya cancelado', async () => {
    invoiceRepo.findOne.mockResolvedValue(makeInvoice());
    paymentRepo.find.mockResolvedValue([{ id: 'pay-1', status: PaymentStatus.CANCELLED } as Payment]);

    await service.voidInvoice('inv-1', 'Descuento mal aplicado', user, 'clinic-1');

    expect(paymentRepo.save).not.toHaveBeenCalled();
  });

  it('registra la anulación en auditoría', async () => {
    invoiceRepo.findOne.mockResolvedValue(makeInvoice());
    chargeRepo.find.mockResolvedValue([makeCharge()]);

    await service.voidInvoice('inv-1', 'Descuento mal aplicado', user, 'clinic-1');

    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'INVOICE_VOIDED',
        userEmail: 'rec@clinica.local',
        details: expect.objectContaining({
          invoiceNumber: 'FAC-000001',
          reason: 'Descuento mal aplicado',
          chargesReturned: 1,
        }),
      }),
    );
  });
});
