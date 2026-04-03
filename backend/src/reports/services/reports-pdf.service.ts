import { Injectable } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import puppeteer from 'puppeteer-core';

@Injectable()
export class ReportsPdfService {
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

  // ─── API pública ──────────────────────────────────────────────────────────

  async generateFinancialPdf(data: any): Promise<Buffer> {
    return this.render(this.financialHtml(data));
  }

  async generateDemographicsPdf(data: any): Promise<Buffer> {
    return this.render(this.demographicsHtml(data));
  }

  async generateDoctorPerformancePdf(data: any): Promise<Buffer> {
    return this.render(this.doctorPerformanceHtml(data));
  }

  async generateAppointmentsPdf(data: any): Promise<Buffer> {
    return this.render(this.appointmentsHtml(data));
  }

  async generateMedicalRecordsPdf(data: any): Promise<Buffer> {
    return this.render(this.medicalRecordsHtml(data));
  }

  async generateDashboardPdf(data: any): Promise<Buffer> {
    return this.render(this.dashboardHtml(data));
  }

  // ─── Puppeteer ────────────────────────────────────────────────────────────

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
        format: 'A4',
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

  // ─── CSS común ────────────────────────────────────────────────────────────

  private css(): string {
    return `
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:Arial,Helvetica,sans-serif;font-size:9.5pt;color:#111;line-height:1.45}

      .hd{border-bottom:2.5px solid #1e3a5f;padding:12px 28px;display:flex;align-items:center;gap:14px}
      .hd-logo{width:46px;height:46px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
      .hd-logo img{width:44px;height:44px;object-fit:contain}
      .hd-text{flex:1}
      .hd-name{font-size:17pt;font-weight:bold;letter-spacing:1.5px;color:#1e3a5f;line-height:1.2}
      .hd-sub{font-size:8pt;color:#475569;text-transform:uppercase;letter-spacing:.8px;margin-top:1px}
      .hd-badge{border:1.5px solid #1e3a5f;border-radius:4px;padding:5px 12px;font-size:8.5pt;font-weight:bold;color:#1e3a5f;text-align:center;text-transform:uppercase;letter-spacing:.6px;white-space:nowrap}

      .meta{background:#f8fafc;border-bottom:1px solid #d1d5db;padding:6px 28px;display:flex;gap:24px;font-size:8pt;color:#374151;flex-wrap:wrap}
      .meta span b{color:#1e3a5f}

      .cnt{padding:16px 28px}

      .sec{margin-bottom:14px;border:1px solid #d1d5db;border-radius:4px;overflow:hidden}
      .sec-hd{border-left:3px solid #1e3a5f;padding:6px 10px;font-size:7.5pt;font-weight:bold;text-transform:uppercase;letter-spacing:.8px;color:#1e3a5f;background:#f8fafc}
      .sec-bd{padding:12px 14px}

      /* KPI grid */
      .kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:14px}
      .kpi-card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:12px 14px;text-align:center}
      .kpi-card.green{border-top:3px solid #059669}
      .kpi-card.blue{border-top:3px solid #2563eb}
      .kpi-card.amber{border-top:3px solid #d97706}
      .kpi-card.red{border-top:3px solid #dc2626}
      .kpi-card.purple{border-top:3px solid #7c3aed}
      .kpi-label{font-size:7pt;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px}
      .kpi-value{font-size:15pt;font-weight:bold;color:#111;line-height:1.2}
      .kpi-sub{font-size:7pt;color:#9ca3af;margin-top:2px}

      /* Tabla */
      .tbl{width:100%;border-collapse:collapse;font-size:8.5pt}
      .tbl th{background:#1e3a5f;color:#fff;padding:7px 10px;text-align:left;font-size:7.5pt;letter-spacing:.4px;font-weight:bold}
      .tbl td{padding:6px 10px;border-bottom:1px solid #e5e7eb;color:#111}
      .tbl tr:nth-child(even) td{background:#f9fafb}
      .tbl tr:last-child td{border-bottom:none}
      .tbl .num{text-align:right}
      .tbl .center{text-align:center}

      /* Badge */
      .badge{display:inline-block;padding:2px 8px;border-radius:999px;font-size:7pt;font-weight:bold;letter-spacing:.3px}
      .badge-green{background:#d1fae5;color:#065f46}
      .badge-amber{background:#fef3c7;color:#92400e}
      .badge-red{background:#fee2e2;color:#991b1b}
      .badge-blue{background:#dbeafe;color:#1e40af}
      .badge-gray{background:#f3f4f6;color:#374151}

      /* Bar chart */
      .bar-row{display:flex;align-items:center;gap:10px;margin-bottom:7px}
      .bar-label{font-size:8pt;color:#374151;width:140px;flex-shrink:0;text-overflow:ellipsis;overflow:hidden;white-space:nowrap}
      .bar-track{flex:1;background:#e5e7eb;border-radius:3px;height:14px;overflow:hidden}
      .bar-fill{height:14px;border-radius:3px;background:#2563eb}
      .bar-fill.green{background:#059669}
      .bar-fill.amber{background:#d97706}
      .bar-fill.red{background:#dc2626}
      .bar-fill.purple{background:#7c3aed}
      .bar-val{font-size:8pt;font-weight:bold;color:#111;width:60px;text-align:right;flex-shrink:0}

      @page{size:A4;margin:0}
      @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
    `;
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private esc(s?: string | null): string {
    if (!s) return '';
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  private fmtNum(n: any, decimals = 0): string {
    const v = parseFloat(String(n ?? 0));
    return isNaN(v) ? '0' : v.toLocaleString('es-BO', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  }

  private fmtBs(n: any): string {
    return `Bs ${this.fmtNum(n, 2)}`;
  }

  private fmtPct(n: any): string {
    return `${this.fmtNum(n, 1)}%`;
  }

  private nowBO(): string {
    return new Date().toLocaleString('es-BO', { timeZone: 'America/La_Paz' });
  }

  private header(title: string, subtitle?: string): string {
    const logoTag = this.logo64
      ? `<div class="hd-logo"><img src="data:image/png;base64,${this.logo64}" alt="logo"></div>`
      : '';
    return `<div class="hd">
      ${logoTag}
      <div class="hd-text">
        <div class="hd-name">BARTOLOMED</div>
        <div class="hd-sub">${subtitle ?? 'Sistema de Gestión Clínica'}</div>
      </div>
      <div style="flex:1"></div>
      <div class="hd-badge">${this.esc(title)}</div>
    </div>`;
  }

  private meta(fields: [string, string][]): string {
    const items = fields.map(([k, v]) => `<span><b>${k}:</b>&nbsp;${v}</span>`).join('');
    return `<div class="meta">${items}</div>`;
  }

  private kpiCard(label: string, value: string, sub: string, color = 'blue'): string {
    return `<div class="kpi-card ${color}">
      <div class="kpi-label">${label}</div>
      <div class="kpi-value">${value}</div>
      <div class="kpi-sub">${sub}</div>
    </div>`;
  }

  private barChart(rows: { label: string; value: number; max: number; color?: string; suffix?: string }[]): string {
    return rows.map(r => {
      const pct = r.max > 0 ? Math.min(100, (r.value / r.max) * 100) : 0;
      return `<div class="bar-row">
        <div class="bar-label" title="${this.esc(r.label)}">${this.esc(r.label)}</div>
        <div class="bar-track"><div class="bar-fill ${r.color ?? ''}" style="width:${pct.toFixed(1)}%"></div></div>
        <div class="bar-val">${this.fmtNum(r.value)}${r.suffix ?? ''}</div>
      </div>`;
    }).join('');
  }

  private table(headers: string[], rows: string[][], alignments?: string[]): string {
    const ths = headers.map(h => `<th>${this.esc(h)}</th>`).join('');
    const trs = rows.map(row =>
      `<tr>${row.map((cell, i) => {
        const cls = alignments?.[i] ?? '';
        return `<td class="${cls}">${cell}</td>`;
      }).join('')}</tr>`
    ).join('');
    return `<table class="tbl"><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`;
  }

  private section(title: string, body: string): string {
    return `<div class="sec"><div class="sec-hd">${this.esc(title)}</div><div class="sec-bd">${body}</div></div>`;
  }

  private noData(): string {
    return `<p style="color:#9ca3af;font-size:8.5pt;text-align:center;padding:12px 0;">Sin datos disponibles para el período seleccionado</p>`;
  }

  // ─── Financial Report HTML ────────────────────────────────────────────────

  private financialHtml(data: any): string {
    const summary = data.summary ?? {};
    const monthly = data.monthlyRevenue ?? [];
    const payments = data.paymentMethods ?? [];

    const maxRevenue = Math.max(...monthly.map((m: any) => Number(m.revenue ?? 0)), 1);
    const maxPayment = Math.max(...payments.map((p: any) => Number(p.total ?? 0)), 1);

    const monthlyRows = monthly.map((m: any) => [
      this.esc(m.month ?? '-'),
      `<span class="num">${this.fmtBs(m.revenue)}</span>`,
      `<span class="num">${this.fmtBs(m.collected)}</span>`,
      `<span class="num">${this.fmtNum(m.invoiceCount)}</span>`,
    ]);

    const collectionRate = summary.totalBilled > 0
      ? ((summary.totalCollected / summary.totalBilled) * 100).toFixed(1)
      : '0.0';

    return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>${this.css()}</style></head><body>
      ${this.header('Reporte Financiero')}
      ${this.meta([
        ['Generado', this.nowBO()],
        ['Total facturado', this.fmtBs(summary.totalBilled)],
        ['Total cobrado', this.fmtBs(summary.totalCollected)],
        ['Tasa de cobro', `${collectionRate}%`],
      ])}
      <div class="cnt">
        <div class="kpi-grid">
          ${this.kpiCard('Total Facturado', this.fmtBs(summary.totalBilled), 'Facturas emitidas', 'blue')}
          ${this.kpiCard('Total Cobrado', this.fmtBs(summary.totalCollected), 'Pagos recibidos', 'green')}
          ${this.kpiCard('Pendiente de Cobro', this.fmtBs((summary.totalBilled ?? 0) - (summary.totalCollected ?? 0)), 'Por cobrar', 'amber')}
          ${this.kpiCard('Tasa de Cobro', `${collectionRate}%`, 'Eficiencia de cobranza', 'purple')}
        </div>

        ${this.section('Ingresos Mensuales',
          monthly.length > 0
            ? `${this.barChart(monthly.map((m: any) => ({
                label: m.month ?? '-',
                value: Number(m.revenue ?? 0),
                max: maxRevenue,
                color: 'green',
                suffix: ' Bs',
              })))}
              <div style="margin-top:12px">${this.table(
                ['Mes', 'Facturado', 'Cobrado', 'Facturas'],
                monthlyRows,
                ['', 'num', 'num', 'num'],
              )}</div>`
            : this.noData()
        )}

        ${this.section('Métodos de Pago',
          payments.length > 0
            ? `${this.barChart(payments.map((p: any) => ({
                label: p.method ?? '-',
                value: Number(p.total ?? 0),
                max: maxPayment,
                color: 'blue',
                suffix: ' Bs',
              })))}
              <div style="margin-top:12px">${this.table(
                ['Método', 'Total Bs', 'Transacciones'],
                payments.map((p: any) => [
                  this.esc(p.method ?? '-'),
                  `<span class="num">${this.fmtBs(p.total)}</span>`,
                  `<span class="num">${this.fmtNum(p.count)}</span>`,
                ]),
                ['', 'num', 'num'],
              )}</div>`
            : this.noData()
        )}
      </div>
    </body></html>`;
  }

  // ─── Demographics Report HTML ─────────────────────────────────────────────

  private demographicsHtml(data: any): string {
    const total = data.totalPatients ?? 0;
    const genders = data.genderDistribution ?? [];
    const ages = data.ageGroupDistribution ?? [];
    const blood = data.bloodTypeDistribution ?? [];

    const maxGender = Math.max(...genders.map((g: any) => Number(g.count ?? 0)), 1);
    const maxAge = Math.max(...ages.map((a: any) => Number(a.count ?? 0)), 1);
    const maxBlood = Math.max(...blood.map((b: any) => Number(b.count ?? 0)), 1);

    return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>${this.css()}</style></head><body>
      ${this.header('Demografía de Pacientes')}
      ${this.meta([
        ['Generado', this.nowBO()],
        ['Total pacientes', this.fmtNum(total)],
      ])}
      <div class="cnt">
        <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr)">
          ${this.kpiCard('Total Pacientes', this.fmtNum(total), 'Activos en el sistema', 'blue')}
          ${this.kpiCard('Grupos de Edad', this.fmtNum(ages.length), 'Rangos registrados', 'green')}
          ${this.kpiCard('Tipos de Sangre', this.fmtNum(blood.length), 'Grupos registrados', 'purple')}
        </div>

        ${this.section('Distribución por Género',
          genders.length > 0
            ? this.barChart(genders.map((g: any) => ({
                label: g.gender === 'male' ? 'Masculino' : g.gender === 'female' ? 'Femenino' : (g.gender ?? 'No especificado'),
                value: Number(g.count ?? 0),
                max: maxGender,
                color: g.gender === 'male' ? 'blue' : 'purple',
              })))
            : this.noData()
        )}

        ${this.section('Distribución por Grupos de Edad',
          ages.length > 0
            ? this.barChart(ages.map((a: any) => ({
                label: a.ageGroup ?? '-',
                value: Number(a.count ?? 0),
                max: maxAge,
                color: 'green',
              })))
            : this.noData()
        )}

        ${this.section('Distribución por Tipo de Sangre',
          blood.length > 0
            ? this.table(
                ['Tipo de Sangre', 'Pacientes', '% del Total'],
                blood.map((b: any) => [
                  `<b>${this.esc(b.bloodType ?? 'No registrado')}</b>`,
                  `<span class="num">${this.fmtNum(b.count)}</span>`,
                  `<span class="num">${this.fmtPct(total > 0 ? (Number(b.count) / total) * 100 : 0)}</span>`,
                ]),
                ['', 'num', 'num'],
              )
            : this.noData()
        )}
      </div>
    </body></html>`;
  }

  // ─── Doctor Performance HTML ──────────────────────────────────────────────

  private doctorPerformanceHtml(data: any): string {
    const doctors = data.doctorPerformance ?? [];
    const maxCompleted = Math.max(...doctors.map((d: any) => Number(d.completedAppointments ?? 0)), 1);

    return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>${this.css()}</style></head><body>
      ${this.header('Rendimiento de Médicos')}
      ${this.meta([
        ['Generado', this.nowBO()],
        ['Total médicos', this.fmtNum(doctors.length)],
      ])}
      <div class="cnt">
        ${this.section('Citas Completadas por Médico',
          doctors.length > 0
            ? this.barChart(doctors.map((d: any) => ({
                label: `Dr. ${d.doctorName ?? '-'}`,
                value: Number(d.completedAppointments ?? 0),
                max: maxCompleted,
                color: 'blue',
                suffix: ' citas',
              })))
            : this.noData()
        )}

        ${this.section('Detalle de Rendimiento por Médico',
          doctors.length > 0
            ? this.table(
                ['Médico', 'Especialidad', 'Completadas', 'Canceladas', 'Duración prom.', 'Tasa cancelación'],
                doctors.map((d: any) => {
                  const total = (Number(d.completedAppointments ?? 0) + Number(d.cancelledAppointments ?? 0));
                  const cancelRate = total > 0 ? ((Number(d.cancelledAppointments ?? 0) / total) * 100).toFixed(1) : '0.0';
                  const rateColor = Number(cancelRate) > 20 ? 'badge-red' : Number(cancelRate) > 10 ? 'badge-amber' : 'badge-green';
                  return [
                    `<b>${this.esc(d.doctorName ?? '-')}</b>`,
                    this.esc(d.specialization ?? '-'),
                    `<span class="num">${this.fmtNum(d.completedAppointments)}</span>`,
                    `<span class="num">${this.fmtNum(d.cancelledAppointments)}</span>`,
                    `<span class="center">${this.fmtNum(d.avgDurationMinutes)} min</span>`,
                    `<span class="center"><span class="badge ${rateColor}">${cancelRate}%</span></span>`,
                  ];
                }),
                ['', '', 'num', 'num', 'center', 'center'],
              )
            : this.noData()
        )}
      </div>
    </body></html>`;
  }

  // ─── Appointments Report HTML ─────────────────────────────────────────────

  private appointmentsHtml(data: any): string {
    const summary = data.summary ?? {};
    const statusDist = data.statusDistribution ?? [];
    const monthly = data.monthlyTrend ?? [];

    const maxMonthly = Math.max(...monthly.map((m: any) => Number(m.count ?? 0)), 1);

    const statusColors: Record<string, string> = {
      completed: 'badge-green',
      scheduled: 'badge-blue',
      cancelled: 'badge-red',
      no_show: 'badge-amber',
      in_progress: 'badge-blue',
    };

    const statusLabels: Record<string, string> = {
      completed: 'Completada',
      scheduled: 'Programada',
      cancelled: 'Cancelada',
      no_show: 'No se presentó',
      in_progress: 'En progreso',
    };

    return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>${this.css()}</style></head><body>
      ${this.header('Estadísticas de Citas')}
      ${this.meta([
        ['Generado', this.nowBO()],
        ['Total citas', this.fmtNum(summary.totalAppointments)],
        ['Tasa de cancelación', this.fmtPct(summary.cancellationRate)],
      ])}
      <div class="cnt">
        <div class="kpi-grid">
          ${this.kpiCard('Total Citas', this.fmtNum(summary.totalAppointments), 'Todas las citas', 'blue')}
          ${this.kpiCard('Completadas', this.fmtNum(summary.completedAppointments), 'Atendidas', 'green')}
          ${this.kpiCard('Canceladas', this.fmtNum(summary.cancelledAppointments), 'No realizadas', 'red')}
          ${this.kpiCard('Duración Prom.', `${this.fmtNum(summary.avgDuration)} min`, 'Por consulta', 'purple')}
        </div>

        ${this.section('Distribución por Estado',
          statusDist.length > 0
            ? this.table(
                ['Estado', 'Cantidad', '% del Total'],
                statusDist.map((s: any) => [
                  `<span class="badge ${statusColors[s.status] ?? 'badge-gray'}">${statusLabels[s.status] ?? this.esc(s.status)}</span>`,
                  `<span class="num">${this.fmtNum(s.count)}</span>`,
                  `<span class="num">${this.fmtPct(summary.totalAppointments > 0 ? (Number(s.count) / summary.totalAppointments) * 100 : 0)}</span>`,
                ]),
                ['', 'num', 'num'],
              )
            : this.noData()
        )}

        ${this.section('Tendencia Mensual',
          monthly.length > 0
            ? this.barChart(monthly.map((m: any) => ({
                label: m.month ?? '-',
                value: Number(m.count ?? 0),
                max: maxMonthly,
                color: 'blue',
                suffix: ' citas',
              })))
            : this.noData()
        )}
      </div>
    </body></html>`;
  }

  // ─── Medical Records Report HTML ──────────────────────────────────────────

  private medicalRecordsHtml(data: any): string {
    const summary = data.summary ?? {};
    const byType = data.byType ?? [];
    const byStatus = data.byStatus ?? [];

    const typeColors = ['blue', 'green', 'purple', 'amber', 'red'];

    return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>${this.css()}</style></head><body>
      ${this.header('Registros Médicos')}
      ${this.meta([
        ['Generado', this.nowBO()],
        ['Total registros', this.fmtNum(summary.totalRecords)],
      ])}
      <div class="cnt">
        <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr)">
          ${this.kpiCard('Total Registros', this.fmtNum(summary.totalRecords), 'Todos los tipos', 'blue')}
          ${this.kpiCard('Tipos Distintos', this.fmtNum(byType.length), 'Categorías', 'green')}
          ${this.kpiCard('Estados', this.fmtNum(byStatus.length), 'Flujos de trabajo', 'purple')}
        </div>

        ${this.section('Distribución por Tipo',
          byType.length > 0
            ? `${this.barChart(byType.map((t: any, i: number) => ({
                label: t.recordType ?? '-',
                value: Number(t.count ?? 0),
                max: Math.max(...byType.map((x: any) => Number(x.count ?? 0)), 1),
                color: typeColors[i % typeColors.length],
              })))}
              <div style="margin-top:12px">${this.table(
                ['Tipo de Registro', 'Cantidad'],
                byType.map((t: any) => [
                  this.esc(t.recordType ?? '-'),
                  `<span class="num">${this.fmtNum(t.count)}</span>`,
                ]),
                ['', 'num'],
              )}</div>`
            : this.noData()
        )}

        ${this.section('Distribución por Estado',
          byStatus.length > 0
            ? this.table(
                ['Estado', 'Cantidad'],
                byStatus.map((s: any) => [
                  this.esc(s.status ?? '-'),
                  `<span class="num">${this.fmtNum(s.count)}</span>`,
                ]),
                ['', 'num'],
              )
            : this.noData()
        )}
      </div>
    </body></html>`;
  }

  // ─── Dashboard Report HTML ────────────────────────────────────────────────

  private dashboardHtml(data: any): string {
    const patients = data.patients ?? {};
    const appointments = data.appointments ?? {};
    const financial = data.financial ?? {};
    const stock = data.stock ?? {};

    return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>${this.css()}</style></head><body>
      ${this.header('Resumen General — Dashboard')}
      ${this.meta([
        ['Generado', this.nowBO()],
      ])}
      <div class="cnt">
        <div class="kpi-grid">
          ${this.kpiCard('Pacientes Activos', this.fmtNum(patients.total), 'Registrados', 'blue')}
          ${this.kpiCard('Citas del Período', this.fmtNum(appointments.total), 'Total programadas', 'green')}
          ${this.kpiCard('Ingresos', this.fmtBs(financial.totalBilled), 'Facturado', 'purple')}
          ${this.kpiCard('Stock Bajo Mínimo', this.fmtNum(stock.belowMinimum), 'Alertas activas', 'red')}
        </div>

        ${this.section('Pacientes',
          `<div style="display:flex;gap:24px">
            <div style="flex:1">${this.kpiCard('Total', this.fmtNum(patients.total), 'Activos', 'blue')}</div>
            <div style="flex:1">${this.kpiCard('Nuevos (período)', this.fmtNum(patients.newThisPeriod), 'Registros nuevos', 'green')}</div>
          </div>`
        )}

        ${this.section('Citas Médicas',
          `<div style="display:flex;gap:12px">
            <div style="flex:1">${this.kpiCard('Total', this.fmtNum(appointments.total), 'Citas', 'blue')}</div>
            <div style="flex:1">${this.kpiCard('Completadas', this.fmtNum(appointments.completed), 'Atendidas', 'green')}</div>
            <div style="flex:1">${this.kpiCard('Canceladas', this.fmtNum(appointments.cancelled), 'No realizadas', 'red')}</div>
            <div style="flex:1">${this.kpiCard('Tasa cancelación', this.fmtPct(appointments.cancellationRate), 'Del período', 'amber')}</div>
          </div>`
        )}

        ${this.section('Resumen Financiero',
          `<div style="display:flex;gap:12px">
            <div style="flex:1">${this.kpiCard('Facturado', this.fmtBs(financial.totalBilled), 'Total emitido', 'blue')}</div>
            <div style="flex:1">${this.kpiCard('Cobrado', this.fmtBs(financial.totalCollected), 'Efectivo recibido', 'green')}</div>
            <div style="flex:1">${this.kpiCard('Pendiente', this.fmtBs((financial.totalBilled ?? 0) - (financial.totalCollected ?? 0)), 'Por cobrar', 'amber')}</div>
            <div style="flex:1">${this.kpiCard('Tasa de cobro', this.fmtPct(financial.collectionRate), 'Eficiencia', 'purple')}</div>
          </div>`
        )}

        ${this.section('Inventario Farmacia',
          `<div style="display:flex;gap:12px">
            <div style="flex:1">${this.kpiCard('Total Ítems', this.fmtNum(stock.totalItems), 'En inventario', 'blue')}</div>
            <div style="flex:1">${this.kpiCard('Bajo Mínimo', this.fmtNum(stock.belowMinimum), 'Necesitan reposición', 'red')}</div>
            <div style="flex:1">${this.kpiCard('Por Vencer', this.fmtNum(stock.expiringSoon), 'Próximos 60 días', 'amber')}</div>
            <div style="flex:1">${this.kpiCard('Valor Total', this.fmtBs(stock.totalValue), 'En inventario', 'green')}</div>
          </div>`
        )}
      </div>
    </body></html>`;
  }
}
