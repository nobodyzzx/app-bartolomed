import { Test, TestingModule } from '@nestjs/testing';
import { TypstCompilerService } from '../../pdf/typst-compiler.service';
import { PharmacySale, PharmacySaleItem, PaymentMethod } from '../entities/pharmacy-sale.entity';
import { PharmacyReceiptPdfService } from './pharmacy-receipt-pdf.service';

const makeItem = (over: Partial<PharmacySaleItem> = {}): PharmacySaleItem =>
  Object.assign(new PharmacySaleItem(), {
    productName: 'Paracetamol 500mg',
    quantity: 2,
    unitPrice: 5,
    discount: 0,
    subtotal: 10,
    ...over,
  });

const makeSale = (over: Partial<PharmacySale> = {}): PharmacySale =>
  Object.assign(new PharmacySale(), {
    saleNumber: 'SAL-000001',
    saleDate: new Date('2026-08-27'),
    patientName: 'Cliente',
    paymentMethod: PaymentMethod.CASH,
    subtotal: 10,
    discount: 0,
    total: 10,
    amountPaid: 10,
    change: 0,
    items: [makeItem()],
    ...over,
  });

/** Extrae los importes "Bs 1.234,56" del `.typ` generado. */
const amountsIn = (source: string): number[] =>
  [...source.matchAll(/Bs ([\d.]+,\d{2})/g)].map(m => parseFloat(m[1].replace(/\./g, '').replace(',', '.')));

describe('PharmacyReceiptPdfService', () => {
  let service: PharmacyReceiptPdfService;
  let typst: { compile: jest.Mock };

  beforeEach(async () => {
    typst = { compile: jest.fn().mockResolvedValue(Buffer.from('%PDF')) };
    const module: TestingModule = await Test.createTestingModule({
      providers: [PharmacyReceiptPdfService, { provide: TypstCompilerService, useValue: typst }],
    }).compile();
    service = module.get(PharmacyReceiptPdfService);
  });

  const sourceFor = async (sale: PharmacySale) => {
    await service.generate(sale);
    return typst.compile.mock.calls[0][0] as string;
  };

  it('nunca menciona el descuento: farmacia no tiene modo itemizado', async () => {
    const source = await sourceFor(
      makeSale({
        subtotal: 100,
        discount: 20,
        total: 80,
        amountPaid: 80,
        items: [makeItem({ quantity: 1, unitPrice: 100, subtotal: 100 })],
      }),
    );

    expect(source).not.toContain('Descuento');
    expect(source).not.toContain('discount');
  });

  /**
   * Caso real (SAL-20260827-0003): un ítem ya tiene discount>0 (absorbido en
   * su propio subtotal) y ADEMÁS hay un descuento sobre el total de la
   * venta. Sin prorratear este segundo descuento entre las líneas, la suma
   * impresa de "Importe" daría más que el TOTAL — un recibo que no cuadra.
   */
  it('EL RECIBO CUADRA: prorratea el descuento sobre el total y las líneas suman el TOTAL impreso', async () => {
    const sale = makeSale({
      subtotal: 100, // 60 + 40, ya neto de descuentos por ítem
      discount: 10, // descuento adicional sobre el total
      total: 90,
      amountPaid: 90,
      items: [
        makeItem({ productName: 'A', quantity: 1, unitPrice: 60, discount: 0, subtotal: 60 }),
        makeItem({ productName: 'B', quantity: 1, unitPrice: 40, discount: 0, subtotal: 40 }),
      ],
    });

    const source = await sourceFor(sale);

    // Prorrateado 60/40 → A pierde 6, B pierde 4 → líneas netas 54 y 36.
    expect(source).toContain('"Bs 54,00"');
    expect(source).toContain('"Bs 36,00"');
    expect(source).toContain('"Bs 90,00"');

    const lineAmounts = [54, 36];
    expect(lineAmounts.reduce((a, b) => a + b, 0)).toBe(90);
    expect(amountsIn(source)).toContain(90);
  });

  it('imprime el precio unitario ya neto cuando el descuento es por ítem', async () => {
    const source = await sourceFor(
      makeSale({
        items: [makeItem({ productName: 'Metformina 850mg', quantity: 10, unitPrice: 1.5, discount: 15, subtotal: 0 })],
        subtotal: 0,
        total: 0,
        amountPaid: 0,
      }),
    );

    // subtotal ya viene neto de descuento (0, no 15): el importe y el
    // unitario impresos son 0, no el precio de lista (1.50).
    expect(source).toContain('"Bs 0,00"');
    expect(source).not.toContain('"Bs 1,50"');
  });

  it('sin ítems, muestra noData() en vez de una tabla vacía', async () => {
    const source = await sourceFor(makeSale({ items: [], subtotal: 0, total: 0 }));
    expect(source).toContain('#noData()');
  });

  it('usa "Consumidor final" cuando la venta no tiene nombre de paciente', async () => {
    const source = await sourceFor(makeSale({ patientName: '' as any }));
    expect(source).toContain('Consumidor final');
  });

  it('muestra el cambio cuando se pagó de más', async () => {
    const source = await sourceFor(makeSale({ amountPaid: 15, change: 5 }));
    expect(source).toContain('"Cambio"');
    expect(source).toContain('"Bs 5,00"');
  });

  it('escapa las comillas para no romper el .typ', async () => {
    const source = await sourceFor(makeSale({ items: [makeItem({ productName: 'Jarabe "Tos Seca"' })] }));
    expect(source).toContain('Jarabe \\"Tos Seca\\"');
  });
});
