import { Injectable } from '@nestjs/common';
import { prorateDiscount, round2 } from '../../billing/utils/discount-proration.util';
import { TypstCompilerService } from '../../pdf/typst-compiler.service';
import { typstString } from '../../pdf/utils/typst-escape.util';
import { PharmacySale } from '../entities/pharmacy-sale.entity';

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transferencia',
  insurance: 'Seguro',
  mixed: 'Mixto',
  qr: 'QR',
};

/**
 * Recibo de venta de farmacia. Antes era `window.print()` de la pantalla del
 * panel (con menús, botones y estado interno) — esto genera un PDF real,
 * mismo motor y plantilla que el recibo del punto de cobro
 * (ReceiptPdfService), para que la clínica tenga un solo estilo de
 * comprobante.
 *
 * A diferencia de facturación, acá no hay modo ITEMIZED: el descuento nunca
 * sale de cara al paciente en farmacia (decisión ya tomada, ver
 * sale-details.component), así que cada línea imprime directamente su
 * precio neto.
 *
 * El descuento por ítem ya está absorbido en `item.subtotal` (se calcula así
 * desde que se crea la venta, ver PharmacySalesService.create). El
 * descuento SOBRE EL TOTAL (`sale.discount`) es aparte y se prorratea entre
 * las líneas —mismo mecanismo que usa facturación en modo absorbido— para
 * que la suma impresa cuadre exactamente con el TOTAL: sin esto, las líneas
 * sumarían más que el total y el recibo se leería como un error.
 */
@Injectable()
export class PharmacyReceiptPdfService {
  constructor(private readonly typstCompiler: TypstCompilerService) {}

  async generate(sale: PharmacySale): Promise<Buffer> {
    return this.typstCompiler.compile(this.receiptTypst(sale));
  }

  private fmtBs(value: unknown): string {
    const n = Number(value ?? 0);
    return `Bs ${(isNaN(n) ? 0 : n).toLocaleString('es-BO', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  private receiptTypst(sale: PharmacySale): string {
    const items = sale.items ?? [];
    const saleDiscount = Number(sale.discount ?? 0);
    const shares = prorateDiscount(
      items.map(i => ({ gross: Number(i.subtotal ?? 0) })),
      saleDiscount,
    );

    const rows = items.map((item, i) => {
      const netLine = round2(Number(item.subtotal ?? 0) - (shares[i] ?? 0));
      const quantity = Number(item.quantity ?? 0);
      const netUnitPrice = quantity > 0 ? round2(netLine / quantity) : netLine;

      return [
        typstString(item.productName ?? '-'),
        typstString(String(quantity)),
        typstString(this.fmtBs(netUnitPrice)),
        typstString(this.fmtBs(netLine)),
      ];
    });

    const tableRows = rows.length > 0 ? rows.map(cells => `(${cells.join(', ')})`).join(',\n        ') + ',' : '';

    const totals: Array<[string, string, boolean]> = [['TOTAL', this.fmtBs(sale.total), true]];
    if (Number(sale.amountPaid ?? 0) > 0) {
      totals.push(['Pagado', this.fmtBs(sale.amountPaid), false]);
    }
    if (Number(sale.change ?? 0) > 0) {
      totals.push(['Cambio', this.fmtBs(sale.change), false]);
    }

    const totalsTypst = totals
      .map(([label, value, strong]) => `    #totalRow(${typstString(label)}, ${typstString(value)}, strong: ${strong})`)
      .join('\n');

    const metaFields: Array<[string, string]> = [
      ['Recibo', sale.saleNumber],
      ['Fecha', new Date(sale.saleDate).toLocaleDateString('es-BO')],
      ['Paciente', sale.patientName || 'Consumidor final'],
      ['Pago', PAYMENT_METHOD_LABELS[sale.paymentMethod] ?? sale.paymentMethod],
    ];
    const metaTypst = metaFields.map(([k, v]) => `(${typstString(k)}, ${typstString(v)})`).join(',\n  ') + ',';

    return `#import "/templates/bartolomed-base.typ": bartolomedDoc, header, metaBar, section, styledTable, noData, gris-muted

#let totalRow(label, value, strong: false) = grid(
  columns: (1fr, auto),
  column-gutter: 16pt,
  align: (right, right),
  text(size: if strong { 11pt } else { 9.5pt }, weight: if strong { "bold" } else { "regular" })[#label],
  text(size: if strong { 11pt } else { 9.5pt }, weight: if strong { "bold" } else { "regular" })[#value],
)

#show: bartolomedDoc.with(title: ${typstString(`Recibo ${sale.saleNumber}`)}, paper: "a4")

#header(name: "BARTOLOMED", subtitle: "Comprobante de Venta — Farmacia", badge: "RECIBO")
#metaBar((
  ${metaTypst}
))

#pad(x: 28pt, y: 14pt)[
  #section("Detalle")[
    ${
      rows.length === 0
        ? '#noData()'
        : `#styledTable(
      ("Producto", "Cant.", "P. Unitario", "Importe"),
      (
        ${tableRows}
      ),
      align: (left, center, right, right),
      widths: (3fr, 0.8fr, 1.3fr, 1.3fr),
    )`
    }
  ]

  #v(14pt)
  #align(right, block(width: 55%)[
${totalsTypst}
  ])

  #v(28pt)
  #align(center, text(size: 8pt, fill: gris-muted)[Gracias por su preferencia])
]
`;
  }
}
