import { Injectable } from '@nestjs/common';
import { formatDateTime, formatPlainDate, nowInClinicTz } from '../common/utils/date-format.util';
import { TypstCompilerService } from '../pdf/typst-compiler.service';
import { typstString } from '../pdf/utils/typst-escape.util';
import { LabOrder, LabOrderItem, LabOrderOrigin, LabOrderStatus, LabOrderType } from './entities/lab-order.entity';
import { LAB_CATEGORY_LABELS } from '../service-prices/lab-categories';

/**
 * Informe de resultados que se entrega al paciente y que el médico puede
 * imprimir o adjuntar al expediente.
 *
 * No se archiva ningún binario: el PDF se compila al vuelo desde
 * `lab_order_items`, que es donde vive el dato. Guardar el archivo duplicaría
 * la verdad — si un resultado se corrige, el PDF viejo mentiría.
 */
@Injectable()
export class LabResultsPdfService {
  constructor(private readonly typstCompiler: TypstCompilerService) {}

  async generate(order: LabOrder): Promise<Buffer> {
    return this.typstCompiler.compile(this.resultsTypst(order));
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  /** `orderDate` y fecha de nacimiento son columnas `date` — ver el util. */
  private fmtDate(d: Date | string | null | undefined): string {
    return formatPlainDate(d);
  }

  /** `resultedAt` es un instante real: hora de la clínica. */
  private fmtDateTime(d: Date | string | null | undefined): string {
    return formatDateTime(d);
  }

  private nowBO(): string {
    return nowInClinicTz();
  }

  private statusLabel(s: string): string {
    const map: Record<string, string> = {
      requested: 'Solicitada', sample_collected: 'Muestra tomada',
      // Neutro a propósito: en el documento que recibe el paciente, la
      // derivación a un laboratorio externo no se menciona.
      sent_to_provider: 'En proceso', in_progress: 'En proceso',
      completed: 'Completada', cancelled: 'Cancelada',
    };
    return map[s] ?? s;
  }

  private statusColor(s: string): string {
    const map: Record<string, string> = {
      requested: 'gray', sample_collected: 'amber', sent_to_provider: 'purple', in_progress: 'blue',
      completed: 'green', cancelled: 'red',
    };
    return map[s] ?? 'gray';
  }

  /**
   * Subtítulo del estudio en el informe: categoría clínica del tarifario
   * (Hematología, Química sanguínea…) y tipo de muestra. La categoría es la que
   * usa un laboratorio; `category` solo distingue la clase de muestra y se
   * queda como respaldo para los estudios anteriores al tarifario real.
   */
  private itemSubtitle(it: LabOrderItem): string {
    const categoria = it.labCategory
      ? LAB_CATEGORY_LABELS[it.labCategory] ?? it.labCategory
      : this.categoryLabel(it.category);
    return `${categoria}${it.specimenType ? ` · ${it.specimenType}` : ''}`;
  }

  private categoryLabel(c: string): string {
    const map: Record<string, string> = { blood: 'Sangre', imaging: 'Imagenología', other: 'Otro' };
    return map[c] ?? c;
  }

  /** Nombre de quien indicó el examen: médico de la casa o solicitante externo. */
  private requesterName(order: LabOrder): string {
    if (order.origin === LabOrderOrigin.EXTERNAL) {
      return order.referringDoctorName?.trim() || 'Particular, sin orden médica';
    }
    const d = order.doctor;
    if (!d) return '—';
    return `Dr. ${d.personalInfo?.firstName ?? ''} ${d.personalInfo?.lastName ?? ''}`.trim();
  }

  private patientLabel(order: LabOrder): string {
    if (order.patient) return `${order.patient.firstName} ${order.patient.lastName}`;
    return order.patientName?.trim() || '—';
  }

  /** Quién validó/cargó el último resultado, para la firma del informe. */
  private enteredByLabel(items: LabOrderItem[]): string {
    const withResult = items.filter(i => i.resultedAt && i.enteredBy);
    const last = withResult[withResult.length - 1];
    if (!last?.enteredBy) return 'Responsable de laboratorio';
    const p = last.enteredBy.personalInfo;
    const name = `${p?.firstName ?? ''} ${p?.lastName ?? ''}`.trim();
    return name || last.enteredBy.email;
  }

  // ─── Typst ──────────────────────────────────────────────────────────────────
  // Todo dato dinámico (nombres, valores, notas del resultado) va como
  // ARGUMENTO de función vía typstString, nunca embebido dentro de un bloque
  // `[...]` de markup: ahí un `*`, `#` o `[` escrito por el usuario se
  // reinterpretaría como sintaxis Typst.

  /**
   * Bloque de informe de un estudio de gabinete (ecografía, colonoscopía, ECG).
   * A diferencia del análisis de laboratorio, aquí el resultado no es un valor
   * con unidad y rango sino un **informe redactado**, así que se muestra como un
   * bloque de texto y no como fila de tabla. Los saltos de línea del informe se
   * respetan apilando cada línea en un `stack` vertical: cada una viaja por
   * `typstString` como argumento, nunca embebida en markup.
   */
  private itemReportBlock(it: LabOrderItem): string {
    const hasResult = !!it.resultedAt;

    const badge = !hasResult
      ? `badge(${typstString('Pendiente')}, color: "gray")`
      : it.isAbnormal
        ? `badge(${typstString('Con hallazgos')}, color: "red")`
        : `badge(${typstString('Normal')}, color: "green")`;

    let informe: string;
    if (!hasResult) {
      informe = `text(size: 9pt, fill: gris-claro, ${typstString('Pendiente de realización')})`;
    } else if (it.resultNotes && it.resultNotes.trim()) {
      const lineas = it.resultNotes
        .split('\n')
        .map(l => `text(size: 9pt, fill: gris-texto, ${typstString(l)})`)
        .join(', ');
      informe = `stack(dir: ttb, spacing: 3pt, ${lineas})`;
    } else {
      informe = `text(size: 9pt, fill: gris-claro, style: "italic", ${typstString('Estudio realizado; informe sin texto')})`;
    }

    const procesado = hasResult
      ? `\n  #v(5pt)\n  #text(size: 7.5pt, fill: gris-muted, ${typstString('Procesado: ' + this.fmtDateTime(it.resultedAt))})`
      : '';

    return `#block(width: 100%, breakable: false, stroke: 0.5pt + borde-claro, radius: 3pt, inset: (x: 10pt, y: 8pt))[
  #grid(columns: (1fr, auto), column-gutter: 8pt, align: (left + horizon, right + horizon),
    stack(dir: ttb, spacing: 2pt,
      strong(${typstString(it.testName)}),
      text(size: 7.5pt, fill: gris-muted, ${typstString(this.itemSubtitle(it))}),
    ),
    ${badge},
  )
  #v(6pt)
  #${informe}${procesado}
]`;
  }

  private resultsTypst(order: LabOrder): string {
    const clinic = order.clinic;
    const items: LabOrderItem[] = (order.items ?? []) as LabOrderItem[];
    const patient = order.patient;
    const isSpecial = order.orderType === LabOrderType.SPECIAL;

    const itemRows = items.map((it, i) => {
      const hasResult = !!it.resultedAt;
      const value = hasResult
        ? `${it.resultValue ?? '—'}${it.resultUnit ? ` ${it.resultUnit}` : ''}`
        : 'Pendiente';

      // La marca de fuera de rango es lo primero que mira quien lee el informe:
      // va en rojo y con etiqueta, no solo como color.
      // `hyphenate: false` en el badge: la plantilla base activa el guionado
      // para que los nombres largos no desborden la celda, pero en una etiqueta
      // corta parte la palabra ("FUERA DE RAN-GO") y queda ilegible.
      const valueCell = hasResult && it.isAbnormal
        ? `align(center, stack(dir: ttb, spacing: 2pt, text(weight: "bold", fill: rojo, ${typstString(value)}), text(hyphenate: false, badge(${typstString('Fuera de rango')}, color: "red"))))`
        : `align(center, text(weight: ${hasResult ? '"bold"' : '"regular"'}, fill: ${hasResult ? 'gris-texto' : 'gris-claro'}, ${typstString(value)}))`;

      const nameParts = [
        `strong(${typstString(it.testName)})`,
        `text(size: 7.5pt, fill: gris-muted, ${typstString(this.itemSubtitle(it))})`,
      ];
      if (it.resultNotes) {
        nameParts.push(`text(size: 7.5pt, fill: gris-texto, style: "italic", ${typstString(it.resultNotes)})`);
      }

      return `align(center, strong(${typstString(String(i + 1))})),
      stack(dir: ttb, spacing: 2pt, ${nameParts.join(', ')}),
      ${valueCell},
      align(center, text(hyphenate: false, ${typstString(it.referenceRange || '—')})),
      align(center, text(size: 8pt, ${typstString(this.fmtDateTime(it.resultedAt))}))`;
    });

    // Laboratorio: tabla de valores (valor · unidad · rango de referencia).
    // Gabinete: cada estudio es un informe redactado, no una fila de tabla.
    const itemsTable = items.length === 0
      ? `#align(center, text(size: 9pt, fill: gris-claro, "Sin estudios"))`
      : isSpecial
        ? items.map(it => this.itemReportBlock(it)).join('\n  #v(8pt)\n  ')
        : `#table(
    columns: (24pt, 1fr, 105pt, 72pt, 85pt),
    stroke: 0.5pt + borde-claro,
    fill: (_, y) => if y == 0 { rgb("#f3f4f6") } else if calc.rem(y, 2) == 0 { fondo-raya } else { white },
    table.header(
      align(center, text(size: 7.5pt, weight: "bold", upper("#"))),
      text(size: 7.5pt, weight: "bold", upper("Estudio · Muestra")),
      align(center, text(size: 7.5pt, weight: "bold", upper("Resultado"))),
      align(center, text(size: 7.5pt, weight: "bold", upper("Referencia"))),
      align(center, text(size: 7.5pt, weight: "bold", upper("Procesado"))),
    ),
    ${itemRows.join(',\n    ')},
  )`;

    const notesSection = order.clinicalNotes
      ? `#section(${typstString('Notas Clínicas de la Orden')})[
  #block(width: 100%, stroke: 1pt + borde, radius: 2pt, inset: (x: 7pt, y: 5pt), text(size: 9pt, ${typstString(order.clinicalNotes)}))
]`
      : '';

    // Un informe con estudios pendientes es un informe parcial: hay que decirlo
    // en el papel, o quien lo recibe asume que eso es todo lo que había.
    const pending = items.filter(i => !i.resultedAt).length;
    const conResultado = items.length - pending;
    const avisoTexto =
      conResultado === 0
        ? isSpecial
          ? 'Solicitud de estudio: todavía sin informe.'
          : 'Solicitud de estudios: todavía sin resultados. Este documento acompaña la muestra.'
        : `Informe parcial: ${pending} estudio(s) aún sin resultado.`;
    const partialWarning = pending > 0 && order.status !== LabOrderStatus.CANCELLED
      ? `#block(width: 100%, fill: rgb("#fef3c7"), stroke: 1pt + ambar, radius: 2pt, inset: (x: 8pt, y: 6pt), text(size: 9pt, fill: rgb("#92400e"), ${typstString(avisoTexto)}))
  #v(8pt)`
      : '';

    const originLabel = order.origin === LabOrderOrigin.EXTERNAL ? 'Externa' : 'Interna';

    // La fecha de entrega sí interesa al paciente ("¿cuándo estará?"), pero el
    // nombre del laboratorio al que se deriva **no aparece en este documento**:
    // es información comercial de la clínica, no del paciente. Queda visible
    // solo en la pantalla interna de la orden, que es donde hace falta.
    const entregaSection = order.expectedResultDate
      ? `#grid(columns: (2fr, 1fr), column-gutter: 14pt,
      field(${typstString('Resultado esperado')}, ${typstString(this.fmtDate(order.expectedResultDate))}),
    )`
      : '';

    // Sin ningún resultado el papel no es un informe, es la solicitud: la que
    // acompaña la muestra al laboratorio externo. Titularla "Resultado" sería
    // entregar un documento que dice lo contrario de lo que contiene.
    const algunResultado = items.some(i => !!i.resultedAt);
    const docLabel = algunResultado
      ? isSpecial ? 'Informe de Estudio' : 'Resultado de Laboratorio'
      : isSpecial ? 'Solicitud de Estudio' : 'Solicitud de Laboratorio';
    const docTitle = algunResultado
      ? `Resultados ${order.orderNumber}`
      : `Solicitud ${order.orderNumber}`;

    return `#import "/templates/bartolomed-base.typ": bartolomedDoc, header, metaBar, section, badge, field, sigRow, gris-texto, gris-muted, gris-claro, borde, borde-claro, fondo-raya, rojo, ambar

#show: bartolomedDoc.with(title: ${typstString(docTitle)}, paper: "us-letter")

#header(name: ${typstString(clinic?.name ?? 'Bartolomed')}, subtitle: ${typstString(`${clinic?.address ?? ''}${clinic?.phone ? ' · Tel. ' + clinic.phone : ''}`)}, badge: ${typstString(docLabel)})
#metaBar((
  (${typstString('N° Orden')}, ${typstString(order.orderNumber)}),
  (${typstString('Fecha de orden')}, ${typstString(this.fmtDate(order.orderDate))}),
  (${typstString('Estado')}, badge(${typstString(this.statusLabel(order.status))}, color: "${this.statusColor(order.status)}")),
  (${typstString('Procedencia')}, ${typstString(originLabel)}),
  (${typstString('Impreso')}, ${typstString(this.nowBO())}),
))

#pad(x: 28pt, y: 12pt)[
  ${partialWarning}
  #section(${typstString('Datos del Paciente')})[
    #grid(columns: (2fr, 1fr, 1fr), column-gutter: 14pt,
      field(${typstString('Paciente')}, ${typstString(this.patientLabel(order))}),
      field(${typstString('CI / Documento')}, ${typstString(patient?.documentNumber ?? '—')}),
      field(${typstString('Fecha de Nacimiento')}, ${typstString(this.fmtDate((patient as any)?.birthDate))}),
    )
    #grid(columns: (2fr, 1fr), column-gutter: 14pt,
      field(${typstString('Solicitado por')}, ${typstString(this.requesterName(order))}),
      field(${typstString('Tipo de solicitud')}, ${typstString(order.origin === LabOrderOrigin.EXTERNAL ? 'Externa — orden de otro consultorio o particular' : 'Indicación médica de la clínica')}),
    )
    ${entregaSection}
  ]

  #section(${typstString('Resultados')})[
    ${itemsTable}
  ]

  ${notesSection}

  #v(10pt)
  #sigRow((
    (name: ${typstString(this.enteredByLabel(items))}, role: ${typstString(isSpecial ? 'Responsable del estudio' : 'Responsable de laboratorio')}),
    (name: ${typstString('Firma y sello')}, role: ${typstString('Validación del informe')}),
  ))
]
`;
  }
}
