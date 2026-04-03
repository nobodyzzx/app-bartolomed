import { Injectable } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import puppeteer from 'puppeteer-core';
import { ConsentPdfDto, SummaryPdfDto } from '../dto/pdf.dto';

@Injectable()
export class MedicalRecordsPdfService {
  private readonly logo64: string;

  constructor() {
    try {
      this.logo64 = readFileSync(
        join(process.cwd(), 'public', 'images', 'logo.png'),
      ).toString('base64');
    } catch {
      this.logo64 = '';
    }
  }

  // ─── API pública ─────────────────────────────────────────────────────────────

  async generateConsentPdf(dto: ConsentPdfDto): Promise<Buffer> {
    return this.render(this.consentHtml(dto));
  }

  async generateSummaryPdf(dto: SummaryPdfDto): Promise<Buffer> {
    return this.render(this.summaryHtml(dto));
  }

  // ─── Puppeteer ───────────────────────────────────────────────────────────────

  private async render(html: string): Promise<Buffer> {
    const browser = await puppeteer.launch({
      executablePath:
        process.env.PUPPETEER_EXECUTABLE_PATH ?? '/usr/bin/chromium',
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
      ],
    });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const buf = await page.pdf({
        format: 'letter',
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: '<div></div>',
        footerTemplate: `<div style="
          width:100%;padding:0 28px;
          display:flex;justify-content:space-between;align-items:center;
          font-family:Arial,Helvetica,sans-serif;font-size:10px;color:#94a3b8;
          border-top:1px solid #e2e8f0;
        ">
          <span>BARTOLOMED — Sistema de Gestión Clínica</span>
          <span>Página <span class="pageNumber"></span> de <span class="totalPages"></span></span>
          <span>Documento confidencial</span>
        </div>`,
        margin: { top: '0', right: '0', bottom: '14mm', left: '0' },
      });
      return Buffer.from(buf);
    } finally {
      await browser.close();
    }
  }

  // ─── CSS común ───────────────────────────────────────────────────────────────

  private css(): string {
    return `
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:Arial,Helvetica,sans-serif;font-size:9.5pt;color:#111;line-height:1.45}

      /* ── Cabecera: solo borde inferior, sin fondo de color ── */
      .hd{border-bottom:2.5px solid #1e3a5f;padding:12px 28px;display:flex;align-items:center;gap:14px}
      .hd-logo{width:46px;height:46px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
      .hd-logo img{width:44px;height:44px;object-fit:contain}
      .hd-text{flex:1}
      .hd-name{font-size:17pt;font-weight:bold;letter-spacing:1.5px;color:#1e3a5f;line-height:1.2}
      .hd-sub{font-size:8pt;color:#475569;text-transform:uppercase;letter-spacing:.8px;margin-top:1px}
      .hd-badge{border:1.5px solid #1e3a5f;border-radius:4px;padding:5px 12px;font-size:8.5pt;font-weight:bold;color:#1e3a5f;text-align:center;text-transform:uppercase;letter-spacing:.6px;white-space:nowrap}

      /* ── Barra de meta-datos ── */
      .meta{border-bottom:1px solid #d1d5db;padding:4px 28px;display:flex;gap:20px;font-size:8pt;color:#374151}

      /* ── Contenido ── */
      .cnt{padding:14px 28px}

      /* ── Sección: acento izquierdo en lugar de fondo sólido ── */
      .sec{margin-bottom:12px;border:1px solid #d1d5db;border-radius:3px}
      .sec-hd{border-left:3px solid #1e3a5f;padding:4px 8px;font-size:7.5pt;font-weight:bold;text-transform:uppercase;letter-spacing:.8px;color:#1e3a5f;background:#f8fafc}
      .sec-bd{padding:10px 12px}

      /* ── Grid ── */
      .row{display:flex;gap:14px;margin-bottom:7px}
      .row:last-child{margin-bottom:0}
      .col{flex:1}
      .col2{flex:2}
      .col3{flex:3}
      .lbl{font-size:7pt;font-weight:bold;color:#6b7280;text-transform:uppercase;letter-spacing:.4px;margin-bottom:2px}
      .val{font-size:9.5pt;color:#111;border-bottom:1px solid #9ca3af;padding-bottom:2px;min-height:15px}
      .val-box{font-size:9pt;color:#111;border:1px solid #d1d5db;border-radius:2px;padding:5px 7px;min-height:36px;line-height:1.5;white-space:pre-wrap}

      /* ── Texto de consentimiento ── */
      .consent{font-size:9.5pt;line-height:1.7;text-align:justify;color:#111}
      .consent p{margin-bottom:9px}
      .consent p:last-child{margin-bottom:0}
      .consent .doc-title{font-size:10.5pt;font-weight:bold;text-align:center;text-transform:uppercase;margin-bottom:14px;color:#1e3a5f;letter-spacing:.5px;border-bottom:1px solid #d1d5db;padding-bottom:8px}

      /* ── Tabla de signos vitales ── */
      .vt{width:100%;border-collapse:collapse}
      .vt th{border:1px solid #9ca3af;padding:5px 7px;font-size:7.5pt;font-weight:bold;text-align:center;text-transform:uppercase;letter-spacing:.4px;background:#f3f4f6;color:#111}
      .vt td{padding:5px 7px;border:1px solid #d1d5db;text-align:center;font-size:9.5pt}

      /* ── Firmas ── */
      .sigs{display:flex;gap:24px;margin-top:8px}
      .sig{flex:1;text-align:center}
      .sig-sp{height:48px;border-bottom:1px solid #374151;margin-bottom:5px}
      .sig-nm{font-size:9pt;font-weight:bold}
      .sig-rl{font-size:7.5pt;color:#6b7280;margin-top:2px}

      @page{size:letter;margin:0}
      @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
    `;
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private esc(s?: string | null): string {
    if (!s) return '';
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  private val(v?: string | number | null): string {
    if (v === undefined || v === null || v === '') return '&mdash;';
    return this.esc(String(v));
  }

  private field(label: string, value: any, multiline = false): string {
    const cls = multiline ? 'val-box' : 'val';
    return `<div><div class="lbl">${label}</div><div class="${cls}">${this.val(value)}</div></div>`;
  }

  private fmtDate(d?: string | null): string {
    if (!d) return '—';
    try {
      return new Date(d).toLocaleDateString('es-BO', {
        timeZone: 'America/La_Paz',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
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

  private header(title: string): string {
    const logoTag = this.logo64
      ? `<div class="hd-logo"><img src="data:image/png;base64,${this.logo64}" alt="logo"></div>`
      : '';
    return `<div class="hd">
      ${logoTag}
      <div class="hd-text">
        <div class="hd-name">BARTOLOMED</div>
        <div class="hd-sub">Sistema de Gestión Clínica</div>
      </div>
      <div style="flex:1"></div>
      <div class="hd-badge">${this.esc(title)}</div>
    </div>`;
  }

  // ─── Consentimiento HTML ──────────────────────────────────────────────────────

  private consentHtml(dto: ConsentPdfDto): string {
    const typeLabel = this.consentTypeLabel(dto.consentType);
    const date = dto.consentDate ?? new Date().toLocaleDateString('es-BO', { timeZone: 'America/La_Paz' });
    const time = dto.consentTime ?? new Date().toLocaleTimeString('es-BO', { timeZone: 'America/La_Paz' });

    return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
    <style>${this.css()}</style></head><body>
      ${this.header('Consentimiento Informado')}
      <div class="meta">
        <span><b>Fecha:</b>&nbsp;${this.esc(date)}</span>
        <span><b>Hora:</b>&nbsp;${this.esc(time)}</span>
        <span><b>Tipo:</b>&nbsp;${this.esc(typeLabel)}</span>
        <span><b>Generado:</b>&nbsp;${this.nowBO()}</span>
      </div>
      <div class="cnt">
        ${this.consentPatientSection(dto)}
        ${this.consentDoctorSection(dto)}
        ${this.consentBodySection(dto)}
        ${this.consentSignatures(dto)}
      </div>
    </body></html>`;
  }

  private consentPatientSection(dto: ConsentPdfDto): string {
    const p = dto.patient;
    return `<div class="sec">
      <div class="sec-hd">Datos del Paciente</div>
      <div class="sec-bd">
        <div class="row">
          <div class="col2">${this.field('Nombre completo', `${p.firstName} ${p.lastName}`.trim())}</div>
          <div class="col">${this.field('Nro. de identidad (CI)', p.documentNumber)}</div>
          <div class="col">${this.field('Fecha de nacimiento', this.fmtDate(p.birthDate))}</div>
        </div>
        <div class="row">
          <div class="col2">${this.field('Domicilio', p.address)}</div>
          <div class="col">${this.field('Teléfono / Celular', p.phone)}</div>
        </div>
      </div>
    </div>`;
  }

  private consentDoctorSection(dto: ConsentPdfDto): string {
    const d = dto.doctor;
    return `<div class="sec">
      <div class="sec-hd">Médico Responsable</div>
      <div class="sec-bd">
        <div class="row">
          <div class="col2">${this.field('Nombre y apellidos', `Dr. ${d.firstName} ${d.lastName}`.trim())}</div>
          <div class="col">${this.field('Especialidad', d.specialization)}</div>
        </div>
      </div>
    </div>`;
  }

  private consentBodySection(dto: ConsentPdfDto): string {
    const tpl = dto.printTemplate;
    const title = dto.title ?? `Consentimiento Informado — ${this.consentTypeLabel(dto.consentType)}`;
    let body = '';
    if (tpl === 'surgery') body = this.surgeryCBody(dto);
    else if (tpl === 'blood_transfusion') body = this.transfusionCBody(dto);
    else if (tpl === 'rejection') body = this.rejectionCBody(dto);
    else body = this.diagnosticCBody(dto);

    return `<div class="sec">
      <div class="sec-hd">Declaración y Consentimiento</div>
      <div class="sec-bd">
        <div class="consent">
          <div class="doc-title">${this.esc(title)}</div>
          ${body}
        </div>
      </div>
    </div>`;
  }

  private diagnosticCBody(dto: ConsentPdfDto): string {
    const p = dto.patient;
    const d = dto.doctor;
    const proc = dto.procedureName
      ? `<strong>${this.esc(dto.procedureName)}</strong>`
      : 'el procedimiento / tratamiento indicado';
    return `
      <p>Yo, <strong>${this.esc(`${p.firstName} ${p.lastName}`.trim())}</strong>, con CI Nro. <strong>${this.val(p.documentNumber)}</strong>, en pleno uso de mis facultades mentales, declaro haber recibido información suficiente, clara y comprensible sobre mi estado de salud actual, el diagnóstico presunto o confirmado, las alternativas de tratamiento disponibles y los riesgos inherentes a ${proc}.</p>
      ${dto.objective ? `<p><strong>Objetivo:</strong> ${this.esc(dto.objective)}</p>` : ''}
      ${dto.risks ? `<p><strong>Riesgos informados:</strong> ${this.esc(dto.risks)}</p>` : ''}
      ${dto.benefits ? `<p><strong>Beneficios esperados:</strong> ${this.esc(dto.benefits)}</p>` : ''}
      <p>Habiendo comprendido la información proporcionada por <strong>Dr./Dra. ${this.esc(`${d.firstName} ${d.lastName}`.trim())}</strong>, <strong>OTORGO MI CONSENTIMIENTO LIBRE, VOLUNTARIO E INFORMADO</strong> para la realización del procedimiento indicado.</p>
      <p>He tenido la oportunidad de formular todas las preguntas que he estimado pertinentes, las cuales han sido respondidas satisfactoriamente. Entiendo que puedo revocar este consentimiento en cualquier momento previo al inicio del procedimiento.</p>
      ${dto.description ? `<p><strong>Observaciones:</strong> ${this.esc(dto.description)}</p>` : ''}`;
  }

  private surgeryCBody(dto: ConsentPdfDto): string {
    const p = dto.patient;
    const d = dto.doctor;
    return `
      <p>Yo, <strong>${this.esc(`${p.firstName} ${p.lastName}`.trim())}</strong>, con CI Nro. <strong>${this.val(p.documentNumber)}</strong>, declaro que el equipo médico me ha informado sobre:</p>
      ${dto.surgicalDiagnosis ? `<p>&#8227;&nbsp;<strong>Diagnóstico quirúrgico:</strong> ${this.esc(dto.surgicalDiagnosis)}</p>` : ''}
      ${dto.surgicalProcedureName ? `<p>&#8227;&nbsp;<strong>Procedimiento:</strong> ${this.esc(dto.surgicalProcedureName)}</p>` : ''}
      ${dto.surgeryObjective ? `<p>&#8227;&nbsp;<strong>Objetivo:</strong> ${this.esc(dto.surgeryObjective)}</p>` : ''}
      ${dto.surgicalAlternatives ? `<p>&#8227;&nbsp;<strong>Alternativas terapéuticas:</strong> ${this.esc(dto.surgicalAlternatives)}</p>` : ''}
      ${dto.consequencesNoSurgery ? `<p>&#8227;&nbsp;<strong>Consecuencias de no intervenir:</strong> ${this.esc(dto.consequencesNoSurgery)}</p>` : ''}
      <p>Reconozco que toda intervención quirúrgica conlleva riesgos inherentes: hemorragia, infección, reacciones anestésicas, trombosis venosa profunda y otras complicaciones propias del procedimiento.</p>
      <p>Con esta información, <strong>OTORGO MI CONSENTIMIENTO</strong> para la intervención quirúrgica${dto.leadSurgeonName ? ` a cargo del Dr./Dra. ${this.esc(dto.leadSurgeonName)}` : ` a cargo del Dr./Dra. ${this.esc(`${d.firstName} ${d.lastName}`.trim())}`} y su equipo, bajo anestesia a criterio del anestesiólogo responsable.</p>
      <p>Autorizo al equipo médico a realizar los procedimientos adicionales que durante el acto quirúrgico resulten necesarios para preservar mi salud y vida.</p>`;
  }

  private transfusionCBody(dto: ConsentPdfDto): string {
    const p = dto.patient;
    return `
      <p>Yo, <strong>${this.esc(`${p.firstName} ${p.lastName}`.trim())}</strong>, con CI Nro. <strong>${this.val(p.documentNumber)}</strong>, declaro haber sido informado/a sobre:</p>
      ${dto.transfusionDiagnosis ? `<p>&#8227;&nbsp;<strong>Diagnóstico:</strong> ${this.esc(dto.transfusionDiagnosis)}</p>` : ''}
      ${dto.bloodProductType ? `<p>&#8227;&nbsp;<strong>Producto sanguíneo:</strong> ${this.esc(dto.bloodProductType)}</p>` : ''}
      ${dto.transfusionBenefits ? `<p>&#8227;&nbsp;<strong>Beneficios esperados:</strong> ${this.esc(dto.transfusionBenefits)}</p>` : ''}
      ${dto.transfusionAlternatives ? `<p>&#8227;&nbsp;<strong>Alternativas:</strong> ${this.esc(dto.transfusionAlternatives)}</p>` : ''}
      <p>Entiendo que la negativa a recibir la transfusión puede comportar riesgos graves para mi salud, incluyendo riesgo de muerte. En virtud de lo anterior, <strong>OTORGO MI CONSENTIMIENTO LIBRE E INFORMADO</strong> para la transfusión sanguínea o hemoderivados que el equipo médico considere necesaria.</p>`;
  }

  private rejectionCBody(dto: ConsentPdfDto): string {
    const p = dto.patient;
    const d = dto.doctor;
    return `
      <p>Yo, <strong>${this.esc(`${p.firstName} ${p.lastName}`.trim())}</strong>, con CI Nro. <strong>${this.val(p.documentNumber)}</strong>, en plena capacidad mental y haciendo uso de mi derecho a la autodeterminación, declaro que:</p>
      <p>He sido informado/a de manera clara y comprensible por <strong>Dr./Dra. ${this.esc(`${d.firstName} ${d.lastName}`.trim())}</strong>${dto.rejectionDiagnosis ? ` sobre el diagnóstico: <strong>${this.esc(dto.rejectionDiagnosis)}</strong>, y` : ''} sobre el tratamiento recomendado${dto.rejectedActName ? ` (<strong>${this.esc(dto.rejectedActName)}</strong>)` : ''} y sus consecuencias.</p>
      ${dto.rejectionConsequences ? `<p><strong>Consecuencias informadas:</strong> ${this.esc(dto.rejectionConsequences)}</p>` : ''}
      <p>No obstante lo anterior, en ejercicio de mi voluntad libre y soberana, <strong>RECHAZO el tratamiento / procedimiento indicado</strong>, liberando al personal de salud y a ${this.esc(dto.clinicName) || 'la institución'} de toda responsabilidad derivada de mi decisión. Este rechazo ha sido expresado de manera voluntaria, sin presión ni coacción alguna.</p>`;
  }

  private consentSignatures(dto: ConsentPdfDto): string {
    const p = dto.patient;
    const d = dto.doctor;
    const witness =
      (dto.printTemplate === 'surgery' ? dto.surgeryWitnessName : dto.witnessName) ??
      dto.signedBy ??
      '_______________';

    return `<div class="sec">
      <div class="sec-hd">Firmas</div>
      <div class="sec-bd">
        <div class="sigs">
          <div class="sig">
            <div class="sig-sp"></div>
            <div class="sig-nm">${this.esc(`${p.firstName} ${p.lastName}`.trim())}</div>
            <div class="sig-rl">Paciente / Tutor legal</div>
          </div>
          <div class="sig">
            <div class="sig-sp"></div>
            <div class="sig-nm">${this.esc(witness)}</div>
            <div class="sig-rl">Testigo</div>
          </div>
          <div class="sig">
            <div class="sig-sp"></div>
            <div class="sig-nm">Dr. ${this.esc(`${d.firstName} ${d.lastName}`.trim())}</div>
            <div class="sig-rl">Médico responsable &mdash; ${this.esc(d.specialization ?? 'Especialidad')}</div>
          </div>
        </div>
      </div>
    </div>`;
  }

  // ─── Resumen HTML ─────────────────────────────────────────────────────────────

  private summaryHtml(dto: SummaryPdfDto): string {
    const typeLabel = this.recordTypeLabel(dto.recordType);
    const emergencyBadge = dto.isEmergency
      ? '&nbsp;<span style="color:#dc2626;font-weight:bold">&#9632; EMERGENCIA</span>'
      : '';

    return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
    <style>${this.css()}</style></head><body>
      ${this.header('Resumen de Consulta')}
      <div class="meta">
        <span><b>Tipo:</b>&nbsp;${this.esc(typeLabel)}${emergencyBadge}</span>
        <span><b>Generado:</b>&nbsp;${this.nowBO()}</span>
      </div>
      <div class="cnt">
        ${this.summaryPatientDoctor(dto)}
        ${this.summaryChiefComplaint(dto)}
        ${this.summaryHistory(dto)}
        ${this.summaryVitals(dto.vitalSigns)}
        ${this.summaryPhysicalExam(dto)}
        ${this.summaryAssessment(dto)}
        ${this.summaryPlan(dto)}
        ${dto.notes ? this.summaryNotes(dto.notes) : ''}
        ${this.summarySignatures(dto)}
      </div>
    </body></html>`;
  }

  private summaryPatientDoctor(dto: SummaryPdfDto): string {
    const p = dto.patient;
    const d = dto.doctor;
    return `<div class="sec">
      <div class="sec-hd">Información del Paciente y Médico</div>
      <div class="sec-bd">
        <div class="row">
          <div class="col2">${this.field('Paciente', `${p.firstName} ${p.lastName}`.trim())}</div>
          <div class="col">${this.field('Nro. CI', p.documentNumber)}</div>
          <div class="col">${this.field('Fecha de nacimiento', this.fmtDate(p.birthDate))}</div>
        </div>
        <div class="row">
          <div class="col2">${this.field('Domicilio', p.address)}</div>
          <div class="col">${this.field('Teléfono', p.phone)}</div>
        </div>
        <div class="row">
          <div class="col2">${this.field('Médico tratante', `Dr. ${d.firstName} ${d.lastName}`.trim())}</div>
          <div class="col2">${this.field('Especialidad', d.specialization)}</div>
        </div>
      </div>
    </div>`;
  }

  private summaryChiefComplaint(dto: SummaryPdfDto): string {
    return `<div class="sec">
      <div class="sec-hd">Motivo de Consulta</div>
      <div class="sec-bd">
        <div class="row"><div class="col">${this.field('Motivo principal', dto.chiefComplaint, true)}</div></div>
        ${dto.historyOfPresentIllness ? `<div class="row"><div class="col">${this.field('Historia de la enfermedad actual', dto.historyOfPresentIllness, true)}</div></div>` : ''}
      </div>
    </div>`;
  }

  private summaryHistory(dto: SummaryPdfDto): string {
    const has = dto.pastMedicalHistory || dto.medications || dto.allergies ||
                dto.socialHistory || dto.familyHistory || dto.reviewOfSystems;
    if (!has) return '';
    return `<div class="sec">
      <div class="sec-hd">Antecedentes e Historia Médica</div>
      <div class="sec-bd">
        ${dto.pastMedicalHistory ? `<div class="row"><div class="col">${this.field('Antecedentes médicos', dto.pastMedicalHistory, true)}</div></div>` : ''}
        <div class="row">
          ${dto.medications ? `<div class="col">${this.field('Medicación actual', dto.medications, true)}</div>` : ''}
          ${dto.allergies ? `<div class="col">${this.field('Alergias', dto.allergies, true)}</div>` : ''}
        </div>
        <div class="row">
          ${dto.socialHistory ? `<div class="col">${this.field('Historia social', dto.socialHistory, true)}</div>` : ''}
          ${dto.familyHistory ? `<div class="col">${this.field('Antecedentes familiares', dto.familyHistory, true)}</div>` : ''}
        </div>
        ${dto.reviewOfSystems ? `<div class="row"><div class="col">${this.field('Revisión por sistemas', dto.reviewOfSystems, true)}</div></div>` : ''}
      </div>
    </div>`;
  }

  private summaryVitals(vs?: any): string {
    if (!vs || Object.values(vs).every(v => !v)) return '';
    const v = (val?: any) => (val !== undefined && val !== null && val !== '') ? String(val) : '—';
    return `<div class="sec">
      <div class="sec-hd">Signos Vitales</div>
      <div class="sec-bd">
        <table class="vt">
          <thead>
            <tr>
              <th>Temp. °C</th>
              <th>PA Sistólica</th>
              <th>PA Diastólica</th>
              <th>FC (lpm)</th>
              <th>FR (rpm)</th>
              <th>SpO₂ %</th>
              <th>Peso kg</th>
              <th>Talla cm</th>
              <th>IMC</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>${v(vs.temperature)}</td>
              <td>${v(vs.systolicBP)}</td>
              <td>${v(vs.diastolicBP)}</td>
              <td>${v(vs.heartRate)}</td>
              <td>${v(vs.respiratoryRate)}</td>
              <td>${v(vs.oxygenSaturation)}</td>
              <td>${v(vs.weight)}</td>
              <td>${v(vs.height)}</td>
              <td>${v(vs.bmi) || this.calcBmi(vs.weight, vs.height)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>`;
  }

  private summaryPhysicalExam(dto: SummaryPdfDto): string {
    const has = dto.physicalExamination || dto.generalAppearance || dto.heent ||
                dto.cardiovascular || dto.respiratory || dto.abdominal || dto.neurological;
    if (!has) return '';
    return `<div class="sec">
      <div class="sec-hd">Examen Físico</div>
      <div class="sec-bd">
        ${dto.physicalExamination ? `<div class="row"><div class="col">${this.field('Examen físico general', dto.physicalExamination, true)}</div></div>` : ''}
        ${dto.generalAppearance ? `<div class="row"><div class="col">${this.field('Aspecto general', dto.generalAppearance, true)}</div></div>` : ''}
        <div class="row">
          ${dto.heent ? `<div class="col">${this.field('Cabeza / Cuello / ORL', dto.heent, true)}</div>` : ''}
          ${dto.cardiovascular ? `<div class="col">${this.field('Cardiovascular', dto.cardiovascular, true)}</div>` : ''}
        </div>
        <div class="row">
          ${dto.respiratory ? `<div class="col">${this.field('Respiratorio', dto.respiratory, true)}</div>` : ''}
          ${dto.abdominal ? `<div class="col">${this.field('Abdomen', dto.abdominal, true)}</div>` : ''}
        </div>
        <div class="row">
          ${dto.neurological ? `<div class="col">${this.field('Neurológico', dto.neurological, true)}</div>` : ''}
          ${dto.musculoskeletal ? `<div class="col">${this.field('Musculoesquelético', dto.musculoskeletal, true)}</div>` : ''}
          ${dto.skin ? `<div class="col">${this.field('Piel', dto.skin, true)}</div>` : ''}
        </div>
      </div>
    </div>`;
  }

  private summaryAssessment(dto: SummaryPdfDto): string {
    if (!dto.assessment && !dto.diagnosis && !dto.differentialDiagnosis) return '';
    return `<div class="sec">
      <div class="sec-hd">Evaluación y Diagnóstico</div>
      <div class="sec-bd">
        ${dto.assessment ? `<div class="row"><div class="col">${this.field('Evaluación clínica', dto.assessment, true)}</div></div>` : ''}
        <div class="row">
          ${dto.diagnosis ? `<div class="col">${this.field('Diagnóstico', dto.diagnosis, true)}</div>` : ''}
          ${dto.differentialDiagnosis ? `<div class="col">${this.field('Diagnóstico diferencial', dto.differentialDiagnosis, true)}</div>` : ''}
        </div>
      </div>
    </div>`;
  }

  private summaryPlan(dto: SummaryPdfDto): string {
    if (!dto.plan && !dto.treatmentPlan && !dto.followUpInstructions && !dto.patientEducation && !dto.followUpDate) return '';
    return `<div class="sec">
      <div class="sec-hd">Plan y Seguimiento</div>
      <div class="sec-bd">
        ${dto.plan ? `<div class="row"><div class="col">${this.field('Plan general', dto.plan, true)}</div></div>` : ''}
        ${dto.treatmentPlan ? `<div class="row"><div class="col">${this.field('Plan de tratamiento', dto.treatmentPlan, true)}</div></div>` : ''}
        ${dto.followUpInstructions ? `<div class="row"><div class="col">${this.field('Instrucciones de seguimiento', dto.followUpInstructions, true)}</div></div>` : ''}
        ${dto.patientEducation ? `<div class="row"><div class="col">${this.field('Educación al paciente', dto.patientEducation, true)}</div></div>` : ''}
        ${dto.followUpDate ? `<div class="row"><div class="col">${this.field('Próxima cita', this.fmtDate(dto.followUpDate))}</div></div>` : ''}
      </div>
    </div>`;
  }

  private summaryNotes(notes: string): string {
    return `<div class="sec">
      <div class="sec-hd">Notas Adicionales</div>
      <div class="sec-bd">
        <div class="row"><div class="col">${this.field('Notas', notes, true)}</div></div>
      </div>
    </div>`;
  }

  private summarySignatures(dto: SummaryPdfDto): string {
    const p = dto.patient;
    const d = dto.doctor;
    return `<div class="sec">
      <div class="sec-hd">Firmas</div>
      <div class="sec-bd">
        <div class="sigs">
          <div class="sig">
            <div class="sig-sp"></div>
            <div class="sig-nm">${this.esc(`${p.firstName} ${p.lastName}`.trim())}</div>
            <div class="sig-rl">Paciente</div>
          </div>
          <div class="sig">
            <div class="sig-sp"></div>
            <div class="sig-nm">_______________</div>
            <div class="sig-rl">Testigo</div>
          </div>
          <div class="sig">
            <div class="sig-sp"></div>
            <div class="sig-nm">Dr. ${this.esc(`${d.firstName} ${d.lastName}`.trim())}</div>
            <div class="sig-rl">Médico tratante &mdash; ${this.esc(d.specialization ?? 'Especialidad')}</div>
          </div>
        </div>
      </div>
    </div>`;
  }

  // ─── Label maps ──────────────────────────────────────────────────────────────

  private consentTypeLabel(type: string): string {
    const map: Record<string, string> = {
      treatment: 'Tratamiento médico',
      surgery: 'Cirugía',
      anesthesia: 'Anestesia',
      blood_transfusion: 'Transfusión sanguínea',
      imaging: 'Diagnóstico por imagen',
      laboratory: 'Análisis de laboratorio',
      discharge: 'Alta médica',
      general: 'Consentimiento general',
      other: 'Otro',
    };
    return map[type] ?? type;
  }

  private recordTypeLabel(type: string): string {
    const map: Record<string, string> = {
      consultation: 'Consulta médica',
      emergency: 'Emergencia',
      surgery: 'Cirugía',
      follow_up: 'Seguimiento',
      laboratory: 'Laboratorio',
      imaging: 'Imagenología',
      other: 'Otro',
    };
    return map[type] ?? type;
  }
}
