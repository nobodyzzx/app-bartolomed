import { Injectable } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import puppeteer from 'puppeteer-core';

@Injectable()
export class ReportsPdfService {
  private readonly logo64: string;
  private readonly chartJs: string;

  constructor() {
    try {
      this.logo64 = readFileSync(
        join(process.cwd(), 'public', 'images', 'logo.png'),
      ).toString('base64');
    } catch {
      this.logo64 = '';
    }
    try {
      this.chartJs = readFileSync(
        join(process.cwd(), 'node_modules', 'chart.js', 'dist', 'chart.umd.js'),
        'utf8',
      );
    } catch {
      this.chartJs = '';
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

  async generateCriticalStockPdf(data: any): Promise<Buffer> {
    return this.render(this.criticalStockHtml(data));
  }

  async generateTransferEfficiencyPdf(data: any): Promise<Buffer> {
    return this.render(this.transferEfficiencyHtml(data));
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
      await page.setContent(html, { waitUntil: 'load' });
      // Esperar a que todos los charts terminen de renderizar
      await page.waitForFunction(() => (window as any).__chartsReady === true, { timeout: 8000 }).catch(() => {});
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

  // ─── Chart helpers (Chart.js inline via Puppeteer) ────────────────────────

  private static _chartCounter = 0;

  /** Genera un <canvas> + <script> que dibuja un gráfico Chart.js inline.
   *  chartJs se carga una sola vez por página vía `chartJsTag()`.
   */
  private inlineChart(type: 'doughnut' | 'bar', config: object, width = 320, height = 200): string {
    const id = `ch_${++ReportsPdfService._chartCounter}_${Date.now()}`;
    return `<canvas id="${id}" width="${width}" height="${height}" style="max-width:100%;display:block"></canvas>
    <script>
      (function(){
        var ctx = document.getElementById('${id}').getContext('2d');
        new Chart(ctx, ${JSON.stringify({ type, ...config })});
      })();
    </script>`;
  }

  /** Script mínimo para páginas sin gráficos — marca la página como lista. */
  private readyTag(): string {
    return `<script>document.addEventListener('DOMContentLoaded',function(){window.__chartsReady=true;});</script>`;
  }

  /** Script tag con Chart.js embebido (sin red). Incluir 1 vez por página. */
  private chartJsTag(): string {
    if (!this.chartJs) return '';
    return `<script>${this.chartJs}</script>
    <script>
      // Marcar como listo cuando todos los charts del DOM hayan renderizado
      document.addEventListener('DOMContentLoaded', function() {
        requestAnimationFrame(function() { setTimeout(function(){ window.__chartsReady = true; }, 400); });
      });
    </script>`;
  }

  private readonly PALETTE_BLUE   = ['#3b82f6','#93c5fd','#1d4ed8','#60a5fa','#2563eb','#bfdbfe'];
  private readonly PALETTE_GREEN  = ['#10b981','#6ee7b7','#059669','#34d399','#047857','#a7f3d0'];
  private readonly PALETTE_ORANGE = ['#f97316','#fdba74','#ea580c','#fb923c','#c2410c','#fed7aa'];
  private readonly PALETTE_MIXED  = ['#3b82f6','#10b981','#f97316','#8b5cf6','#ef4444','#06b6d4'];

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

    // Gráfico barras: facturado vs cobrado por mes
    const revenueChartHtml = monthly.length > 0
      ? this.inlineChart('bar', {
          data: {
            labels: monthly.map((m: any) => m.month ?? '-'),
            datasets: [
              { label: 'Facturado', data: monthly.map((m: any) => Number(m.totalBilled ?? m.revenue ?? 0)), backgroundColor: '#3b82f6', borderRadius: 4 },
              { label: 'Recaudado', data: monthly.map((m: any) => Number(m.totalPaid ?? m.collected ?? 0)), backgroundColor: '#10b981', borderRadius: 4 },
            ],
          },
          options: { responsive: false, plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true } } },
        }, 520, 200)
      : this.noData();

    // Gráfico dona: métodos de pago
    const methodLabels: Record<string, string> = { cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transferencia', insurance: 'Seguro' };
    const paymentChartHtml = payments.length > 0
      ? this.inlineChart('doughnut', {
          data: {
            labels: payments.map((p: any) => methodLabels[p.method] ?? p.method ?? '-'),
            datasets: [{ data: payments.map((p: any) => Number(p.totalAmount ?? p.total ?? 0)), backgroundColor: this.PALETTE_BLUE, borderWidth: 2 }],
          },
          options: { responsive: false, plugins: { legend: { position: 'bottom' } } },
        }, 260, 180)
      : this.noData();

    return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>${this.css()}
      .chart-row{display:flex;gap:20px;align-items:flex-start;margin-bottom:12px}
      .chart-full{flex:1}
      .chart-side{width:280px;flex-shrink:0}
    </style>${this.chartJsTag()}</head><body>
      ${this.header('Reporte Financiero')}
      ${this.meta([
        ['Generado', this.nowBO()],
        ['Total facturado', this.fmtBs(summary.totalBilled)],
        ['Total cobrado', this.fmtBs(summary.totalCollected ?? summary.totalPaid)],
        ['Tasa de cobro', `${collectionRate}%`],
      ])}
      <div class="cnt">
        <div class="kpi-grid">
          ${this.kpiCard('Total Facturado', this.fmtBs(summary.totalBilled), 'Facturas emitidas', 'blue')}
          ${this.kpiCard('Total Cobrado', this.fmtBs(summary.totalCollected ?? summary.totalPaid), 'Pagos recibidos', 'green')}
          ${this.kpiCard('Pendiente de Cobro', this.fmtBs((Number(summary.totalBilled ?? 0)) - (Number(summary.totalCollected ?? summary.totalPaid ?? 0))), 'Por cobrar', 'amber')}
          ${this.kpiCard('Tasa de Cobro', `${collectionRate}%`, 'Eficiencia de cobranza', 'purple')}
        </div>

        ${this.section('Ingresos Mensuales',
          `<div class="chart-row">
            <div class="chart-full">${revenueChartHtml}</div>
            <div class="chart-side">
              <p style="font-size:7.5pt;font-weight:bold;color:#374151;margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px">Métodos de Pago</p>
              ${paymentChartHtml}
            </div>
          </div>
          ${monthly.length > 0 ? `<div style="margin-top:10px">${this.table(
            ['Mes', 'Facturado', 'Cobrado', 'Facturas'],
            monthlyRows,
            ['', 'num', 'num', 'num'],
          )}</div>` : ''}`
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

    const genderLabels = (g: any) => g.gender === 'M' ? 'Masculino' : g.gender === 'F' ? 'Femenino' : (g.gender ?? 'No especificado');
    const ageOrder = ['Under 18','18-30','31-50','51-70','Over 70'];
    const sortedAges = [...ages].sort((a: any, b: any) => ageOrder.indexOf(a.ageGroup) - ageOrder.indexOf(b.ageGroup));

    const genderChartHtml = genders.length > 0
      ? this.inlineChart('doughnut', {
          data: {
            labels: genders.map(genderLabels),
            datasets: [{ data: genders.map((g: any) => Number(g.count ?? 0)), backgroundColor: this.PALETTE_BLUE, borderWidth: 2 }],
          },
          options: { responsive: false, plugins: { legend: { position: 'bottom' } } },
        }, 240, 180)
      : this.noData();

    const ageChartHtml = sortedAges.length > 0
      ? this.inlineChart('bar', {
          data: {
            labels: sortedAges.map((a: any) => a.ageGroup ?? '-'),
            datasets: [{ label: 'Pacientes', data: sortedAges.map((a: any) => Number(a.count ?? 0)), backgroundColor: '#10b981', borderRadius: 4 }],
          },
          options: { responsive: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } },
        }, 280, 180)
      : this.noData();

    return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>${this.css()}
      .chart-row{display:flex;gap:20px;align-items:flex-start;margin-bottom:8px}
    </style>${this.chartJsTag()}</head><body>
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

        ${this.section('Distribución por Género y Grupos de Edad',
          `<div class="chart-row">
            <div style="flex:1">
              <p style="font-size:7.5pt;font-weight:bold;color:#374151;margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px">Por Género</p>
              ${genderChartHtml}
            </div>
            <div style="flex:1">
              <p style="font-size:7.5pt;font-weight:bold;color:#374151;margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px">Por Edad</p>
              ${ageChartHtml}
            </div>
          </div>`
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

    const perfChartHtml = doctors.length > 0
      ? this.inlineChart('bar', {
          data: {
            labels: doctors.map((d: any) => d.doctorName ?? '-'),
            datasets: [
              { label: 'Completadas', data: doctors.map((d: any) => Number(d.completedAppointments ?? 0)), backgroundColor: '#10b981', borderRadius: 4 },
              { label: 'Canceladas',  data: doctors.map((d: any) => Number(d.cancelledAppointments ?? 0)), backgroundColor: '#ef4444', borderRadius: 4 },
            ],
          },
          options: { responsive: false, plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true } } },
        }, 540, 200)
      : this.noData();

    return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>${this.css()}</style>${this.chartJsTag()}</head><body>
      ${this.header('Rendimiento de Médicos')}
      ${this.meta([
        ['Generado', this.nowBO()],
        ['Total médicos', this.fmtNum(doctors.length)],
      ])}
      <div class="cnt">
        ${this.section('Citas por Médico', perfChartHtml)}

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

    const statusChartHtml = statusDist.length > 0
      ? this.inlineChart('doughnut', {
          data: {
            labels: statusDist.map((s: any) => statusLabels[s.status] ?? s.status),
            datasets: [{ data: statusDist.map((s: any) => Number(s.count ?? 0)), backgroundColor: this.PALETTE_MIXED, borderWidth: 2 }],
          },
          options: { responsive: false, plugins: { legend: { position: 'bottom' } } },
        }, 240, 180)
      : this.noData();

    const trendChartHtml = monthly.length > 0
      ? this.inlineChart('bar', {
          data: {
            labels: monthly.map((m: any) => m.month ?? '-'),
            datasets: [{ label: 'Citas', data: monthly.map((m: any) => Number(m.count ?? 0)), backgroundColor: '#3b82f6', borderRadius: 4 }],
          },
          options: { responsive: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } },
        }, 310, 180)
      : this.noData();

    return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>${this.css()}
      .chart-row{display:flex;gap:20px;align-items:flex-start;margin-bottom:8px}
    </style>${this.chartJsTag()}</head><body>
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

        ${this.section('Distribución por Estado y Tendencia Mensual',
          `<div class="chart-row">
            <div style="flex:1">
              <p style="font-size:7.5pt;font-weight:bold;color:#374151;margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px">Por Estado</p>
              ${statusChartHtml}
            </div>
            <div style="flex:1">
              <p style="font-size:7.5pt;font-weight:bold;color:#374151;margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px">Tendencia Mensual</p>
              ${trendChartHtml}
            </div>
          </div>
          ${statusDist.length > 0 ? `<div style="margin-top:10px">${this.table(
            ['Estado', 'Cantidad', '% del Total'],
            statusDist.map((s: any) => [
              `<span class="badge ${statusColors[s.status] ?? 'badge-gray'}">${statusLabels[s.status] ?? this.esc(s.status)}</span>`,
              `<span class="num">${this.fmtNum(s.count)}</span>`,
              `<span class="num">${this.fmtPct(summary.totalAppointments > 0 ? (Number(s.count) / summary.totalAppointments) * 100 : 0)}</span>`,
            ]),
            ['', 'num', 'num'],
          )}</div>` : ''}`
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

    return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>${this.css()}</style>${this.readyTag()}</head><body>
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

  // ─── Critical Stock Report HTML ───────────────────────────────────────────

  private criticalStockHtml(data: any): string {
    const { belowMinimum = [], expiringSoon = [], expired = [], summary = {} } = data;

    const stockTable = (items: any[]) => {
      if (!items.length) return this.noData();
      return this.table(
        ['Medicamento', 'Lote', 'Disponible', 'Mínimo', 'Vencimiento', 'Costo Unit.'],
        items.map((s: any) => [
          `<b>${this.esc(s.medication?.name ?? '-')}</b>`,
          this.esc(s.batchNumber ?? '-'),
          `<span class="num">${this.fmtNum(s.availableQuantity)}</span>`,
          `<span class="num">${this.fmtNum(s.minimumStock)}</span>`,
          s.expiryDate ? new Date(s.expiryDate).toLocaleDateString('es-BO') : '-',
          `<span class="num">${this.fmtBs(s.unitCost)}</span>`,
        ]),
        ['', '', 'num', 'num', 'center', 'num'],
      );
    };

    return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>${this.css()}</style>${this.readyTag()}</head><body>
      ${this.header('Stock Crítico — Farmacia')}
      ${this.meta([
        ['Generado', this.nowBO()],
        ['Bajo mínimo', this.fmtNum(summary.belowMinimumCount)],
        ['Próx. a vencer', this.fmtNum(summary.expiringSoonCount)],
        ['Vencidos', this.fmtNum(summary.expiredCount)],
        ['Valor en riesgo', this.fmtBs(summary.totalAtRiskValue)],
      ])}
      <div class="cnt">
        <div class="kpi-grid">
          ${this.kpiCard('Bajo Mínimo', this.fmtNum(summary.belowMinimumCount), 'Requieren reposición', 'amber')}
          ${this.kpiCard('Próx. a Vencer', this.fmtNum(summary.expiringSoonCount), 'Próximos 60 días', 'amber')}
          ${this.kpiCard('Ya Vencidos', this.fmtNum(summary.expiredCount), 'Acción inmediata', 'red')}
          ${this.kpiCard('Valor en Riesgo', this.fmtBs(summary.totalAtRiskValue), 'Total comprometido', 'red')}
        </div>

        ${expired.length > 0 ? this.section('⚠ Ya Vencidos — Acción Inmediata', stockTable(expired)) : ''}
        ${this.section('Stock Bajo Mínimo', stockTable(belowMinimum))}
        ${this.section('Próximos a Vencer (60 días)', stockTable(expiringSoon))}
      </div>
    </body></html>`;
  }

  // ─── Transfer Efficiency Report HTML ──────────────────────────────────────

  private transferEfficiencyHtml(data: any): string {
    const { kpiByRoute = [], stalledTransfers = [], stalledCount = 0 } = data;

    const stalledAlert = stalledCount > 0
      ? `<div style="background:#fee2e2;border:1.5px solid #dc2626;border-radius:6px;padding:10px 14px;margin-bottom:14px;display:flex;align-items:center;gap:8px">
           <span style="font-size:12pt">⚠</span>
           <span style="font-size:9pt;font-weight:bold;color:#991b1b">${stalledCount} traslado(s) detenido(s) hace más de 48 horas</span>
         </div>`
      : '';

    const kpiTable = kpiByRoute.length > 0
      ? this.table(
          ['Origen', 'Destino', 'Completados', 'Hrs prom. despacho', 'Hrs prom. total', 'P95 tránsito', 'Merma (u.)'],
          kpiByRoute.map((r: any) => [
            this.esc(r.source_clinic_name ?? '-'),
            this.esc(r.target_clinic_name ?? '-'),
            `<span class="num">${this.fmtNum(r.total_completed)}</span>`,
            `<span class="num">${this.fmtNum(r.avg_hrs_to_dispatch, 1)}</span>`,
            `<span class="num">${this.fmtNum(r.avg_total_hrs, 1)}</span>`,
            `<span class="num">${this.fmtNum(r.p95_hrs_in_transit, 1)}</span>`,
            `<span class="num">${this.fmtNum(r.total_discrepancy_units)}</span>`,
          ]),
          ['', '', 'num', 'num', 'num', 'num', 'num'],
        )
      : this.noData();

    const stalledTable = stalledTransfers.length > 0
      ? this.table(
          ['N° Traspaso', 'Origen', 'Destino', 'Despachado', 'Hrs esperando'],
          stalledTransfers.map((t: any) => [
            this.esc(t.transferNumber ?? '-'),
            this.esc(t.source_clinic_name ?? '-'),
            this.esc(t.target_clinic_name ?? '-'),
            t.dispatchedAt ? new Date(t.dispatchedAt).toLocaleString('es-BO') : '-',
            `<span class="num badge badge-red">${this.fmtNum(t.hrs_waiting, 1)} hrs</span>`,
          ]),
          ['', '', '', 'center', 'num'],
        )
      : this.noData();

    return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>${this.css()}</style>${this.readyTag()}</head><body>
      ${this.header('Eficiencia de Traspasos')}
      ${this.meta([
        ['Generado', this.nowBO()],
        ['Rutas analizadas', this.fmtNum(kpiByRoute.length)],
        ['Detenidos +48h', this.fmtNum(stalledCount)],
      ])}
      <div class="cnt">
        <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr)">
          ${this.kpiCard('Rutas Analizadas', this.fmtNum(kpiByRoute.length), 'Pares origen-destino', 'blue')}
          ${this.kpiCard('Detenidos +48h', this.fmtNum(stalledCount), 'Requieren atención', stalledCount > 0 ? 'red' : 'green')}
          ${this.kpiCard('Merma Total', this.fmtNum(kpiByRoute.reduce((s: number, r: any) => s + Number(r.total_discrepancy_units ?? 0), 0)), 'Unidades con discrepancia', 'amber')}
        </div>

        ${stalledAlert}
        ${this.section('KPI por Ruta de Traspaso', kpiTable)}
        ${stalledCount > 0 ? this.section('Traslados Detenidos (+48 horas)', stalledTable) : ''}
      </div>
    </body></html>`;
  }

  // ─── Dashboard Report HTML ────────────────────────────────────────────────

  private dashboardHtml(data: any): string {
    const patients = data.patients ?? {};
    const appointments = data.appointments ?? {};
    const financial = data.financial ?? {};
    const stock = data.stock ?? {};

    return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>${this.css()}</style>${this.readyTag()}</head><body>
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

  // ─── Pharmacy Rotation PDF ────────────────────────────────────────────────

  async generateRotationPdf(data: any): Promise<Buffer> {
    return this.render(this.rotationHtml(data));
  }

  private rotationHtml(data: any[]): string {
    const critical = data.filter(r => r.alertLevel === 'critical');
    const warning  = data.filter(r => r.alertLevel === 'warning');
    const ok       = data.filter(r => r.alertLevel === 'ok');

    const alertBadge = (level: string) => {
      if (level === 'critical') return `<span class="badge badge-red">CRÍTICO</span>`;
      if (level === 'warning')  return `<span class="badge badge-amber">ATENCIÓN</span>`;
      return `<span class="badge badge-green">OK</span>`;
    };

    const rotTable = (items: any[]) => {
      if (!items.length) return this.noData();
      return this.table(
        ['Medicamento', 'Genérico', 'Categoría', 'Stock Disp.', 'Venta Diaria', 'Días Restantes', 'Alerta'],
        items.map(r => [
          `<b>${this.esc(r.medicationName ?? '-')}</b>`,
          this.esc(r.genericName ?? '-'),
          this.esc(r.category ?? '-'),
          `<span class="num">${this.fmtNum(r.availableQty)}</span>`,
          `<span class="num">${this.fmtNum(r.avgDailySales, 2)}</span>`,
          `<span class="num">${Number(r.daysRemaining) >= 9999 ? '∞' : this.fmtNum(r.daysRemaining, 1)}</span>`,
          alertBadge(r.alertLevel),
        ]),
        ['', '', '', 'num', 'num', 'num', 'center'],
      );
    };

    return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>${this.css()}</style>${this.readyTag()}</head><body>
      ${this.header('Rotación y Días de Stock — Farmacia')}
      ${this.meta([
        ['Generado', this.nowBO()],
        ['Total ítems', this.fmtNum(data.length)],
        ['Críticos (<7d)', this.fmtNum(critical.length)],
        ['Atención (<30d)', this.fmtNum(warning.length)],
      ])}
      <div class="cnt">
        <div class="kpi-grid">
          ${this.kpiCard('Total Ítems', this.fmtNum(data.length), 'Con stock activo', 'blue')}
          ${this.kpiCard('Estado Crítico', this.fmtNum(critical.length), 'Menos de 7 días', 'red')}
          ${this.kpiCard('Requieren Atención', this.fmtNum(warning.length), 'Menos de 30 días', 'amber')}
          ${this.kpiCard('Estado Normal', this.fmtNum(ok.length), 'Más de 30 días', 'green')}
        </div>

        ${critical.length > 0 ? this.section('Estado Crítico — Menos de 7 días', rotTable(critical)) : ''}
        ${warning.length  > 0 ? this.section('Requieren Atención — Menos de 30 días', rotTable(warning)) : ''}
        ${ok.length       > 0 ? this.section('Estado Normal', rotTable(ok)) : ''}
      </div>
    </body></html>`;
  }

  // ─── Pharmacy Margins PDF ─────────────────────────────────────────────────

  async generateMarginsPdf(data: any): Promise<Buffer> {
    return this.render(this.marginsHtml(data));
  }

  private marginsHtml(data: any[]): string {
    const totalMarginAbs = data.reduce((s, r) => s + Number(r.marginAbs ?? 0), 0);
    const totalRevenue   = data.reduce((s, r) => s + Number(r.sellingPrice ?? 0) * Number(r.qtySold ?? 0), 0);
    const avgMarginPct   = totalRevenue > 0 ? (totalMarginAbs / totalRevenue) * 100 : 0;

    const rows = data.map(r => [
      `<b>${this.esc(r.medicationName ?? '-')}</b>`,
      this.esc(r.genericName ?? '-'),
      `<span class="num">${this.fmtBs(r.unitCost)}</span>`,
      `<span class="num">${this.fmtBs(r.sellingPrice)}</span>`,
      `<span class="num">${this.fmtNum(r.qtySold)}</span>`,
      `<span class="num">${this.fmtBs(r.marginAbs)}</span>`,
      `<span class="num ${Number(r.marginPct) >= 20 ? 'badge badge-green' : Number(r.marginPct) >= 10 ? 'badge badge-amber' : 'badge badge-red'}">${this.fmtPct(r.marginPct)}</span>`,
    ]);

    return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>${this.css()}</style>${this.readyTag()}</head><body>
      ${this.header('Márgenes por Producto — Farmacia')}
      ${this.meta([
        ['Generado', this.nowBO()],
        ['Productos', this.fmtNum(data.length)],
        ['Margen Bruto Total', this.fmtBs(totalMarginAbs)],
        ['Margen Promedio', this.fmtPct(avgMarginPct)],
      ])}
      <div class="cnt">
        <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr)">
          ${this.kpiCard('Productos Analizados', this.fmtNum(data.length), 'Con ventas', 'blue')}
          ${this.kpiCard('Margen Bruto Total', this.fmtBs(totalMarginAbs), 'Ganancia bruta', 'green')}
          ${this.kpiCard('Margen % Promedio', this.fmtPct(avgMarginPct), 'Ponderado por ventas', 'purple')}
        </div>

        ${this.section('Detalle de Márgenes por Producto',
          data.length > 0
            ? this.table(
                ['Medicamento', 'Genérico', 'Costo Unit.', 'Precio Venta', 'Qty Vendida', 'Margen Bs', 'Margen %'],
                rows,
                ['', '', 'num', 'num', 'num', 'num', 'center'],
              )
            : this.noData()
        )}
      </div>
    </body></html>`;
  }

  // ─── Pharmacy Daily Sales PDF ─────────────────────────────────────────────

  async generateDailySalesPdf(data: any): Promise<Buffer> {
    return this.render(this.dailySalesHtml(data));
  }

  private dailySalesHtml(data: any): string {
    const daily   = data.dailySales ?? [];
    const payment = data.paymentBreakdown ?? [];

    const totalRevenue = daily.reduce((s: number, r: any) => s + Number(r.totalRevenue ?? 0), 0);
    const totalTickets = daily.reduce((s: number, r: any) => s + Number(r.ticketCount ?? 0), 0);
    const avgTicket    = totalTickets > 0 ? totalRevenue / totalTickets : 0;

    const maxRevenue = Math.max(...daily.map((d: any) => Number(d.totalRevenue ?? 0)), 1);

    const fmtDate = (d: any): string =>
      d instanceof Date ? d.toISOString().slice(0, 10) : String(d ?? '-');

    const revenueChartHtml = daily.length > 0
      ? this.inlineChart('bar', {
          data: {
            labels: daily.map((d: any) => fmtDate(d.date)),
            datasets: [{ label: 'Ingresos (Bs)', data: daily.map((d: any) => Number(d.totalRevenue ?? 0)), backgroundColor: '#f97316', borderRadius: 4 }],
          },
          options: { responsive: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } },
        }, 540, 200)
      : this.noData();

    const dailyRows = daily.map((d: any) => [
      this.esc(fmtDate(d.date)),
      `<span class="num">${this.fmtBs(d.totalRevenue)}</span>`,
      `<span class="num">${this.fmtNum(d.ticketCount)}</span>`,
      `<span class="num">${this.fmtBs(d.avgTicket)}</span>`,
    ]);

    return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>${this.css()}</style>${this.chartJsTag()}</head><body>
      ${this.header('Ventas Diarias — Farmacia')}
      ${this.meta([
        ['Generado', this.nowBO()],
        ['Total Ingresos', this.fmtBs(totalRevenue)],
        ['Total Tickets', this.fmtNum(totalTickets)],
        ['Ticket Promedio', this.fmtBs(avgTicket)],
      ])}
      <div class="cnt">
        <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr)">
          ${this.kpiCard('Total Ingresos', this.fmtBs(totalRevenue), 'Período seleccionado', 'orange')}
          ${this.kpiCard('Total Tickets', this.fmtNum(totalTickets), 'Ventas completadas', 'blue')}
          ${this.kpiCard('Ticket Promedio', this.fmtBs(avgTicket), 'Por transacción', 'green')}
        </div>

        ${this.section('Ingresos por Día', revenueChartHtml)}

        ${daily.length > 0 ? this.section('Detalle Diario',
          this.table(['Fecha', 'Ingresos', 'Tickets', 'Ticket Promedio'], dailyRows, ['', 'num', 'num', 'num'])
        ) : ''}

        ${payment.length > 0 ? this.section('Desglose por Método de Pago',
          this.table(
            ['Método', 'Total (Bs)', 'Transacciones'],
            payment.map((p: any) => [
              this.esc(p.method ?? '-'),
              `<span class="num">${this.fmtBs(p.total)}</span>`,
              `<span class="num">${this.fmtNum(p.count)}</span>`,
            ]),
            ['', 'num', 'num'],
          )
        ) : ''}
      </div>
    </body></html>`;
  }

  // ─── Pharmacy Expiry Buckets PDF ──────────────────────────────────────────

  async generateExpiryBucketsPdf(data: any): Promise<Buffer> {
    return this.render(this.expiryBucketsHtml(data));
  }

  private expiryBucketsHtml(data: any): string {
    const { already_expired = [], expires_lt30 = [], expires_30_60 = [], expires_60_90 = [], summary = {} } = data;

    const bucketTable = (items: any[]) => {
      if (!items.length) return this.noData();
      return this.table(
        ['Medicamento', 'Lote', 'Vencimiento', 'Unidades', 'Valor (Bs)'],
        items.map((r: any) => [
          `<b>${this.esc(r.medicationName ?? '-')}</b>`,
          this.esc(r.batchNumber ?? '-'),
          r.expiryDate ? new Date(r.expiryDate).toLocaleDateString('es-BO') : '-',
          `<span class="num">${this.fmtNum(r.availableQuantity)}</span>`,
          `<span class="num">${this.fmtBs(r.stockValue)}</span>`,
        ]),
        ['', '', 'center', 'num', 'num'],
      );
    };

    return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>${this.css()}</style>${this.readyTag()}</head><body>
      ${this.header('Vencimientos por Período — Farmacia')}
      ${this.meta([
        ['Generado', this.nowBO()],
        ['Ya vencidos', this.fmtNum(summary.alreadyExpiredCount)],
        ['Vencen <30d', this.fmtNum(summary.lt30Count)],
        ['Vencen 30-60d', this.fmtNum(summary.bt30_60Count)],
        ['Vencen 60-90d', this.fmtNum(summary.bt60_90Count)],
      ])}
      <div class="cnt">
        <div class="kpi-grid">
          ${this.kpiCard('Ya Vencidos', this.fmtNum(summary.alreadyExpiredCount), this.fmtBs(summary.alreadyExpiredValue), 'red')}
          ${this.kpiCard('Vencen <30 días', this.fmtNum(summary.lt30Count), this.fmtBs(summary.lt30Value), 'red')}
          ${this.kpiCard('Vencen 30-60 días', this.fmtNum(summary.bt30_60Count), this.fmtBs(summary.bt30_60Value), 'amber')}
          ${this.kpiCard('Vencen 60-90 días', this.fmtNum(summary.bt60_90Count), this.fmtBs(summary.bt60_90Value), 'amber')}
        </div>

        ${already_expired.length > 0 ? this.section('Ya Vencidos — Acción Inmediata', bucketTable(already_expired)) : ''}
        ${expires_lt30.length    > 0 ? this.section('Vencen en Menos de 30 Días', bucketTable(expires_lt30)) : ''}
        ${expires_30_60.length   > 0 ? this.section('Vencen en 30-60 Días', bucketTable(expires_30_60)) : ''}
        ${expires_60_90.length   > 0 ? this.section('Vencen en 60-90 Días', bucketTable(expires_60_90)) : ''}
      </div>
    </body></html>`;
  }

  // ─── Pharmacy Profitability PDF ───────────────────────────────────────────

  async generateProfitabilityPdf(data: any[]): Promise<Buffer> {
    return this.render(this.profitabilityHtml(data));
  }

  // ─── A1: PDF Ventas por Farmacéutico ─────────────────────────────────────

  async generateSalesByPharmacistPdf(data: any[]): Promise<Buffer> {
    return this.render(this.salesByPharmacistHtml(data));
  }

  private salesByPharmacistHtml(data: any[]): string {
    const totalRevenue = data.reduce((s, r) => s + Number(r.totalRevenue ?? 0), 0);
    const totalUnits   = data.reduce((s, r) => s + Number(r.totalUnits ?? 0), 0);
    const totalSales   = data.reduce((s, r) => s + Number(r.salesCount ?? 0), 0);

    const chartHtml = data.length > 0
      ? this.inlineChart('bar', {
          data: {
            labels: data.map(r => this.esc(r.pharmacistName ?? '-')),
            datasets: [{ label: 'Ingresos (Bs)', data: data.map(r => Number(r.totalRevenue ?? 0)), backgroundColor: '#8b5cf6', borderRadius: 4 }],
          },
          options: { responsive: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } },
        }, 540, 200)
      : this.noData();

    const rows = data.map(r => [
      `<b>${this.esc(r.pharmacistName ?? '-')}</b>`,
      `<span class="num">${this.fmtNum(r.salesCount)}</span>`,
      `<span class="num">${this.fmtNum(r.totalUnits)}</span>`,
      `<span class="num">${this.fmtBs(r.totalRevenue)}</span>`,
      `<span class="num">${this.fmtBs(r.avgTicket)}</span>`,
      `<span class="num">${this.fmtNum(r.workDays)}</span>`,
      `<span class="num">${this.fmtPct(r.revenuePct)}</span>`,
    ]);

    return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>${this.css()}</style>${this.chartJsTag()}</head><body>
      ${this.header('Ventas por Farmacéutico')}
      ${this.meta([
        ['Generado', this.nowBO()],
        ['Total Ingresos', this.fmtBs(totalRevenue)],
        ['Total Tickets', this.fmtNum(totalSales)],
        ['Total Unidades', this.fmtNum(totalUnits)],
      ])}
      <div class="cnt">
        <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr)">
          ${this.kpiCard('Total Ingresos', this.fmtBs(totalRevenue), 'Período seleccionado', 'purple')}
          ${this.kpiCard('Total Ventas', this.fmtNum(totalSales), 'Tickets emitidos', 'blue')}
          ${this.kpiCard('Farmacéuticos', this.fmtNum(data.length), 'Con ventas en el período', 'green')}
        </div>
        ${this.section('Ingresos por Farmacéutico', chartHtml)}
        ${data.length > 0 ? this.section('Detalle por Encargado',
          this.table(
            ['Farmacéutico', 'Ventas', 'Unidades', 'Ingresos', 'Ticket Prom.', 'Días trab.', '% del total'],
            rows,
            ['', 'num', 'num', 'num', 'num', 'num', 'center'],
          )
        ) : ''}
      </div>
    </body></html>`;
  }

  // ─── A2: PDF Encargado × Día × Medicamento ────────────────────────────────

  async generatePharmacistDayMedicationPdf(data: any): Promise<Buffer> {
    return this.render(this.pharmacistDayMedicationHtml(data));
  }

  private pharmacistDayMedicationHtml(data: any): string {
    const rows: any[] = data.rows ?? [];
    const byPharmacist: any[] = data.byPharmacist ?? [];

    const totalRevenue = rows.reduce((s: number, r: any) => s + Number(r.totalRevenue ?? 0), 0);
    const totalUnits   = rows.reduce((s: number, r: any) => s + Number(r.qtySold ?? 0), 0);

    const tableRows = rows.slice(0, 200).map((r: any) => [
      this.esc(r.pharmacistName ?? '-'),
      this.esc(r.saleDay ?? '-'),
      `<b>${this.esc(r.medicationName ?? '-')}</b>`,
      this.esc(r.category ?? '-'),
      `<span class="num">${this.fmtNum(r.qtySold)}</span>`,
      `<span class="num">${this.fmtBs(r.totalRevenue)}</span>`,
      `<span class="num">${this.fmtBs(r.unitPrice)}</span>`,
    ]);

    return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>${this.css()}</style>${this.readyTag()}</head><body>
      ${this.header('Detalle Encargado × Día × Medicamento')}
      ${this.meta([
        ['Generado', this.nowBO()],
        ['Total Ingresos', this.fmtBs(totalRevenue)],
        ['Total Unidades', this.fmtNum(totalUnits)],
        ['Farmacéuticos', this.fmtNum(byPharmacist.length)],
      ])}
      <div class="cnt">
        <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr)">
          ${this.kpiCard('Total Ingresos', this.fmtBs(totalRevenue), 'Período seleccionado', 'purple')}
          ${this.kpiCard('Total Unidades', this.fmtNum(totalUnits), 'Dispensadas', 'orange')}
          ${this.kpiCard('Farmacéuticos', this.fmtNum(byPharmacist.length), 'Con actividad', 'blue')}
        </div>
        ${rows.length > 0 ? this.section('Detalle Completo (máx. 200 filas)',
          this.table(
            ['Farmacéutico', 'Fecha', 'Medicamento', 'Categoría', 'Unidades', 'Ingresos', 'Precio Unit.'],
            tableRows,
            ['', 'center', '', '', 'num', 'num', 'num'],
          )
        ) : this.noData()}
      </div>
    </body></html>`;
  }

  // ─── B1: PDF Inventario Valorizado ───────────────────────────────────────

  async generateValorizedInventoryPdf(data: any): Promise<Buffer> {
    return this.render(this.valorizedInventoryHtml(data));
  }

  private valorizedInventoryHtml(data: any): string {
    const rows: any[] = data.rows ?? [];
    const summary     = data.summary ?? {};

    const statusLabel: Record<string, string> = {
      ok: 'Normal', critico: 'Crítico', sin_stock: 'Sin Stock', por_vencer: 'Por Vencer',
    };
    const statusClass: Record<string, string> = {
      ok: 'badge-green', critico: 'badge-red', sin_stock: 'badge-red', por_vencer: 'badge-amber',
    };

    const tableRows = rows.map((r: any) => [
      `<b>${this.esc(r.medicationName ?? '-')}</b>`,
      this.esc(r.genericName ?? '-'),
      this.esc(r.category ?? '-'),
      this.esc(r.batchNumber ?? '-'),
      `<span class="num">${this.fmtNum(r.availableQuantity)}</span>`,
      `<span class="num">${this.fmtNum(r.minimumStock)}</span>`,
      `<span class="num">${this.fmtBs(r.unitCost)}</span>`,
      `<span class="num">${this.fmtBs(r.sellingPrice)}</span>`,
      `<span class="num">${this.fmtBs(r.costValue)}</span>`,
      `<span class="badge ${statusClass[r.status] ?? 'badge-green'}">${statusLabel[r.status] ?? r.status}</span>`,
    ]);

    return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>${this.css()}</style>${this.readyTag()}</head><body>
      ${this.header('Inventario General Valorizado')}
      ${this.meta([
        ['Generado', this.nowBO()],
        ['Productos', this.fmtNum(summary.totalProducts)],
        ['Valor Costo', this.fmtBs(summary.totalCostValue)],
        ['Valor Venta', this.fmtBs(summary.totalSaleValue)],
        ['Margen Potencial', this.fmtBs(summary.potentialMargin)],
      ])}
      <div class="cnt">
        <div class="kpi-grid">
          ${this.kpiCard('Valor a Costo', this.fmtBs(summary.totalCostValue), `${this.fmtNum(summary.totalProducts)} SKUs`, 'blue')}
          ${this.kpiCard('Valor Venta', this.fmtBs(summary.totalSaleValue), 'Precio de venta', 'green')}
          ${this.kpiCard('Margen Potencial', this.fmtBs(summary.potentialMargin), 'Si se vende todo', 'purple')}
          ${this.kpiCard('Alertas', this.fmtNum((summary.sinStock ?? 0) + (summary.critico ?? 0) + (summary.porVencer ?? 0)), 'Sin stock + crítico + por vencer', 'red')}
        </div>
        ${rows.length > 0 ? this.section('Detalle de Inventario',
          this.table(
            ['Medicamento', 'Genérico', 'Categoría', 'Lote', 'Disponible', 'Mínimo', 'Costo', 'Precio', 'Valor Costo', 'Estado'],
            tableRows,
            ['', '', '', '', 'num', 'num', 'num', 'num', 'num', 'center'],
          )
        ) : this.noData()}
      </div>
    </body></html>`;
  }

  // ─── B2: PDF Inventario por Categoría ────────────────────────────────────

  async generateInventoryByCategoryPdf(data: any[]): Promise<Buffer> {
    return this.render(this.inventoryByCategoryHtml(data));
  }

  private inventoryByCategoryHtml(data: any[]): string {
    const totalCost  = data.reduce((s, r) => s + Number(r.totalCostValue ?? 0), 0);
    const totalSale  = data.reduce((s, r) => s + Number(r.totalSaleValue ?? 0), 0);
    const totalUnits = data.reduce((s, r) => s + Number(r.totalUnits ?? 0), 0);

    const chartHtml = data.length > 0
      ? this.inlineChart('doughnut', {
          data: {
            labels: data.map(r => this.esc(r.category ?? 'Sin categoría')),
            datasets: [{
              data: data.map(r => Number(r.totalCostValue ?? 0)),
              backgroundColor: this.PALETTE_MIXED,
              borderWidth: 2,
            }],
          },
          options: { responsive: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 10 } } } } },
        }, 320, 220)
      : this.noData();

    const rows = data.map(r => [
      `<b>${this.esc(r.category ?? 'Sin categoría')}</b>`,
      `<span class="num">${this.fmtNum(r.productCount)}</span>`,
      `<span class="num">${this.fmtNum(r.totalUnits)}</span>`,
      `<span class="num">${this.fmtBs(r.totalCostValue)}</span>`,
      `<span class="num">${this.fmtBs(r.totalSaleValue)}</span>`,
      `<span class="num ${Number(r.lowStockCount) > 0 ? 'badge badge-amber' : ''}">${this.fmtNum(r.lowStockCount)}</span>`,
      `<span class="num ${Number(r.expiringSoonCount) > 0 ? 'badge badge-red' : ''}">${this.fmtNum(r.expiringSoonCount)}</span>`,
    ]);

    return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>${this.css()}
      .chart-row{display:flex;gap:20px;align-items:flex-start;margin-bottom:8px}
    </style>${this.chartJsTag()}</head><body>
      ${this.header('Inventario por Categoría')}
      ${this.meta([
        ['Generado', this.nowBO()],
        ['Categorías', this.fmtNum(data.length)],
        ['Total SKUs', this.fmtNum(data.reduce((s, r) => s + Number(r.productCount ?? 0), 0))],
        ['Valor Total Costo', this.fmtBs(totalCost)],
        ['Valor Total Venta', this.fmtBs(totalSale)],
      ])}
      <div class="cnt">
        <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr)">
          ${this.kpiCard('Categorías', this.fmtNum(data.length), 'Activas con stock', 'blue')}
          ${this.kpiCard('Total Unidades', this.fmtNum(totalUnits), 'En stock', 'green')}
          ${this.kpiCard('Valor Costo Total', this.fmtBs(totalCost), 'Inversión en inventario', 'orange')}
        </div>
        ${this.section('Distribución por Categoría (valor costo)', chartHtml)}
        ${data.length > 0 ? this.section('Resumen por Categoría',
          this.table(
            ['Categoría', 'Productos', 'Unidades', 'Valor Costo', 'Valor Venta', 'Bajo Mínimo', 'Por Vencer'],
            rows,
            ['', 'num', 'num', 'num', 'num', 'center', 'center'],
          )
        ) : this.noData()}
      </div>
    </body></html>`;
  }

  // ─── B3: PDF Medicamentos sin Movimiento ─────────────────────────────────

  async generateNoMovementPdf(data: any): Promise<Buffer> {
    return this.render(this.noMovementHtml(data));
  }

  private noMovementHtml(data: any): string {
    const rows: any[] = data.rows ?? [];
    const days: number = data.days ?? 30;
    const totalStockValue: number = data.totalStockValue ?? 0;

    const tableRows = rows.map((r: any) => {
      const expiry = r.expiryDate ? new Date(r.expiryDate).toLocaleDateString('es-BO') : '-';
      const lastSale = r.lastSaleDate
        ? (r.lastSaleDate instanceof Date ? r.lastSaleDate : new Date(r.lastSaleDate)).toLocaleDateString('es-BO')
        : 'Sin ventas';
      return [
        `<b>${this.esc(r.medicationName ?? '-')}</b>`,
        this.esc(r.genericName ?? '-'),
        this.esc(r.category ?? '-'),
        this.esc(r.batchNumber ?? '-'),
        `<span class="num">${this.fmtNum(r.availableQuantity)}</span>`,
        `<span class="num">${this.fmtBs(r.stockValue)}</span>`,
        expiry,
        lastSale,
      ];
    });

    return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>${this.css()}</style>${this.readyTag()}</head><body>
      ${this.header(`Medicamentos Sin Movimiento (>${days} días)`)}
      ${this.meta([
        ['Generado', this.nowBO()],
        ['Sin movimiento', this.fmtNum(rows.length)],
        ['Valor inmovilizado', this.fmtBs(totalStockValue)],
        ['Umbral', `${days} días`],
      ])}
      <div class="cnt">
        <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr)">
          ${this.kpiCard('Sin Movimiento', this.fmtNum(rows.length), `Más de ${days} días`, 'red')}
          ${this.kpiCard('Valor Inmovilizado', this.fmtBs(totalStockValue), 'A precio de costo', 'amber')}
          ${this.kpiCard('Acción Recomendada', 'Revisión', 'Promocionar o devolver', 'purple')}
        </div>
        ${rows.length > 0 ? this.section('Detalle de Medicamentos Inactivos',
          this.table(
            ['Medicamento', 'Genérico', 'Categoría', 'Lote', 'Disponible', 'Valor', 'Vencimiento', 'Última Venta'],
            tableRows,
            ['', '', '', '', 'num', 'num', 'center', 'center'],
          )
        ) : this.noData()}
      </div>
    </body></html>`;
  }

  // ─── C1: PDF Ventas por Medicamento Detalle ───────────────────────────────

  async generateMedicationDetailPdf(data: any[]): Promise<Buffer> {
    return this.render(this.medicationDetailHtml(data));
  }

  private medicationDetailHtml(data: any[]): string {
    const totalRevenue = data.reduce((s, r) => s + Number(r.totalRevenue ?? 0), 0);
    const totalUnits   = data.reduce((s, r) => s + Number(r.qtySold ?? 0), 0);
    const totalMargin  = data.reduce((s, r) => s + Number(r.grossMargin ?? 0), 0);

    const chartHtml = data.slice(0, 15).length > 0
      ? this.inlineChart('bar', {
          data: {
            labels: data.slice(0, 15).map(r => this.esc(r.medicationName ?? '-')),
            datasets: [
              { label: 'Ingresos', data: data.slice(0, 15).map(r => Number(r.totalRevenue ?? 0)), backgroundColor: '#3b82f6', borderRadius: 4 },
              { label: 'Margen',   data: data.slice(0, 15).map(r => Number(r.grossMargin ?? 0)),  backgroundColor: '#10b981', borderRadius: 4 },
            ],
          },
          options: { responsive: false, plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true } } },
        }, 540, 220)
      : this.noData();

    const rows = data.map(r => [
      `<b>${this.esc(r.medicationName ?? '-')}</b>`,
      this.esc(r.category ?? '-'),
      this.esc(r.dosageForm ?? '-'),
      `<span class="num">${this.fmtNum(r.qtySold)}</span>`,
      `<span class="num">${this.fmtBs(r.avgUnitPrice)}</span>`,
      `<span class="num">${this.fmtBs(r.totalRevenue)}</span>`,
      `<span class="num">${this.fmtBs(r.grossMargin)}</span>`,
      `<span class="num ${Number(r.marginPct) >= 20 ? 'badge badge-green' : Number(r.marginPct) >= 10 ? 'badge badge-amber' : 'badge badge-red'}">${this.fmtPct(r.marginPct)}</span>`,
    ]);

    return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>${this.css()}</style>${this.chartJsTag()}</head><body>
      ${this.header('Ventas por Medicamento — Detalle')}
      ${this.meta([
        ['Generado', this.nowBO()],
        ['Productos vendidos', this.fmtNum(data.length)],
        ['Total Ingresos', this.fmtBs(totalRevenue)],
        ['Margen Bruto', this.fmtBs(totalMargin)],
      ])}
      <div class="cnt">
        <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr)">
          ${this.kpiCard('Total Ingresos', this.fmtBs(totalRevenue), 'Período seleccionado', 'blue')}
          ${this.kpiCard('Total Unidades', this.fmtNum(totalUnits), 'Dispensadas', 'orange')}
          ${this.kpiCard('Margen Bruto', this.fmtBs(totalMargin), 'Ganancia bruta', 'green')}
        </div>
        ${this.section('Top 15 Medicamentos por Ingresos', chartHtml)}
        ${data.length > 0 ? this.section('Detalle Completo',
          this.table(
            ['Medicamento', 'Categoría', 'Forma', 'Unidades', 'Precio Prom.', 'Ingresos', 'Margen Bs', 'Margen %'],
            rows,
            ['', '', '', 'num', 'num', 'num', 'num', 'center'],
          )
        ) : this.noData()}
      </div>
    </body></html>`;
  }

