import { Invoice, InvoiceStatus } from './billing.entity';

/**
 * `calculateAmounts()` corre en cada insert y cada update. Que el saldo de una
 * factura anulada quede en cero depende de este hook, no del servicio: el hook
 * se ejecuta DESPUÉS de que `voidInvoice()` asigna sus ceros, así que si aquí se
 * recalcula, gana el hook y la anulación queda a medias.
 */
const makeInvoice = (overrides: Partial<Invoice> = {}): Invoice => {
  const invoice = new Invoice();
  Object.assign(invoice, {
    subtotal: 150,
    discountAmount: 0,
    discountRate: 0,
    taxAmount: 0,
    taxRate: 0,
    paidAmount: 0,
    status: InvoiceStatus.PENDING,
    dueDate: new Date('2099-01-01'),
    ...overrides,
  });
  return invoice;
};

describe('Invoice.calculateAmounts', () => {
  it('deja el saldo en cero cuando la factura está anulada', () => {
    const invoice = makeInvoice({ status: InvoiceStatus.CANCELLED, paidAmount: 0 });

    invoice.calculateAmounts();

    expect(invoice.totalAmount).toBe(150);
    expect(invoice.remainingAmount).toBe(0);
    // El estado terminal no se toca por más que el pago sea 0.
    expect(invoice.status).toBe(InvoiceStatus.CANCELLED);
  });

  it('deja el saldo en cero cuando la factura está devuelta', () => {
    const invoice = makeInvoice({ status: InvoiceStatus.REFUNDED, paidAmount: 150 });

    invoice.calculateAmounts();

    expect(invoice.remainingAmount).toBe(0);
    expect(invoice.status).toBe(InvoiceStatus.REFUNDED);
  });

  it('sigue calculando el saldo normalmente en una factura viva', () => {
    const invoice = makeInvoice({ status: InvoiceStatus.PENDING, paidAmount: 50 });

    invoice.calculateAmounts();

    expect(invoice.totalAmount).toBe(150);
    expect(invoice.remainingAmount).toBe(100);
    expect(invoice.status).toBe(InvoiceStatus.PARTIALLY_PAID);
  });

  it('marca como pagada y sin saldo cuando se cubre el total', () => {
    const invoice = makeInvoice({ status: InvoiceStatus.PENDING, paidAmount: 150 });

    invoice.calculateAmounts();

    expect(invoice.remainingAmount).toBe(0);
    expect(invoice.status).toBe(InvoiceStatus.PAID);
  });
});
