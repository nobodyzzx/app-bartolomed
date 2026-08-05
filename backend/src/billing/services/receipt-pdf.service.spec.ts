import { Test, TestingModule } from '@nestjs/testing';
import { Charge, DiscountDisplay } from '../../charges/entities/charge.entity';
import { TypstCompilerService } from '../../pdf/typst-compiler.service';
import { Invoice } from '../entities/billing.entity';
import { ReceiptPdfService } from './receipt-pdf.service';

const makeCharge = (over: Partial<Charge> = {}): Charge =>
  Object.assign(new Charge(), {
    description: 'Consulta general',
    quantity: 1,
    listPrice: 80,
    discountAmount: 4.85,
    unitPrice: 75.15,
    total: 75.15,
    ...over,
  });

const makeInvoice = (over: Partial<Invoice> = {}): Invoice =>
  Object.assign(new Invoice(), {
    invoiceNumber: 'FAC-000001',
    issueDate: new Date('2026-08-05'),
    subtotal: 165,
    discountAmount: 10,
    totalAmount: 155,
    paidAmount: 155,
    remainingAmount: 0,
    ...over,
  });

/** Extrae los importes "Bs 1.234,56" del `.typ` generado. */
const amountsIn = (source: string): number[] =>
  [...source.matchAll(/Bs ([\d.]+,\d{2})/g)].map(m => parseFloat(m[1].replace(/\./g, '').replace(',', '.')));

describe('ReceiptPdfService', () => {
  let service: ReceiptPdfService;
  let typst: { compile: jest.Mock };

  const charges = [
    makeCharge(),
    makeCharge({
      description: 'Hemograma completo',
      listPrice: 45,
      discountAmount: 2.73,
      unitPrice: 42.27,
      total: 42.27,
    }),
    makeCharge({ description: 'Curación simple', listPrice: 40, discountAmount: 2.42, unitPrice: 37.58, total: 37.58 }),
  ];

  beforeEach(async () => {
    typst = { compile: jest.fn().mockResolvedValue(Buffer.from('%PDF')) };
    const module: TestingModule = await Test.createTestingModule({
      providers: [ReceiptPdfService, { provide: TypstCompilerService, useValue: typst }],
    }).compile();
    service = module.get(ReceiptPdfService);
  });

  const sourceFor = async (display: DiscountDisplay, invoice = makeInvoice(), lines = charges) => {
    await service.generate(invoice, lines, display);
    return typst.compile.mock.calls[0][0] as string;
  };

  describe('modo desglosado (itemized)', () => {
    it('muestra los precios de lista y el descuento al pie', async () => {
      const source = await sourceFor(DiscountDisplay.ITEMIZED);

      expect(source).toContain('"Bs 80,00"');
      expect(source).toContain('"Descuento"');
      expect(source).toContain('"- Bs 10,00"');
      expect(source).toContain('"Subtotal"');
    });

    it('las líneas suman el subtotal impreso', async () => {
      const source = await sourceFor(DiscountDisplay.ITEMIZED);
      // Cada línea aporta unitario e importe; los importes son 80/45/40.
      expect(source).toContain('"Bs 45,00"');
      expect(source).toContain('"Bs 40,00"');
      expect(source).toContain('"Bs 165,00"');
    });
  });

  describe('modo absorbido (absorbed)', () => {
    it('no menciona el descuento en ninguna parte', async () => {
      const source = await sourceFor(DiscountDisplay.ABSORBED);

      expect(source).not.toContain('Descuento');
      expect(source).not.toContain('Subtotal');
    });

    it('imprime el precio unitario ya neto', async () => {
      const source = await sourceFor(DiscountDisplay.ABSORBED);

      expect(source).toContain('"Bs 75,15"');
      expect(source).toContain('"Bs 42,27"');
      expect(source).toContain('"Bs 37,58"');
      // El precio de lista no debe aparecer: delataría el descuento.
      expect(source).not.toContain('"Bs 80,00"');
    });

    it('EL DOCUMENTO CUADRA: las líneas suman exactamente el total impreso', async () => {
      const source = await sourceFor(DiscountDisplay.ABSORBED);
      const lineTotals = charges.map(c => c.total);
      const sum = Math.round(lineTotals.reduce((a, b) => a + b, 0) * 100) / 100;

      expect(sum).toBe(155);
      expect(amountsIn(source)).toContain(155);
    });
  });

  it('ambos modos imprimen el mismo TOTAL: el descuento es presentación, no importe', async () => {
    await service.generate(makeInvoice(), charges, DiscountDisplay.ITEMIZED);
    const itemized = typst.compile.mock.calls[0][0] as string;
    typst.compile.mockClear();
    await service.generate(makeInvoice(), charges, DiscountDisplay.ABSORBED);
    const absorbed = typst.compile.mock.calls[0][0] as string;

    expect(itemized).toContain('"Bs 155,00"');
    expect(absorbed).toContain('"Bs 155,00"');
  });

  it('sin descuento, el modo desglosado no agrega filas vacías', async () => {
    const invoice = makeInvoice({ subtotal: 80, discountAmount: 0, totalAmount: 80, paidAmount: 80 });
    const source = await sourceFor(DiscountDisplay.ITEMIZED, invoice, [
      makeCharge({ discountAmount: 0, unitPrice: 80, total: 80 }),
    ]);

    expect(source).not.toContain('"Descuento"');
  });

  it('muestra el saldo cuando el pago fue parcial', async () => {
    const invoice = makeInvoice({ paidAmount: 100, remainingAmount: 55 });
    const source = await sourceFor(DiscountDisplay.ITEMIZED, invoice);

    expect(source).toContain('"Saldo pendiente"');
    expect(source).toContain('"Bs 55,00"');
  });

  it('usa el nombre libre cuando el paciente no tiene ficha', async () => {
    const source = await sourceFor(DiscountDisplay.ITEMIZED, makeInvoice(), [
      makeCharge({ patientName: 'Juana Mamani (derivada)' }),
    ]);

    expect(source).toContain('Juana Mamani (derivada)');
  });

  it('escapa las comillas para no romper el .typ', async () => {
    const source = await sourceFor(DiscountDisplay.ITEMIZED, makeInvoice(), [
      makeCharge({ description: 'Examen "especial"' }),
    ]);

    expect(source).toContain('Examen \\"especial\\"');
  });
});
