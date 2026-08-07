import { Injectable } from '@nestjs/common';
import { TypstCompilerService } from '../../pdf/typst-compiler.service';
import { typstString } from '../../pdf/utils/typst-escape.util';
import { ConsentPdfDto, SummaryPdfDto } from '../dto/pdf.dto';

const IMPORT_LINE =
  '#import "/templates/bartolomed-base.typ": bartolomedDoc, header, metaBar, section, field, sigRow, gris-texto, gris-muted';

@Injectable()
export class MedicalRecordsPdfService {
  constructor(private readonly typstCompiler: TypstCompilerService) {}

  // ─── API pública ─────────────────────────────────────────────────────────────

  async generateConsentPdf(dto: ConsentPdfDto): Promise<Buffer> {
    return this.typstCompiler.compile(this.consentTypst(dto));
  }

  async generateSummaryPdf(dto: SummaryPdfDto): Promise<Buffer> {
    return this.typstCompiler.compile(this.summaryTypst(dto));
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private val(v?: string | number | null): string {
    if (v === undefined || v === null || v === '') return '—';
    return String(v);
  }

  private fmtDate(d?: string | null): string {
    if (!d) return '—';
    try {
      return new Date(d).toLocaleDateString('es-BO', {
        timeZone: 'America/La_Paz', day: '2-digit', month: '2-digit', year: 'numeric',
      });
    } catch {
      return d;
    }
  }

  private nowBO(): string {
    return new Date().toLocaleString('es-BO', { timeZone: 'America/La_Paz' });
  }

  private calcBmi(w?: any, h?: any): string {
    const weight = parseFloat(String(w ?? ''));
    const height = parseFloat(String(h ?? '')) / 100;
    if (!weight || !height) return '—';
    return (weight / (height * height)).toFixed(1);
  }

  private consentTypeLabel(type: string): string {
    const map: Record<string, string> = {
      treatment: 'Tratamiento médico', surgery: 'Cirugía', anesthesia: 'Anestesia',
      blood_transfusion: 'Transfusión sanguínea', imaging: 'Diagnóstico por imagen',
      laboratory: 'Análisis de laboratorio', discharge: 'Alta médica',
      general: 'Consentimiento general', other: 'Otro',
    };
    return map[type] ?? type;
  }

  private recordTypeLabel(type: string): string {
    const map: Record<string, string> = {
      consultation: 'Consulta médica', emergency: 'Emergencia', surgery: 'Cirugía',
      follow_up: 'Seguimiento', laboratory: 'Laboratorio', imaging: 'Imagenología', other: 'Otro',
    };
    return map[type] ?? type;
  }

  /**
   * `field(label, value)` como llamada Typst — envuelve el valor con
   * `typstString` (nunca markup crudo). `multiline: true` usa la caja con
   * borde en vez de la línea inferior.
   */
  private fieldCall(label: string, value: unknown, multiline = false): string {
    return `field(${typstString(label)}, ${typstString(this.val(value as any))}${multiline ? ', multiline: true' : ''})`;
  }

  // ─── Consentimiento — Typst ────────────────────────────────────────────────

  private consentTypst(dto: ConsentPdfDto): string {
    const typeLabel = this.consentTypeLabel(dto.consentType);
    const date = dto.consentDate ?? new Date().toLocaleDateString('es-BO', { timeZone: 'America/La_Paz' });
    const time = dto.consentTime ?? new Date().toLocaleTimeString('es-BO', { timeZone: 'America/La_Paz' });
    const title = dto.title ?? `Consentimiento Informado — ${this.consentTypeLabel(dto.consentType)}`;

    const p = dto.patient;
    const d = dto.doctor;

    const patientSection = `#section(${typstString('Datos del Paciente')})[
    #grid(columns: (2fr, 1fr, 1fr), column-gutter: 14pt,
      ${this.fieldCall('Nombre completo', `${p.firstName} ${p.lastName}`.trim())},
      ${this.fieldCall('Nro. de identidad (CI)', p.documentNumber)},
      ${this.fieldCall('Fecha de nacimiento', this.fmtDate(p.birthDate))},
    )
    #grid(columns: (2fr, 1fr), column-gutter: 14pt,
      ${this.fieldCall('Domicilio', p.address)},
      ${this.fieldCall('Teléfono / Celular', p.phone)},
    )
  ]`;

    const doctorSection = `#section(${typstString('Médico Responsable')})[
    #grid(columns: (2fr, 1fr), column-gutter: 14pt,
      ${this.fieldCall('Nombre y apellidos', `Dr. ${d.firstName} ${d.lastName}`.trim())},
      ${this.fieldCall('Especialidad', d.specialization)},
    )
  ]`;

    let body: string;
    if (dto.printTemplate === 'surgery') body = this.surgeryBody(dto);
    else if (dto.printTemplate === 'blood_transfusion') body = this.transfusionBody(dto);
    else if (dto.printTemplate === 'rejection') body = this.rejectionBody(dto);
    else body = this.diagnosticBody(dto);

    const declarationSection = `#section(${typstString('Declaración y Consentimiento')})[
    #align(center)[
      #text(size: 10.5pt, weight: "bold", fill: navy, tracking: 0.5pt)[#upper(${typstString(title)})]
    ]
    #v(4pt)
    #line(length: 100%, stroke: 0.5pt + borde)
    #v(10pt)
    #block[
      #set par(justify: true, leading: 0.65em)
      #set text(size: 9.5pt)
${body}
    ]
  ]`;

    const witness =
      (dto.printTemplate === 'surgery' ? dto.surgeryWitnessName : dto.witnessName) ?? dto.signedBy ?? '_______________';
    const sigSection = `#sigRow((
    (name: ${typstString(`${p.firstName} ${p.lastName}`.trim())}, role: ${typstString('Paciente / Tutor legal')}),
    (name: ${typstString(witness)}, role: ${typstString('Testigo')}),
    (name: ${typstString(`Dr. ${d.firstName} ${d.lastName}`.trim())}, role: ${typstString(`Médico responsable — ${d.specialization ?? 'Especialidad'}`)}),
  ))`;

    return `${IMPORT_LINE}, badge, navy, borde

#show: bartolomedDoc.with(title: ${typstString('Consentimiento Informado')}, paper: "us-letter")

#header(name: ${typstString('BARTOLOMED')}, subtitle: ${typstString('Sistema de Gestión Clínica')}, badge: ${typstString('Consentimiento Informado')})
#metaBar((
  (${typstString('Fecha')}, ${typstString(date)}),
  (${typstString('Hora')}, ${typstString(time)}),
  (${typstString('Tipo')}, ${typstString(typeLabel)}),
  (${typstString('Generado')}, ${typstString(this.nowBO())}),
))

#pad(x: 28pt, y: 12pt)[
  ${patientSection}
  ${doctorSection}
  ${declarationSection}
  #v(10pt)
  ${sigSection}
]
`;
  }

  /** Cada `#p[...]` de estos 4 bodies es un párrafo Typst — el texto dinámico va siempre como argumento de función (typstString), interpolado vía `#var`, nunca embebido crudo. */
  private diagnosticBody(dto: ConsentPdfDto): string {
    const p = dto.patient;
    const d = dto.doctor;
    const proc = dto.procedureName ? this.strongVar('proc', dto.procedureName) : '';
    const procRef = dto.procedureName ? '#proc' : 'el procedimiento / tratamiento indicado';
    const lines: string[] = [];
    lines.push(this.letVar('nombrePaciente', `${p.firstName} ${p.lastName}`.trim()));
    lines.push(this.letVar('ci', this.val(p.documentNumber)));
    lines.push(this.letVar('nombreMedico', `${d.firstName} ${d.lastName}`.trim()));
    if (proc) lines.push(proc);
    lines.push(`Yo, *#nombrePaciente*, con CI Nro. *#ci*, en pleno uso de mis facultades mentales, declaro haber recibido información suficiente, clara y comprensible sobre mi estado de salud actual, el diagnóstico presunto o confirmado, las alternativas de tratamiento disponibles y los riesgos inherentes a ${procRef}.`);
    lines.push('');
    if (dto.objective) lines.push(this.labeledPara('Objetivo', dto.objective));
    if (dto.risks) lines.push(this.labeledPara('Riesgos informados', dto.risks));
    if (dto.benefits) lines.push(this.labeledPara('Beneficios esperados', dto.benefits));
    lines.push(`Habiendo comprendido la información proporcionada por *Dr./Dra. #nombreMedico*, *OTORGO MI CONSENTIMIENTO LIBRE, VOLUNTARIO E INFORMADO* para la realización del procedimiento indicado.`);
    lines.push('');
    lines.push('He tenido la oportunidad de formular todas las preguntas que he estimado pertinentes, las cuales han sido respondidas satisfactoriamente. Entiendo que puedo revocar este consentimiento en cualquier momento previo al inicio del procedimiento.');
    if (dto.description) { lines.push(''); lines.push(this.labeledPara('Observaciones', dto.description)); }
    return this.wrapBody(lines);
  }

  private surgeryBody(dto: ConsentPdfDto): string {
    const p = dto.patient;
    const d = dto.doctor;
    const lines: string[] = [];
    lines.push(this.letVar('nombrePaciente', `${p.firstName} ${p.lastName}`.trim()));
    lines.push(this.letVar('ci', this.val(p.documentNumber)));
    lines.push(this.letVar('nombreMedico', `${d.firstName} ${d.lastName}`.trim()));
    lines.push(`Yo, *#nombrePaciente*, con CI Nro. *#ci*, declaro que el equipo médico me ha informado sobre:`);
    lines.push('');
    if (dto.surgicalDiagnosis) lines.push(this.bulletPara('Diagnóstico quirúrgico', dto.surgicalDiagnosis));
    if (dto.surgicalProcedureName) lines.push(this.bulletPara('Procedimiento', dto.surgicalProcedureName));
    if (dto.surgeryObjective) lines.push(this.bulletPara('Objetivo', dto.surgeryObjective));
    if (dto.surgicalAlternatives) lines.push(this.bulletPara('Alternativas terapéuticas', dto.surgicalAlternatives));
    if (dto.consequencesNoSurgery) lines.push(this.bulletPara('Consecuencias de no intervenir', dto.consequencesNoSurgery));
    lines.push('Reconozco que toda intervención quirúrgica conlleva riesgos inherentes: hemorragia, infección, reacciones anestésicas, trombosis venosa profunda y otras complicaciones propias del procedimiento.');
    lines.push('');
    if (dto.leadSurgeonName) {
      lines.push(this.letVar('cirujano', dto.leadSurgeonName));
      lines.push(`Con esta información, *OTORGO MI CONSENTIMIENTO* para la intervención quirúrgica a cargo del Dr./Dra. #cirujano y su equipo, bajo anestesia a criterio del anestesiólogo responsable.`);
    } else {
      lines.push(`Con esta información, *OTORGO MI CONSENTIMIENTO* para la intervención quirúrgica a cargo del Dr./Dra. #nombreMedico y su equipo, bajo anestesia a criterio del anestesiólogo responsable.`);
    }
    lines.push('');
    lines.push('Autorizo al equipo médico a realizar los procedimientos adicionales que durante el acto quirúrgico resulten necesarios para preservar mi salud y vida.');
    return this.wrapBody(lines);
  }

  private transfusionBody(dto: ConsentPdfDto): string {
    const p = dto.patient;
    const lines: string[] = [];
    lines.push(this.letVar('nombrePaciente', `${p.firstName} ${p.lastName}`.trim()));
    lines.push(this.letVar('ci', this.val(p.documentNumber)));
    lines.push(`Yo, *#nombrePaciente*, con CI Nro. *#ci*, declaro haber sido informado/a sobre:`);
    lines.push('');
    if (dto.transfusionDiagnosis) lines.push(this.bulletPara('Diagnóstico', dto.transfusionDiagnosis));
    if (dto.bloodProductType) lines.push(this.bulletPara('Producto sanguíneo', dto.bloodProductType));
    if (dto.transfusionBenefits) lines.push(this.bulletPara('Beneficios esperados', dto.transfusionBenefits));
    if (dto.transfusionAlternatives) lines.push(this.bulletPara('Alternativas', dto.transfusionAlternatives));
    lines.push('Entiendo que la negativa a recibir la transfusión puede comportar riesgos graves para mi salud, incluyendo riesgo de muerte. En virtud de lo anterior, *OTORGO MI CONSENTIMIENTO LIBRE E INFORMADO* para la transfusión sanguínea o hemoderivados que el equipo médico considere necesaria.');
    return this.wrapBody(lines);
  }

  private rejectionBody(dto: ConsentPdfDto): string {
    const p = dto.patient;
    const d = dto.doctor;
    const lines: string[] = [];
    lines.push(this.letVar('nombrePaciente', `${p.firstName} ${p.lastName}`.trim()));
    lines.push(this.letVar('ci', this.val(p.documentNumber)));
    lines.push(this.letVar('nombreMedico', `${d.firstName} ${d.lastName}`.trim()));
    lines.push(this.letVar('institucion', dto.clinicName || 'la institución'));
    lines.push(`Yo, *#nombrePaciente*, con CI Nro. *#ci*, en plena capacidad mental y haciendo uso de mi derecho a la autodeterminación, declaro que:`);
    lines.push('');
    const diagPart = dto.rejectionDiagnosis ? this.letVar('diag', dto.rejectionDiagnosis) : '';
    const actPart = dto.rejectedActName ? this.letVar('acto', dto.rejectedActName) : '';
    if (diagPart) lines.push(diagPart);
    if (actPart) lines.push(actPart);
    const diagClause = dto.rejectionDiagnosis ? ' sobre el diagnóstico: *#diag*, y' : '';
    const actClause = dto.rejectedActName ? ' (*#acto*)' : '';
    lines.push(`He sido informado/a de manera clara y comprensible por *Dr./Dra. #nombreMedico*${diagClause} sobre el tratamiento recomendado${actClause} y sus consecuencias.`);
    if (dto.rejectionConsequences) { lines.push(''); lines.push(this.labeledPara('Consecuencias informadas', dto.rejectionConsequences)); }
    lines.push('');
    lines.push('No obstante lo anterior, en ejercicio de mi voluntad libre y soberana, *RECHAZO el tratamiento / procedimiento indicado*, liberando al personal de salud y a #institucion de toda responsabilidad derivada de mi decisión. Este rechazo ha sido expresado de manera voluntaria, sin presión ni coacción alguna.');
    return this.wrapBody(lines);
  }

  /** `#let nombre = "valor escapado"` — se interpola después vía `#nombre` en markup, nunca reinterpretado como sintaxis Typst. */
  private letVar(name: string, value: string): string {
    return `#let ${name} = ${typstString(value)}`;
  }

  private strongVar(name: string, value: string): string {
    return this.letVar(name, value);
  }

  private labeledPara(label: string, value: string): string {
    return `#let _tmp = ${typstString(value)}\n*${label}:* #_tmp\n`;
  }

  private bulletPara(label: string, value: string): string {
    return `#let _tmp = ${typstString(value)}\n• #h(4pt) *${label}:* #_tmp\n`;
  }

  private wrapBody(lines: string[]): string {
    return lines.join('\n\n');
  }

  // ─── Resumen — Typst ─────────────────────────────────────────────────────────

  private summaryTypst(dto: SummaryPdfDto): string {
    const typeLabel = this.recordTypeLabel(dto.recordType);
    const p = dto.patient;
    const d = dto.doctor;

    const patientDoctorSection = `#section(${typstString('Información del Paciente y Médico')})[
    #grid(columns: (2fr, 1fr, 1fr), column-gutter: 14pt,
      ${this.fieldCall('Paciente', `${p.firstName} ${p.lastName}`.trim())},
      ${this.fieldCall('Nro. CI', p.documentNumber)},
      ${this.fieldCall('Fecha de nacimiento', this.fmtDate(p.birthDate))},
    )
    #grid(columns: (2fr, 1fr), column-gutter: 14pt,
      ${this.fieldCall('Domicilio', p.address)},
      ${this.fieldCall('Teléfono', p.phone)},
    )
    #grid(columns: (1fr, 1fr), column-gutter: 14pt,
      ${this.fieldCall('Médico tratante', `Dr. ${d.firstName} ${d.lastName}`.trim())},
      ${this.fieldCall('Especialidad', d.specialization)},
    )
  ]`;

    const chiefComplaintSection = `#section(${typstString('Motivo de Consulta')})[
    #${this.fieldCall('Motivo principal', dto.chiefComplaint, true)}
    ${dto.historyOfPresentIllness ? `#${this.fieldCall('Historia de la enfermedad actual', dto.historyOfPresentIllness, true)}` : ''}
  ]`;

    const hasHistory = dto.pastMedicalHistory || dto.medications || dto.allergies || dto.socialHistory || dto.familyHistory || dto.reviewOfSystems;
    const historySection = hasHistory
      ? `#section(${typstString('Antecedentes e Historia Médica')})[
    ${dto.pastMedicalHistory ? `#${this.fieldCall('Antecedentes médicos', dto.pastMedicalHistory, true)}` : ''}
    #grid(columns: (1fr, 1fr), column-gutter: 14pt,
      ${dto.medications ? this.fieldCall('Medicación actual', dto.medications, true) : '[]'},
      ${dto.allergies ? this.fieldCall('Alergias', dto.allergies, true) : '[]'},
    )
    #grid(columns: (1fr, 1fr), column-gutter: 14pt,
      ${dto.socialHistory ? this.fieldCall('Historia social', dto.socialHistory, true) : '[]'},
      ${dto.familyHistory ? this.fieldCall('Antecedentes familiares', dto.familyHistory, true) : '[]'},
    )
    ${dto.reviewOfSystems ? `#${this.fieldCall('Revisión por sistemas', dto.reviewOfSystems, true)}` : ''}
  ]`
      : '';

    const vs: any = dto.vitalSigns ?? {};
    const hasVitals = dto.vitalSigns && Object.values(dto.vitalSigns).some(v => v !== undefined && v !== null && v !== '');
    const v = (val?: any) => (val !== undefined && val !== null && val !== '') ? String(val) : '—';
    const vitalsSection = hasVitals
      ? `#section(${typstString('Signos Vitales')})[
    #table(
      columns: (1fr, 1fr, 1fr, 1fr, 1fr, 1fr, 1fr, 1fr, 1fr),
      stroke: 0.5pt + borde,
      align: center,
      table.header(
        text(size: 7pt, weight: "bold", "Temp. °C"), text(size: 7pt, weight: "bold", "PA Sist."),
        text(size: 7pt, weight: "bold", "PA Diast."), text(size: 7pt, weight: "bold", "FC (lpm)"),
        text(size: 7pt, weight: "bold", "FR (rpm)"), text(size: 7pt, weight: "bold", [SpO#sub[2] %]),
        text(size: 7pt, weight: "bold", "Peso kg"), text(size: 7pt, weight: "bold", "Talla cm"),
        text(size: 7pt, weight: "bold", "IMC"),
      ),
      ${typstString(v(vs.temperature))}, ${typstString(v(vs.systolicBP))}, ${typstString(v(vs.diastolicBP))},
      ${typstString(v(vs.heartRate))}, ${typstString(v(vs.respiratoryRate))}, ${typstString(v(vs.oxygenSaturation))},
      ${typstString(v(vs.weight))}, ${typstString(v(vs.height))}, ${typstString(v(vs.bmi) !== '—' ? v(vs.bmi) : this.calcBmi(vs.weight, vs.height))},
    )
  ]`
      : '';

    const hasExam = dto.physicalExamination || dto.generalAppearance || dto.heent || dto.cardiovascular || dto.respiratory || dto.abdominal || dto.neurological;
    const examSection = hasExam
      ? `#section(${typstString('Examen Físico')})[
    ${dto.physicalExamination ? `#${this.fieldCall('Examen físico general', dto.physicalExamination, true)}` : ''}
    ${dto.generalAppearance ? `#${this.fieldCall('Aspecto general', dto.generalAppearance, true)}` : ''}
    #grid(columns: (1fr, 1fr), column-gutter: 14pt,
      ${dto.heent ? this.fieldCall('Cabeza / Cuello / ORL', dto.heent, true) : '[]'},
      ${dto.cardiovascular ? this.fieldCall('Cardiovascular', dto.cardiovascular, true) : '[]'},
    )
    #grid(columns: (1fr, 1fr), column-gutter: 14pt,
      ${dto.respiratory ? this.fieldCall('Respiratorio', dto.respiratory, true) : '[]'},
      ${dto.abdominal ? this.fieldCall('Abdomen', dto.abdominal, true) : '[]'},
    )
    #grid(columns: (1fr, 1fr, 1fr), column-gutter: 14pt,
      ${dto.neurological ? this.fieldCall('Neurológico', dto.neurological, true) : '[]'},
      ${dto.musculoskeletal ? this.fieldCall('Musculoesquelético', dto.musculoskeletal, true) : '[]'},
      ${dto.skin ? this.fieldCall('Piel', dto.skin, true) : '[]'},
    )
  ]`
      : '';

    const hasAssessment = dto.assessment || dto.diagnosis || dto.differentialDiagnosis;
    const assessmentSection = hasAssessment
      ? `#section(${typstString('Evaluación y Diagnóstico')})[
    ${dto.assessment ? `#${this.fieldCall('Evaluación clínica', dto.assessment, true)}` : ''}
    #grid(columns: (1fr, 1fr), column-gutter: 14pt,
      ${dto.diagnosis ? this.fieldCall('Diagnóstico', dto.diagnosis, true) : '[]'},
      ${dto.differentialDiagnosis ? this.fieldCall('Diagnóstico diferencial', dto.differentialDiagnosis, true) : '[]'},
    )
  ]`
      : '';

    const hasPlan = dto.plan || dto.treatmentPlan || dto.followUpInstructions || dto.patientEducation || dto.followUpDate;
    const planSection = hasPlan
      ? `#section(${typstString('Plan y Seguimiento')})[
    ${dto.plan ? `#${this.fieldCall('Plan general', dto.plan, true)}` : ''}
    ${dto.treatmentPlan ? `#${this.fieldCall('Plan de tratamiento', dto.treatmentPlan, true)}` : ''}
    ${dto.followUpInstructions ? `#${this.fieldCall('Instrucciones de seguimiento', dto.followUpInstructions, true)}` : ''}
    ${dto.patientEducation ? `#${this.fieldCall('Educación al paciente', dto.patientEducation, true)}` : ''}
    ${dto.followUpDate ? `#${this.fieldCall('Próxima cita', this.fmtDate(dto.followUpDate))}` : ''}
  ]`
      : '';

    const notesSection = dto.notes
      ? `#section(${typstString('Notas Adicionales')})[
    #${this.fieldCall('Notas', dto.notes, true)}
  ]`
      : '';

    const sigSection = `#sigRow((
    (name: ${typstString(`${p.firstName} ${p.lastName}`.trim())}, role: ${typstString('Paciente')}),
    (name: ${typstString('_______________')}, role: ${typstString('Testigo')}),
    (name: ${typstString(`Dr. ${d.firstName} ${d.lastName}`.trim())}, role: ${typstString(`Médico tratante — ${d.specialization ?? 'Especialidad'}`)}),
  ))`;

    return `${IMPORT_LINE}, borde

#show: bartolomedDoc.with(title: ${typstString('Resumen de Consulta')}, paper: "us-letter")

#header(name: ${typstString('BARTOLOMED')}, subtitle: ${typstString('Sistema de Gestión Clínica')}, badge: ${typstString('Resumen de Consulta')})
#metaBar((
  (${typstString('Tipo')}, [#${typstString(typeLabel)}${dto.isEmergency ? ` #text(fill: rgb("#dc2626"), weight: "bold")[■ EMERGENCIA]` : ''}]),
  (${typstString('Generado')}, ${typstString(this.nowBO())}),
))

#pad(x: 28pt, y: 12pt)[
  ${patientDoctorSection}
  ${chiefComplaintSection}
  ${historySection}
  ${vitalsSection}
  ${examSection}
  ${assessmentSection}
  ${planSection}
  ${notesSection}
  #v(10pt)
  ${sigSection}
]
`;
  }
}