  // ─── C2: PDF Ventas con Receta vs Libres ─────────────────────────────────

  async generatePrescriptionVsFreePdf(data: any): Promise<Buffer> {
    return this.render(this.prescriptionVsFreeHtml(data));
  }

  private prescriptionVsFreeHtml(data: any): string {
    const summary: any[]     = data.summary ?? [];
    const byMedication: any[] = data.byMedication ?? [];

    const typeLabel: Record<string, string> = { con_receta: 'Con Receta', libre: 'Venta Libre' };
    const conReceta = summary.find(r => r.type === 'con_receta') ?? {};
    const libre     = summary.find(r => r.type === 'libre') ?? {};

    const chartHtml = summary.length > 0
      ? this.inlineChart('doughnut', {
          data: {
            labels: summary.map(r => typeLabel[r.type] ?? r.type),
            datasets: [{
              data: summary.map(r => Number(r.totalRevenue ?? 0)),
              backgroundColor: ['#3b82f6', '#10b981'],
              borderWidth: 2,
            }],
          },
          options: { responsive: false, plugins: { legend: { position: 'bottom' } } },
        }, 280, 200)
      : this.noData();

    const medCR = byMedication.filter((r: any) => r.type === 'con_receta').slice(0, 15);
    const medLib = byMedication.filter((r: any) => r.type === 'libre').slice(0, 15);
    const medTable = (items: any[]) => items.length > 0
      ? this.table(
          ['Medicamento', 'Unidades', 'Ingresos'],
          items.map((r: any) => [
            this.esc(r.medicationName ?? '-'),
            `<span class="num">${this.fmtNum(r.qtySold)}</span>`,
            `<span class="num">${this.fmtBs(r.revenue)}</span>`,
          ]),
          ['', 'num', 'num'],
        )
      : this.noData();

    return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>${this.css()}
      .chart-row{display:flex;gap:20px;align-items:flex-start;margin-bottom:8px}
    </style>${this.chartJsTag()}</head><body>
      ${this.header('Ventas con Receta vs. Ventas Libres')}
      ${this.meta([
        ['Generado', this.nowBO()],
        ['Con receta', `${this.fmtBs(conReceta.totalRevenue)} (${conReceta.pct ?? 0}%)`],
        ['Libre', `${this.fmtBs(libre.totalRevenue)} (${libre.pct ?? 0}%)`],
      ])}
      <div class="cnt">
        <div class="kpi-grid">
          ${this.kpiCard('Con Receta', this.fmtBs(conReceta.totalRevenue), `${conReceta.pct ?? 0}% del total`, 'blue')}
          ${this.kpiCard('Venta Libre', this.fmtBs(libre.totalRevenue), `${libre.pct ?? 0}% del total`, 'green')}
          ${this.kpiCard('Tickets CR', this.fmtNum(conReceta.salesCount), 'Ventas con receta', 'purple')}
          ${this.kpiCard('Tickets Libres', this.fmtNum(libre.salesCount), 'Ventas sin receta', 'orange')}
        </div>
        <div class="chart-row">
          <div>${this.section('Distribución de Ingresos', chartHtml)}</div>
        </div>
        ${this.section('Top Medicamentos — Con Receta', medTable(medCR))}
        ${this.section('Top Medicamentos — Venta Libre', medTable(medLib))}
      </div>
    </body></html>`;
  }

  private profitabilityHtml(data: any[]): string {
    const totalRevenue = data.reduce((s, r) => s + Number(r.revenue ?? 0), 0);
    const totalCogs    = data.reduce((s, r) => s + Number(r.cogs ?? 0), 0);
    const totalMargin  = totalRevenue - totalCogs;
    const avgMarginPct = totalRevenue > 0 ? (totalMargin / totalRevenue) * 100 : 0;

    const profitChartHtml = data.length > 0
      ? this.inlineChart('bar', {
          data: {
            labels: data.map(r => r.month ?? '-'),
            datasets: [
              { label: 'Ingresos', data: data.map(r => Number(r.revenue ?? 0)), backgroundColor: '#3b82f6', borderRadius: 4 },
              { label: 'COGS',     data: data.map(r => Number(r.cogs ?? 0)),    backgroundColor: '#ef4444', borderRadius: 4 },
              { label: 'Margen',   data: data.map(r => Number(r.grossMargin ?? 0)), backgroundColor: '#10b981', borderRadius: 4 },
            ],
          },
          options: { responsive: false, plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true } } },
        }, 540, 220)
      : this.noData();

    const tableRows = data.map(r => [
      this.esc(r.month ?? '-'),
      `<span class="num">${this.fmtBs(r.revenue)}</span>`,
      `<span class="num">${this.fmtBs(r.cogs)}</span>`,
      `<span class="num">${this.fmtBs(r.grossMargin)}</span>`,
      `<span class="num ${Number(r.grossMarginPct) >= 20 ? 'badge badge-green' : Number(r.grossMarginPct) >= 10 ? 'badge badge-amber' : 'badge badge-red'}">${this.fmtPct(r.grossMarginPct)}</span>`,
    ]);

    return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>${this.css()}</style>${this.chartJsTag()}</head><body>
      ${this.header('Rentabilidad Mensual — Farmacia')}
      ${this.meta([
        ['Generado', this.nowBO()],
        ['Ingresos Totales', this.fmtBs(totalRevenue)],
        ['COGS Total', this.fmtBs(totalCogs)],
        ['Margen Bruto', this.fmtBs(totalMargin)],
        ['Margen %', this.fmtPct(avgMarginPct)],
      ])}
      <div class="cnt">
        <div class="kpi-grid">
          ${this.kpiCard('Ingresos Totales', this.fmtBs(totalRevenue), 'Ventas completadas', 'blue')}
          ${this.kpiCard('COGS Total', this.fmtBs(totalCogs), 'Costo de mercadería vendida', 'red')}
          ${this.kpiCard('Margen Bruto', this.fmtBs(totalMargin), 'Ganancia bruta', 'green')}
          ${this.kpiCard('Margen %', this.fmtPct(avgMarginPct), 'Del período total', 'purple')}
        </div>

        ${this.section('Evolución Mensual', profitChartHtml)}

        ${data.length > 0 ? this.section('Detalle por Mes',
          this.table(
            ['Mes', 'Ingresos', 'COGS', 'Margen Bruto', 'Margen %'],
            tableRows,
            ['', 'num', 'num', 'num', 'center'],
          )
        ) : ''}
      </div>
    </body></html>`;
  }

