import { Injectable } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import puppeteer from 'puppeteer-core';
import { Prescription } from './entities/prescription.entity';

@Injectable()
export class PrescriptionsPdfService {
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

  async generate(prescription: Prescription): Promise<Buffer> {
    return this.render(this.buildHtml(prescription));
  }

  // ─── Puppeteer ───────────────────────────────────────────────────────────────

  private async render(html: string): Promise<Buffer> {
    const browser = await puppeteer.launch({
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH ?? '/usr/bin/chromium',
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--no-first-run'],
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
          font-family:Arial,Helvetica,sans-serif;font-size:9px;color:#94a3b8;
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

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private esc(s: string | null | undefined): string {
    return (s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private fmtDate(d: Date | string | null | undefined): string {
    if (!d) return '—';
    const date = d instanceof Date ? d : new Date(d);
    return date.toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/La_Paz' });
  }

  private nowBO(): string {
    return new Date().toLocaleString('es-BO', { timeZone: 'America/La_Paz', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  private statusLabel(s: string): string {
    const map: Record<string, string> = {
      draft: 'Borrador', active: 'Activa', dispensed: 'Dispensada',
      completed: 'Completada', cancelled: 'Cancelada', expired: 'Expirada',
    };
    return map[s] ?? s;
  }

  private dosageFormLabel(f: string): string {
    const map: Record<string, string> = {
      tableta: 'Tableta', cápsula: 'Cápsula', jarabe: 'Jarabe', suspensión: 'Suspensión',
      inyectable: 'Inyectable', crema: 'Crema', ungüento: 'Ungüento', gotas: 'Gotas', supositorio: 'Supositorio',
    };
    return map[f] ?? f;
  }

  // ─── HTML ────────────────────────────────────────────────────────────────────

  private buildHtml(p: Prescription): string {
    const patient = p.patient;
    const doctor = p.doctor;
    const clinic = p.clinic;

    const doctorName = doctor
      ? `Dr. ${this.esc(doctor.personalInfo?.firstName ?? '')} ${this.esc(doctor.personalInfo?.lastName ?? '')}`.trim()
      : '—';
    const doctorSpecialty = this.esc(doctor?.professionalInfo?.specialization ?? '');
    const patientName = patient
      ? `${this.esc(patient.firstName)} ${this.esc(patient.lastName)}`
      : '—';

    const itemsHtml = (p.items || []).map((it, i) => `
      <tr class="${i % 2 === 0 ? 'row-even' : 'row-odd'}">
        <td class="td-num">${i + 1}</td>
        <td>
          <div class="med-name">${this.esc(it.medicationName)}</div>
          <div class="med-detail">${this.esc(it.strength)} · ${this.dosageFormLabel(it.dosageForm ?? '')} · Vía ${this.esc(it.route ?? 'oral')}</div>
          ${it.instructions ? `<div class="med-instr">${this.esc(it.instructions)}</div>` : ''}
        </td>
        <td class="td-center">${this.esc(it.quantity)}</td>
        <td class="td-center">${this.esc(it.dosage)}</td>
        <td class="td-center">${this.esc(it.frequency)}</td>
        <td class="td-center">${it.duration ? it.duration + ' días' : '—'}</td>
      </tr>
    `).join('');

    const logoImg = this.logo64
      ? `<img src="data:image/png;base64,${this.logo64}" alt="Logo" />`
      : '';

    return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:Arial,Helvetica,sans-serif;font-size:9.5pt;color:#111;line-height:1.45}

  /* Cabecera */
  .hd{border-bottom:2.5px solid #1e3a5f;padding:12px 28px;display:flex;align-items:center;gap:14px}
  .hd-logo{width:46px;height:46px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
  .hd-logo img{width:44px;height:44px;object-fit:contain}
  .hd-text{flex:1}
  .hd-name{font-size:17pt;font-weight:bold;letter-spacing:1.5px;color:#1e3a5f;line-height:1.2}
  .hd-sub{font-size:8pt;color:#475569;text-transform:uppercase;letter-spacing:.8px;margin-top:1px}
  .hd-badge{border:1.5px solid #1e3a5f;border-radius:4px;padding:6px 14px;font-size:9pt;font-weight:bold;color:#1e3a5f;text-align:center;text-transform:uppercase;letter-spacing:.6px;white-space:nowrap}

  /* Meta */
  .meta{border-bottom:1px solid #d1d5db;padding:4px 28px;display:flex;gap:20px;flex-wrap:wrap;font-size:8pt;color:#374151}
  .meta-item{display:flex;gap:5px}
  .meta-lbl{font-weight:bold;color:#6b7280}

  /* Contenido */
  .cnt{padding:14px 28px}

  /* Secciones */
  .sec{margin-bottom:12px;border:1px solid #d1d5db;border-radius:3px}
  .sec-hd{border-left:3px solid #1e3a5f;padding:4px 8px;font-size:7.5pt;font-weight:bold;text-transform:uppercase;letter-spacing:.8px;color:#1e3a5f;background:#f8fafc}
  .sec-bd{padding:10px 12px}

  /* Grid */
  .row{display:flex;gap:14px;margin-bottom:7px}
  .row:last-child{margin-bottom:0}
  .col{flex:1}
  .col2{flex:2}
  .lbl{font-size:7pt;font-weight:bold;color:#6b7280;text-transform:uppercase;letter-spacing:.4px;margin-bottom:2px}
  .val{font-size:9.5pt;color:#111;border-bottom:1px solid #9ca3af;padding-bottom:2px;min-height:15px}
  .val-box{font-size:9pt;color:#111;border:1px solid #d1d5db;border-radius:2px;padding:5px 7px;min-height:36px;white-space:pre-wrap}

  /* Tabla de medicamentos */
  .med-table{width:100%;border-collapse:collapse;font-size:8.5pt}
  .med-table th{background:#f3f4f6;color:#111;font-weight:bold;padding:5px 7px;text-align:left;border-bottom:1.5px solid #9ca3af;border-top:1px solid #d1d5db;font-size:7.5pt;text-transform:uppercase;letter-spacing:.4px}
  .med-table td{padding:6px 7px;border-bottom:1px solid #e5e7eb;vertical-align:top}
  .row-even td{background:#fff}
  .row-odd td{background:#f9fafb}
  .td-num{width:26px;text-align:center;color:#6b7280;font-weight:bold}
  .td-center{text-align:center}
  .med-name{font-weight:bold;font-size:9pt}
  .med-detail{font-size:7.5pt;color:#6b7280;margin-top:1px}
  .med-instr{font-size:7.5pt;color:#374151;margin-top:2px;font-style:italic}

  /* Firmas */
  .sig-row{display:flex;gap:40px;margin-top:20px;padding-top:10px}
  .sig-box{flex:1;text-align:center}
  .sig-line{border-top:1px solid #374151;padding-top:6px;margin-top:36px;font-size:8pt;color:#374151}
  .sig-sub{font-size:7pt;color:#6b7280;margin-top:2px}

  /* Estado badge */
  .status-badge{display:inline-block;padding:2px 8px;border-radius:3px;font-size:7.5pt;font-weight:bold;text-transform:uppercase;letter-spacing:.5px}
  .status-draft{background:#f3f4f6;color:#6b7280;border:1px solid #d1d5db}
  .status-active{background:#dcfce7;color:#166534;border:1px solid #86efac}
  .status-dispensed{background:#dbeafe;color:#1e40af;border:1px solid #93c5fd}
  .status-completed{background:#f3e8ff;color:#6b21a8;border:1px solid #c4b5fd}
  .status-cancelled{background:#fee2e2;color:#991b1b;border:1px solid #fca5a5}
  .status-expired{background:#fef3c7;color:#92400e;border:1px solid #fcd34d}
</style>
</head>
<body>

<!-- Cabecera -->
<div class="hd">
  <div class="hd-logo">${logoImg}</div>
  <div class="hd-text">
    <div class="hd-name">${this.esc(clinic?.name ?? 'Bartolomed')}</div>
    <div class="hd-sub">${this.esc(clinic?.address ?? '')}${clinic?.phone ? ' · Tel. ' + this.esc(clinic.phone) : ''}</div>
  </div>
  <div class="hd-badge">Receta Médica</div>
</div>

<!-- Meta -->
<div class="meta">
  <div class="meta-item"><span class="meta-lbl">N° Receta:</span><span>${this.esc(p.prescriptionNumber)}</span></div>
  <div class="meta-item"><span class="meta-lbl">Emisión:</span><span>${this.fmtDate(p.prescriptionDate)}</span></div>
  <div class="meta-item"><span class="meta-lbl">Vence:</span><span>${this.fmtDate(p.expiryDate)}</span></div>
  <div class="meta-item"><span class="meta-lbl">Estado:</span>
    <span class="status-badge status-${this.esc(p.status)}">${this.statusLabel(p.status)}</span>
  </div>
  <div class="meta-item"><span class="meta-lbl">Impreso:</span><span>${this.nowBO()}</span></div>
</div>

<div class="cnt">

  <!-- Paciente y Médico -->
  <div class="sec">
    <div class="sec-hd">Datos del Paciente y Médico</div>
    <div class="sec-bd">
      <div class="row">
        <div class="col2">
          <div class="lbl">Paciente</div>
          <div class="val">${patientName}</div>
        </div>
        <div class="col">
          <div class="lbl">CI / Documento</div>
          <div class="val">${this.esc(patient?.documentNumber ?? '—')}</div>
        </div>
        <div class="col">
          <div class="lbl">Fecha de Nacimiento</div>
          <div class="val">${this.fmtDate((patient as any)?.birthDate)}</div>
        </div>
      </div>
      <div class="row">
        <div class="col2">
          <div class="lbl">Médico Prescriptor</div>
          <div class="val">${doctorName}</div>
        </div>
        <div class="col">
          <div class="lbl">Especialidad</div>
          <div class="val">${doctorSpecialty || '—'}</div>
        </div>
        <div class="col">
          <div class="lbl">Matrícula / Reg.</div>
          <div class="val">${this.esc(doctor?.professionalInfo?.license ?? '—')}</div>
        </div>
      </div>
    </div>
  </div>

  <!-- Medicamentos -->
  <div class="sec">
    <div class="sec-hd">Medicamentos Prescritos</div>
    <div class="sec-bd" style="padding:0">
      <table class="med-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Medicamento · Concentración · Forma</th>
            <th class="td-center">Cantidad</th>
            <th class="td-center">Dosis</th>
            <th class="td-center">Frecuencia</th>
            <th class="td-center">Duración</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml || '<tr><td colspan="6" style="text-align:center;color:#9ca3af;padding:12px">Sin medicamentos</td></tr>'}
        </tbody>
      </table>
    </div>
  </div>

  ${p.notes ? `
  <!-- Notas -->
  <div class="sec">
    <div class="sec-hd">Notas e Indicaciones</div>
    <div class="sec-bd">
      <div class="val-box">${this.esc(p.notes)}</div>
    </div>
  </div>
  ` : ''}

  <!-- Firmas -->
  <div class="sig-row">
    <div class="sig-box">
      <div class="sig-line">
        <div>${doctorName}</div>
        <div class="sig-sub">${doctorSpecialty}</div>
      </div>
    </div>
    <div class="sig-box">
      <div class="sig-line">
        <div>Firma del Paciente o Responsable</div>
        <div class="sig-sub">CI: ${this.esc(patient?.documentNumber ?? '—')}</div>
      </div>
    </div>
    <div class="sig-box">
      <div class="sig-line">
        <div>Sello de la Farmacia</div>
        <div class="sig-sub">Fecha de dispensación</div>
      </div>
    </div>
  </div>

</div>
</body>
</html>`;
  }
}
