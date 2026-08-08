import { Injectable } from '@nestjs/common';
import { formatPlainDate, nowInClinicTz } from '../common/utils/date-format.util';
import { TypstCompilerService } from '../pdf/typst-compiler.service';
import { typstString } from '../pdf/utils/typst-escape.util';
import { Prescription } from './entities/prescription.entity';

@Injectable()
export class PrescriptionsPdfService {
  constructor(private readonly typstCompiler: TypstCompilerService) {}

  async generate(prescription: Prescription): Promise<Buffer> {
    return this.typstCompiler.compile(this.prescriptionTypst(prescription));
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  /**
   * `prescriptionDate`, `expiryDate` y `birthDate` son columnas `date`: días
   * del calendario. Formatearlas en hora de la clínica las retrasaba un día
   * (una receta emitida el 07/08 se imprimía como 06/08). Ver el util.
   */
  private fmtDate(d: Date | string | null | undefined): string {
    return formatPlainDate(d);
  }

  private nowBO(): string {
    return nowInClinicTz();
  }

  private statusLabel(s: string): string {
    const map: Record<string, string> = {
      draft: 'Borrador', active: 'Activa', dispensed: 'Dispensada',
      completed: 'Completada', cancelled: 'Cancelada', expired: 'Expirada',
    };
    return map[s] ?? s;
  }

  private statusColor(s: string): string {
    const map: Record<string, string> = {
      draft: 'gray', active: 'green', dispensed: 'blue',
      completed: 'purple', cancelled: 'red', expired: 'amber',
    };
    return map[s] ?? 'gray';
  }

  private dosageFormLabel(f: string): string {
    const map: Record<string, string> = {
      tableta: 'Tableta', cápsula: 'Cápsula', jarabe: 'Jarabe', suspensión: 'Suspensión',
      inyectable: 'Inyectable', crema: 'Crema', ungüento: 'Ungüento', gotas: 'Gotas', supositorio: 'Supositorio',
    };
    return map[f] ?? f;
  }

  // ─── Typst ──────────────────────────────────────────────────────────────────
  // Todo el contenido dinámico (nombres de medicamentos, instrucciones, notas)
  // se pasa como ARGUMENTO de función Typst (vía typstString), nunca embebido
  // directo dentro de un bloque `[...]` de markup — un `[...]` SÍ reinterpreta
  // el texto como sintaxis Typst (`*`, `#`, `[`, etc.), así que texto de
  // usuario ahí sería una inyección de markup. `#texto` interpolando un
  // parámetro string, en cambio, siempre se imprime literal.

  private prescriptionTypst(p: Prescription): string {
    const patient = p.patient;
    const doctor = p.doctor;
    const clinic = p.clinic;

    const doctorName = doctor
      ? `Dr. ${doctor.personalInfo?.firstName ?? ''} ${doctor.personalInfo?.lastName ?? ''}`.trim()
      : '—';
    const doctorSpecialty = doctor?.professionalInfo?.specialization ?? '';
    const patientName = patient ? `${patient.firstName} ${patient.lastName}` : '—';

    const itemRows = (p.items || []).map((it, i) => {
      const detail = `${it.strength} · ${this.dosageFormLabel(it.dosageForm ?? '')} · Vía ${it.route ?? 'oral'}`;
      const cellParts = [
        `strong(${typstString(it.medicationName)})`,
        `text(size: 7.5pt, fill: gris-muted, ${typstString(detail)})`,
      ];
      if (it.instructions) {
        cellParts.push(`text(size: 7.5pt, fill: gris-texto, style: "italic", ${typstString(it.instructions)})`);
      }
      return `align(center, strong(${typstString(String(i + 1))})),
      stack(dir: ttb, spacing: 2pt, ${cellParts.join(', ')}),
      align(center, ${typstString(it.quantity)}),
      align(center, ${typstString(it.dosage)}),
      align(center, ${typstString(it.frequency)}),
      align(center, ${typstString(it.duration ? `${it.duration} días` : '—')})`;
    });

    const itemsTable = itemRows.length > 0
      ? `#table(
    columns: (24pt, 1fr, 55pt, 60pt, 75pt, 55pt),
    stroke: 0.5pt + borde-claro,
    fill: (_, y) => if y == 0 { rgb("#f3f4f6") } else if calc.rem(y, 2) == 0 { fondo-raya } else { white },
    table.header(
      align(center, text(size: 7.5pt, weight: "bold", upper("#"))),
      text(size: 7.5pt, weight: "bold", upper("Medicamento · Concentración · Forma")),
      align(center, text(size: 7.5pt, weight: "bold", upper("Cantidad"))),
      align(center, text(size: 7.5pt, weight: "bold", upper("Dosis"))),
      align(center, text(size: 7.5pt, weight: "bold", upper("Frecuencia"))),
      align(center, text(size: 7.5pt, weight: "bold", upper("Duración"))),
    ),
    ${itemRows.join(',\n    ')},
  )`
      : `#align(center, text(size: 9pt, fill: gris-claro, "Sin medicamentos"))`;

    const notesSection = p.notes
      ? `#section(${typstString('Notas e Indicaciones')})[
  #block(width: 100%, stroke: 1pt + borde, radius: 2pt, inset: (x: 7pt, y: 5pt), text(size: 9pt, ${typstString(p.notes)}))
]`
      : '';

    return `#import "/templates/bartolomed-base.typ": bartolomedDoc, header, metaBar, section, badge, field, sigRow, gris-texto, gris-muted, gris-claro, borde, borde-claro, fondo-raya

#show: bartolomedDoc.with(title: ${typstString(`Receta ${p.prescriptionNumber}`)}, paper: "us-letter")

#header(name: ${typstString(clinic?.name ?? 'Bartolomed')}, subtitle: ${typstString(`${clinic?.address ?? ''}${clinic?.phone ? ' · Tel. ' + clinic.phone : ''}`)}, badge: ${typstString('Receta Médica')})
#metaBar((
  (${typstString('N° Receta')}, ${typstString(p.prescriptionNumber)}),
  (${typstString('Emisión')}, ${typstString(this.fmtDate(p.prescriptionDate))}),
  (${typstString('Vence')}, ${typstString(this.fmtDate(p.expiryDate))}),
  (${typstString('Estado')}, badge(${typstString(this.statusLabel(p.status))}, color: "${this.statusColor(p.status)}")),
  (${typstString('Impreso')}, ${typstString(this.nowBO())}),
))

#pad(x: 28pt, y: 12pt)[
  #section(${typstString('Datos del Paciente y Médico')})[
    #grid(columns: (2fr, 1fr, 1fr), column-gutter: 14pt,
      field(${typstString('Paciente')}, ${typstString(patientName)}),
      field(${typstString('CI / Documento')}, ${typstString(patient?.documentNumber ?? '—')}),
      field(${typstString('Fecha de Nacimiento')}, ${typstString(this.fmtDate((patient as any)?.birthDate))}),
    )
    #grid(columns: (2fr, 1fr, 1fr), column-gutter: 14pt,
      field(${typstString('Médico Prescriptor')}, ${typstString(doctorName)}),
      field(${typstString('Especialidad')}, ${typstString(doctorSpecialty || '—')}),
      field(${typstString('Matrícula / Reg.')}, ${typstString(doctor?.professionalInfo?.license ?? '—')}),
    )
  ]

  #section(${typstString('Medicamentos Prescritos')})[
    ${itemsTable}
  ]

  ${notesSection}

  #v(10pt)
  #sigRow((
    (name: ${typstString(doctorName)}, role: ${typstString(doctorSpecialty || 'Médico prescriptor')}),
    (name: ${typstString('Firma del Paciente o Responsable')}, role: ${typstString(`CI: ${patient?.documentNumber ?? '—'}`)}),
    (name: ${typstString('Sello de la Farmacia')}, role: ${typstString('Fecha de dispensación')}),
  ))
]
`;
  }
}