  // ─── C3: PDF Ventas por método de pago ───────────────────────────────────

  async generateSalesByPaymentMethodPdf(data: any): Promise<Buffer> {
    return this.render(this.salesByPaymentMethodHtml(data));
  }

  private salesByPaymentMethodHtml(data: any): string {
    const summary: any[] = data.summary ?? [];
    const daily: any[]   = data.daily ?? [];
    const grandTotal: number = data.grandTotal ?? 0;

    const methodLabel: Record<string, string> = {
      cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transferencia', qr: 'QR', other: 'Otro',
    };
    const methodColor: Record<string, string> = {
      cash: '#22c55e', card: '#3b82f6', transfer: '#f59e0b', qr: '#8b5cf6', other: '#6b7280',
    };

    const chartHtml = summary.length > 0
      ? this.inlineChart('doughnut', {
          labels: summary.map(r => methodLabel[r.method as string] ?? r.method),
          datasets: [{ data: summary.map(r => Number(r.totalRevenue ?? 0)), backgroundColor: summary.map(r => methodColor[r.method as string] ?? '#6b7280') }],
        }, 320, 200)
      : this.noData();

    const summaryRows = summary.map(r => [
      `<b>${methodLabel[r.method as string] ?? this.esc(r.method as string)}</b>`,
      `<span class="num">${this.fmtNum(r.salesCount)}</span>`,
      `<span class="num">${this.fmtBs(r.totalRevenue)}</span>`,
      `<span class="num">${this.fmtBs(r.avgTicket)}</span>`,
      `<span class="num">${r.pct ?? 0}%</span>`,
      `<span class="num">${this.fmtBs(r.totalChange)}</span>`,
    ]);

    const dailyRows = daily.slice(0, 150).map(r => [
      this.esc(r.saleDay as string),
      `<b>${methodLabel[r.method as string] ?? this.esc(r.method as string)}</b>`,
      `<span class="num">${this.fmtNum(r.salesCount)}</span>`,
      `<span class="num">${this.fmtBs(r.totalRevenue)}</span>`,
    ]);

    return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>${this.css()}</style>${this.chartJsTag()}</head><body>
      ${this.header('Ventas por Método de Pago')}
      ${this.meta([
        ['Generado', this.nowBO()],
        ['Total Ingresos', this.fmtBs(grandTotal)],
        ['Métodos', this.fmtNum(summary.length)],
      ])}
      <div class="cnt">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
          <div>
            ${this.section('Distribución por Método', chartHtml)}
          </div>
          <div>
            <div class="kpi-grid" style="grid-template-columns:1fr 1fr">
              ${summary.slice(0, 4).map(r =>
                this.kpiCard(methodLabel[r.method as string] ?? r.method, this.fmtBs(r.totalRevenue), `${r.pct ?? 0}% · ${this.fmtNum(r.salesCount)} ventas`, 'blue')
              ).join('')}
            </div>
          </div>
        </div>
        ${this.section('Resumen por Método',
          this.table(
            ['Método', 'N° Ventas', 'Total', 'Ticket Prom.', '% Total', 'Vuelto Total'],
            summaryRows,
            ['', 'num', 'num', 'num', 'center', 'num'],
          )
        )}
        ${daily.length > 0 ? this.section('Detalle Diario por Método (máx. 150)',
          this.table(
            ['Fecha', 'Método', 'N° Ventas', 'Total'],
            dailyRows,
            ['center', '', 'num', 'num'],
          )
        ) : ''}
      </div>
    </body></html>`;
  }

  // ─── C6: PDF Comparativo mensual ─────────────────────────────────────────

  async generateMonthlySalesComparisonPdf(data: any): Promise<Buffer> {
    return this.render(this.monthlySalesComparisonHtml(data));
  }

  private monthlySalesComparisonHtml(data: any): string {
    const rows: any[]   = data.rows ?? [];
    const summary: any  = data.summary ?? {};

    const months  = rows.map(r => r.month as string);
    const revenues = rows.map(r => Number(r.totalRevenue ?? 0));
    const counts   = rows.map(r => Number(r.salesCount ?? 0));

    const barChart = rows.length > 0
      ? this.inlineChart('bar', {
          labels: months,
          datasets: [
            { label: 'Ingresos (Bs)', data: revenues, backgroundColor: '#3b82f6' },
            { label: 'N° Ventas',     data: counts,   backgroundColor: '#22c55e' },
          ],
        }, 560, 220)
      : this.noData();

    const tableRows = rows.map(r => {
      const growth = r.revenueGrowth;
      const growthHtml = growth === null
        ? '—'
        : `<span style="color:${Number(growth) >= 0 ? '#16a34a' : '#dc2626'}">${Number(growth) >= 0 ? '▲' : '▼'} ${Math.abs(Number(growth))}%</span>`;
      return [
        `<b>${r.month}</b>`,
        `<span class="num">${this.fmtNum(r.salesCount)}</span>`,
        `<span class="num">${this.fmtNum(r.totalUnits)}</span>`,
        `<span class="num">${this.fmtBs(r.totalRevenue)}</span>`,
        `<span class="num">${this.fmtBs(r.avgTicket)}</span>`,
        `<span class="num">${this.fmtNum(r.uniquePatients)}</span>`,
        `<span class="num">${this.fmtNum(r.prescriptionSales)}</span>`,
        growthHtml,
      ];
    });

    return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>${this.css()}</style>${this.chartJsTag()}</head><body>
      ${this.header('Comparativo Mensual de Ventas — Últimos 6 Meses')}
      ${this.meta([
        ['Generado', this.nowBO()],
        ['Ingresos Totales', this.fmtBs(summary.totalRevenue)],
        ['Promedio Mensual', this.fmtBs(summary.avgMonthlyRevenue)],
        ['Mejor Mes', this.esc(summary.bestMonth)],
      ])}
      <div class="cnt">
        <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr)">
          ${this.kpiCard('Ingresos Totales', this.fmtBs(summary.totalRevenue), '6 meses', 'blue')}
          ${this.kpiCard('Promedio Mensual', this.fmtBs(summary.avgMonthlyRevenue), 'Por mes', 'green')}
          ${this.kpiCard('Mejor Mes', this.esc(summary.bestMonth), 'Mayor ingreso', 'purple')}
        </div>
        ${this.section('Evolución Mensual', barChart)}
        ${rows.length > 0 ? this.section('Detalle por Mes',
          this.table(
            ['Mes', 'N° Ventas', 'Unidades', 'Ingresos', 'Ticket Prom.', 'Pacientes', 'Con Receta', 'Variación'],
            tableRows,
            ['center', 'num', 'num', 'num', 'num', 'num', 'num', 'center'],
          )
        ) : this.noData()}
      </div>
    </body></html>`;
  }
}
