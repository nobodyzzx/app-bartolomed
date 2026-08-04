import { Injectable } from '@nestjs/common';
import { TypstCompilerService } from '../../pdf/typst-compiler.service';
import { ChartRasterizerService } from '../../pdf/chart-rasterizer.service';
import { typstEscape, typstString } from '../../pdf/utils/typst-escape.util';

import {
  AppointmentsReportData,
  CriticalStockReportData,
  DailySalesReportData,
  DashboardReportData,
  DemographicsReportData,
  DoctorPerformanceReportData,
  ExpiryBucketsReportData,
  FinancialReportData,
  InventoryByCategoryRow,
  MarginRow,
  MedicalRecordsReportData,
  MedicationDetailRow,
  MonthlySalesComparisonData,
  NoMovementReportData,
  Numeric,
  PharmacistDayMedicationData,
  PrescriptionVsFreeData,
  ProfitabilityRow,
  RotationRow,
  SalesByPaymentMethodData,
  SalesByPharmacistRow,
  TransferEfficiencyReportData,
  ValorizedInventoryData,
} from './reports-pdf.types';

@Injectable()
export class ReportsPdfService {
  constructor(
    private readonly typstCompiler: TypstCompilerService,
    private readonly chartRasterizer: ChartRasterizerService,
  ) {}

  // ─── API pública ──────────────────────────────────────────────────────────

  async generateFinancialPdf(data: FinancialReportData): Promise<Buffer> {
    const d: any = data;
    const monthly = d.monthlyRevenue ?? [];
    const payments = d.paymentMethods ?? [];
    const assets: Array<{ filename: string; buffer: Buffer }> = [];

    const revenueChartTypst = monthly.length > 0
      ? await this.rasterizeChart(assets, 'chart-revenue.png', {
          type: 'bar',
          data: {
            labels: monthly.map((m: any) => m.month ?? '-'),
            datasets: [
              { label: 'Facturado', data: monthly.map((m: any) => Number(m.totalBilled ?? m.revenue ?? 0)), backgroundColor: '#3b82f6', borderRadius: 4 },
              { label: 'Recaudado', data: monthly.map((m: any) => Number(m.totalPaid ?? m.collected ?? 0)), backgroundColor: '#10b981', borderRadius: 4 },
            ],
          },
          options: { responsive: false, plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true } } },
        }, 520, 200)
      : '#noData()';

    const methodLabels: Record<string, string> = { cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transferencia', insurance: 'Seguro' };
    const paymentChartTypst = payments.length > 0
      ? await this.rasterizeChart(assets, 'chart-payment-methods.png', {
          type: 'doughnut',
          data: {
            labels: payments.map((p: any) => methodLabels[p.method] ?? p.method ?? '-'),
            datasets: [{ data: payments.map((p: any) => Number(p.totalAmount ?? p.total ?? 0)), backgroundColor: this.PALETTE_BLUE, borderWidth: 2 }],
          },
          options: { responsive: false, plugins: { legend: { position: 'bottom' } } },
        }, 260, 180)
      : '#noData()';

    return this.typstCompiler.compile(this.financialTypst(d, revenueChartTypst, paymentChartTypst), assets);
  }

  async generateDemographicsPdf(data: DemographicsReportData): Promise<Buffer> {
    const d: any = data;
    const genders = d.genderDistribution ?? [];
    const ages = d.ageDistribution ?? [];
    const ageOrder = ['Menor de 18', '18-30', '31-50', '51-70', 'Mayor de 70'];
    const sortedAges = [...ages].sort((a: any, b: any) => ageOrder.indexOf(a.ageGroup) - ageOrder.indexOf(b.ageGroup));
    // Bug real heredado de la versión Puppeteer, encontrado en vivo: comparaba
    // contra 'M'/'F', pero el enum Gender de patient.entity.ts usa
    // 'male'/'female' — la traducción nunca disparaba y el gráfico/leyenda
    // mostraban el valor crudo en inglés.
    const genderLabels = (g: any) => (g.gender === 'male' ? 'Masculino' : g.gender === 'female' ? 'Femenino' : (g.gender ?? 'No especificado'));
    const assets: Array<{ filename: string; buffer: Buffer }> = [];

    const genderChartTypst = genders.length > 0
      ? await this.rasterizeChart(assets, 'chart-gender.png', {
          type: 'doughnut',
          data: {
            labels: genders.map(genderLabels),
            datasets: [{ data: genders.map((g: any) => Number(g.count ?? 0)), backgroundColor: this.PALETTE_BLUE, borderWidth: 2 }],
          },
          options: { responsive: false, plugins: { legend: { position: 'bottom' } } },
        }, 240, 180)
      : '#noData()';

    const ageChartTypst = sortedAges.length > 0
      ? await this.rasterizeChart(assets, 'chart-age.png', {
          type: 'bar',
          data: {
            labels: sortedAges.map((a: any) => a.ageGroup ?? '-'),
            datasets: [{ label: 'Pacientes', data: sortedAges.map((a: any) => Number(a.count ?? 0)), backgroundColor: '#10b981', borderRadius: 4 }],
          },
          options: { responsive: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } },
        }, 280, 180)
      : '#noData()';

    return this.typstCompiler.compile(this.demographicsTypst(d, genderChartTypst, ageChartTypst), assets);
  }

  async generateDoctorPerformancePdf(data: DoctorPerformanceReportData): Promise<Buffer> {
    const d: any = data;
    const doctors = d.doctorPerformance ?? [];
    const assets: Array<{ filename: string; buffer: Buffer }> = [];

    const perfChartTypst = doctors.length > 0
      ? await this.rasterizeChart(assets, 'chart-doctor-performance.png', {
          type: 'bar',
          data: {
            labels: doctors.map((doc: any) => doc.doctorName ?? '-'),
            datasets: [
              { label: 'Completadas', data: doctors.map((doc: any) => Number(doc.completedAppointments ?? 0)), backgroundColor: '#10b981', borderRadius: 4 },
              { label: 'Canceladas', data: doctors.map((doc: any) => Number(doc.cancelledAppointments ?? 0)), backgroundColor: '#ef4444', borderRadius: 4 },
            ],
          },
          options: { responsive: false, plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true } } },
        }, 540, 200)
      : '#noData()';

    return this.typstCompiler.compile(this.doctorPerformanceTypst(d, perfChartTypst), assets);
  }

  async generateAppointmentsPdf(data: AppointmentsReportData): Promise<Buffer> {
    // Bug real heredado de la versión Puppeteer, encontrado en vivo: leía
    // `data.summary`/`data.monthlyTrend`, pero
    // ReportsService.getAppointmentStatisticsReport() devuelve
    // { totalAppointments, statusDistribution, typeDistribution,
    // monthlyDistribution, cancellationRate } SIN envolver en `summary`, y el
    // campo de tendencia mensual se llama `monthlyDistribution`, no
    // `monthlyTrend`. Todo el KPI grid superior (Total/Completadas/
    // Canceladas) y el gráfico de tendencia mensual quedaban siempre en
    // blanco/cero. `avgDuration` no existe en absoluto en ese query — queda
    // en 0 (requeriría agregar un AVG(duration) al backend, fuera de alcance
    // de esta migración de motor de PDF).
    const d: any = data;
    const statusDist = d.statusDistribution ?? [];
    const monthly = d.monthlyDistribution ?? [];
    const completedCount = statusDist.find((s: any) => s.status === 'completed')?.count ?? 0;
    const cancelledCount = statusDist.find((s: any) => s.status === 'cancelled')?.count ?? 0;
    const summary = {
      totalAppointments: d.totalAppointments ?? 0,
      completedAppointments: completedCount,
      cancelledAppointments: cancelledCount,
      cancellationRate: d.cancellationRate ?? 0,
      avgDuration: d.avgDuration ?? 0,
    };
    const assets: Array<{ filename: string; buffer: Buffer }> = [];

    const statusLabels: Record<string, string> = {
      completed: 'Completada', scheduled: 'Programada', confirmed: 'Confirmada',
      cancelled: 'Cancelada', no_show: 'No se presentó', in_progress: 'En progreso', rescheduled: 'Reprogramada',
    };

    const statusChartTypst = statusDist.length > 0
      ? await this.rasterizeChart(assets, 'chart-appointments-status.png', {
          type: 'doughnut',
          data: {
            labels: statusDist.map((s: any) => statusLabels[s.status] ?? s.status),
            datasets: [{ data: statusDist.map((s: any) => Number(s.count ?? 0)), backgroundColor: this.PALETTE_MIXED, borderWidth: 2 }],
          },
          options: { responsive: false, plugins: { legend: { position: 'bottom' } } },
        }, 240, 180)
      : '#noData()';

    const trendChartTypst = monthly.length > 0
      ? await this.rasterizeChart(assets, 'chart-appointments-trend.png', {
          type: 'bar',
          data: {
            labels: monthly.map((m: any) => m.month ?? '-'),
            datasets: [{ label: 'Citas', data: monthly.map((m: any) => Number(m.count ?? 0)), backgroundColor: '#3b82f6', borderRadius: 4 }],
          },
          options: { responsive: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } },
        }, 310, 180)
      : '#noData()';

    return this.typstCompiler.compile(this.appointmentsTypst({ ...d, summary }, statusChartTypst, trendChartTypst), assets);
  }

  async generateMedicalRecordsPdf(data: MedicalRecordsReportData): Promise<Buffer> {
    return this.typstCompiler.compile(this.medicalRecordsTypst(data));
  }

  async generateDashboardPdf(data: DashboardReportData): Promise<Buffer> {
    return this.typstCompiler.compile(this.dashboardTypst(data));
  }

  async generateCriticalStockPdf(data: CriticalStockReportData): Promise<Buffer> {
    return this.typstCompiler.compile(this.criticalStockTypst(data));
  }

  async generateTransferEfficiencyPdf(data: TransferEfficiencyReportData): Promise<Buffer> {
    return this.typstCompiler.compile(this.transferEfficiencyTypst(data));
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private fmtNum(n: Numeric, decimals = 0): string {
    const v = parseFloat(String(n ?? 0));
    return isNaN(v) ? '0' : v.toLocaleString('es-BO', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  }

  private fmtBs(n: Numeric): string {
    return `Bs ${this.fmtNum(n, 2)}`;
  }

  private fmtPct(n: Numeric): string {
    return `${this.fmtNum(n, 1)}%`;
  }

  private nowBO(): string {
    return new Date().toLocaleString('es-BO', { timeZone: 'America/La_Paz' });
  }

  // Paletas para gráficos rasterizados con ChartRasterizerService (Chart.js).
  private readonly PALETTE_BLUE  = ['#3b82f6', '#93c5fd', '#1d4ed8', '#60a5fa', '#2563eb', '#bfdbfe'];
  private readonly PALETTE_MIXED = ['#3b82f6', '#10b981', '#f97316', '#8b5cf6', '#ef4444', '#06b6d4'];

  // ─── Financial Report Typst ───────────────────────────────────────────────

  private financialTypst(data: any, revenueChartTypst: string, paymentChartTypst: string): string {
    const summary = data.summary ?? {};
    const monthly = data.monthlyRevenue ?? [];

    // Bug real heredado de la versión Puppeteer, encontrado en vivo: el
    // cálculo usaba `summary.totalCollected` directo (sin el mismo fallback
    // `?? summary.totalPaid` que ya usan el resto de los campos de este
    // reporte) — con datos reales, donde el backend devuelve `totalPaid`, la
    // tasa de cobro quedaba en NaN%.
    const totalCollected = Number(summary.totalCollected ?? summary.totalPaid ?? 0);
    const collectionRate = summary.totalBilled > 0
      ? ((totalCollected / summary.totalBilled) * 100).toFixed(1)
      : '0.0';

    // Mismo patrón de bug: la tabla mensual leía `m.revenue`/`m.collected`
    // directo sin el fallback `?? m.totalBilled`/`?? m.totalPaid` que sí usa
    // el gráfico de barras de arriba — con datos reales quedaba siempre en
    // "Bs 0,00" pese a que el gráfico (con el fallback correcto) sí mostraba
    // las barras.
    const monthlyTableTypst = monthly.length > 0
      ? this.typstTable(
          ['Mes', 'Facturado', 'Cobrado', 'Facturas'],
          monthly.map((m: any) => [
            typstString(m.month ?? '-'),
            typstString(this.fmtBs(m.totalBilled ?? m.revenue)),
            typstString(this.fmtBs(m.totalPaid ?? m.collected)),
            typstString(this.fmtNum(m.invoiceCount)),
          ]),
          ['left', 'right', 'right', 'right'],
        )
      : '';

    const body = `
  #kpiGrid((
    kpiCard(${typstString('Total Facturado')}, ${typstString(this.fmtBs(summary.totalBilled))}, ${typstString('Facturas emitidas')}, color: "blue"),
    kpiCard(${typstString('Total Cobrado')}, ${typstString(this.fmtBs(totalCollected))}, ${typstString('Pagos recibidos')}, color: "green"),
    kpiCard(${typstString('Pendiente de Cobro')}, ${typstString(this.fmtBs(Number(summary.totalBilled ?? 0) - totalCollected))}, ${typstString('Por cobrar')}, color: "amber"),
    kpiCard(${typstString('Tasa de Cobro')}, ${typstString(`${collectionRate}%`)}, ${typstString('Eficiencia de cobranza')}, color: "purple"),
  ))

  #section(${typstString('Ingresos Mensuales')})[
    #grid(columns: (1fr, 220pt), column-gutter: 16pt,
      [${revenueChartTypst}],
      [
        #chartLabel(${typstString('Métodos de Pago')})
        ${paymentChartTypst}
      ],
    )
    ${monthlyTableTypst !== '' ? `#v(10pt)\n    ${monthlyTableTypst}` : ''}
  ]
  `;

    return this.wrapTypstDoc('Reporte Financiero', 'Reporte Financiero', [
      ['Generado', this.nowBO()],
      ['Total facturado', this.fmtBs(summary.totalBilled)],
      ['Total cobrado', this.fmtBs(totalCollected)],
      ['Tasa de cobro', `${collectionRate}%`],
    ], body);
  }

  // ─── Demographics Report Typst ────────────────────────────────────────────

  private demographicsTypst(data: any, genderChartTypst: string, ageChartTypst: string): string {
    const total = data.totalPatients ?? 0;
    const ages = data.ageDistribution ?? [];
    const blood = data.bloodTypeDistribution ?? [];

    const body = `
  #kpiGrid((
    kpiCard(${typstString('Total Pacientes')}, ${typstString(this.fmtNum(total))}, ${typstString('Activos en el sistema')}, color: "blue"),
    kpiCard(${typstString('Grupos de Edad')}, ${typstString(this.fmtNum(ages.length))}, ${typstString('Rangos registrados')}, color: "green"),
    kpiCard(${typstString('Tipos de Sangre')}, ${typstString(this.fmtNum(blood.length))}, ${typstString('Grupos registrados')}, color: "purple"),
  ), columns: 3)

  #section(${typstString('Distribución por Género y Grupos de Edad')})[
    #grid(columns: (1fr, 1fr), column-gutter: 16pt,
      [#chartLabel(${typstString('Por Género')}) ${genderChartTypst}],
      [#chartLabel(${typstString('Por Edad')}) ${ageChartTypst}],
    )
  ]

  ${this.typstTableSection(
    'Distribución por Tipo de Sangre',
    ['Tipo de Sangre', 'Pacientes', '% del Total'],
    blood.map((b: any) => [
      `strong(${typstString(b.bloodType ?? 'No registrado')})`,
      typstString(this.fmtNum(b.count)),
      typstString(this.fmtPct(total > 0 ? (Number(b.count) / total) * 100 : 0)),
    ]),
    ['left', 'right', 'right'],
  )}
  `;

    return this.wrapTypstDoc('Demografía de Pacientes', 'Demografía de Pacientes', [
      ['Generado', this.nowBO()],
      ['Total pacientes', this.fmtNum(total)],
    ], body);
  }

  // ─── Doctor Performance Typst ─────────────────────────────────────────────

  private doctorPerformanceTypst(data: any, perfChartTypst: string): string {
    const doctors: any[] = data.doctorPerformance ?? [];

    const tableRows = doctors.map((doc: any) => {
      const total = Number(doc.completedAppointments ?? 0) + Number(doc.cancelledAppointments ?? 0);
      const cancelRate = total > 0 ? ((Number(doc.cancelledAppointments ?? 0) / total) * 100).toFixed(1) : '0.0';
      const rateColor = Number(cancelRate) > 20 ? 'red' : Number(cancelRate) > 10 ? 'amber' : 'green';
      return [
        `strong(${typstString(doc.doctorName ?? '-')})`,
        typstString(doc.specialization ?? '-'),
        typstString(this.fmtNum(doc.completedAppointments)),
        typstString(this.fmtNum(doc.cancelledAppointments)),
        typstString(`${this.fmtNum(doc.avgDurationMinutes)} min`),
        `badge(${typstString(`${cancelRate}%`)}, color: "${rateColor}")`,
      ];
    });

    const body = `
  #section(${typstString('Citas por Médico')})[
    ${perfChartTypst}
  ]

  ${this.typstTableSection(
    'Detalle de Rendimiento por Médico',
    ['Médico', 'Especialidad', 'Completadas', 'Canceladas', 'Duración prom.', 'Tasa cancelación'],
    tableRows,
    ['left', 'left', 'right', 'right', 'center', 'center'],
  )}
  `;

    return this.wrapTypstDoc('Rendimiento de Médicos', 'Rendimiento de Médicos', [
      ['Generado', this.nowBO()],
      ['Total médicos', this.fmtNum(doctors.length)],
    ], body);
  }

  // ─── Appointments Report Typst ────────────────────────────────────────────

  private appointmentsTypst(data: any, statusChartTypst: string, trendChartTypst: string): string {
    const summary = data.summary ?? {};
    const statusDist: any[] = data.statusDistribution ?? [];

    const statusColors: Record<string, string> = {
      completed: 'green', scheduled: 'blue', confirmed: 'blue', cancelled: 'red',
      no_show: 'amber', in_progress: 'blue', rescheduled: 'amber',
    };
    const statusLabels: Record<string, string> = {
      completed: 'Completada', scheduled: 'Programada', confirmed: 'Confirmada',
      cancelled: 'Cancelada', no_show: 'No se presentó', in_progress: 'En progreso', rescheduled: 'Reprogramada',
    };

    const statusTableTypst = statusDist.length > 0
      ? this.typstTable(
          ['Estado', 'Cantidad', '% del Total'],
          statusDist.map((s: any) => [
            `badge(${typstString(statusLabels[s.status] ?? s.status)}, color: "${statusColors[s.status] ?? 'gray'}")`,
            typstString(this.fmtNum(s.count)),
            typstString(this.fmtPct(summary.totalAppointments > 0 ? (Number(s.count) / summary.totalAppointments) * 100 : 0)),
          ]),
          ['left', 'right', 'right'],
        )
      : '';

    const body = `
  #kpiGrid((
    kpiCard(${typstString('Total Citas')}, ${typstString(this.fmtNum(summary.totalAppointments))}, ${typstString('Todas las citas')}, color: "blue"),
    kpiCard(${typstString('Completadas')}, ${typstString(this.fmtNum(summary.completedAppointments))}, ${typstString('Atendidas')}, color: "green"),
    kpiCard(${typstString('Canceladas')}, ${typstString(this.fmtNum(summary.cancelledAppointments))}, ${typstString('No realizadas')}, color: "red"),
    kpiCard(${typstString('Duración Prom.')}, ${typstString(`${this.fmtNum(summary.avgDuration)} min`)}, ${typstString('Por consulta')}, color: "purple"),
  ))

  #section(${typstString('Distribución por Estado y Tendencia Mensual')})[
    #grid(columns: (1fr, 1fr), column-gutter: 16pt,
      [#chartLabel(${typstString('Por Estado')}) ${statusChartTypst}],
      [#chartLabel(${typstString('Tendencia Mensual')}) ${trendChartTypst}],
    )
    ${statusTableTypst !== '' ? `#v(10pt)\n    ${statusTableTypst}` : ''}
  ]
  `;

    return this.wrapTypstDoc('Estadísticas de Citas', 'Estadísticas de Citas', [
      ['Generado', this.nowBO()],
      ['Total citas', this.fmtNum(summary.totalAppointments)],
      ['Tasa de cancelación', this.fmtPct(summary.cancellationRate)],
    ], body);
  }

  // ─── Medical Records Report Typst ─────────────────────────────────────────

  private medicalRecordsTypst(data: any): string {
    const summary = data.summary ?? {};
    const byType: any[] = data.byType ?? [];
    const byStatus: any[] = data.byStatus ?? [];
    const typeColors = ['blue', 'green', 'purple', 'amber', 'red'];
    const maxCount = Math.max(...byType.map((x: any) => Number(x.count ?? 0)), 1);

    const barRowsTypst = byType.map((t: any, i: number) => {
      const value = Number(t.count ?? 0);
      const pct = maxCount > 0 ? Math.min(100, (value / maxCount) * 100) : 0;
      return `(label: ${typstString(t.recordType ?? '-')}, value: ${typstString(this.fmtNum(value))}, pct: ${pct.toFixed(1)}, color: "${typeColors[i % typeColors.length]}")`;
    }).join(',\n      ') + (byType.length > 0 ? ',' : '');

    const byTypeBody = byType.length > 0
      ? `#hBarChart((
      ${barRowsTypst}
    ))
    #v(8pt)
    ${this.typstTable(
      ['Tipo de Registro', 'Cantidad'],
      byType.map((t: any) => [typstString(t.recordType ?? '-'), typstString(this.fmtNum(t.count))]),
      ['left', 'right'],
    )}`
      : '#noData()';

    const byStatusBody = byStatus.length > 0
      ? this.typstTable(
          ['Estado', 'Cantidad'],
          byStatus.map((s: any) => [typstString(s.status ?? '-'), typstString(this.fmtNum(s.count))]),
          ['left', 'right'],
        )
      : '#noData()';

    const body = `
  #kpiGrid((
    kpiCard(${typstString('Total Registros')}, ${typstString(this.fmtNum(summary.totalRecords))}, ${typstString('Todos los tipos')}, color: "blue"),
    kpiCard(${typstString('Tipos Distintos')}, ${typstString(this.fmtNum(byType.length))}, ${typstString('Categorías')}, color: "green"),
    kpiCard(${typstString('Estados')}, ${typstString(this.fmtNum(byStatus.length))}, ${typstString('Flujos de trabajo')}, color: "purple"),
  ), columns: 3)

  #section(${typstString('Distribución por Tipo')})[
    ${byTypeBody}
  ]

  #section(${typstString('Distribución por Estado')})[
    ${byStatusBody}
  ]
  `;

    return this.wrapTypstDoc('Registros Médicos', 'Registros Médicos', [
      ['Generado', this.nowBO()],
      ['Total registros', this.fmtNum(summary.totalRecords)],
    ], body);
  }

  // ─── Critical Stock Report Typst ──────────────────────────────────────────

  private criticalStockTypst(data: any): string {
    const { belowMinimum = [], expiringSoon = [], expired = [], summary = {} } = data;

    const headers = ['Medicamento', 'Lote', 'Disponible', 'Mínimo', 'Vencimiento', 'Costo Unit.'];
    const align = ['left', 'left', 'right', 'right', 'center', 'right'];
    const rowsOf = (items: any[]) => items.map((s: any) => [
      `strong(${typstString(s.medication?.name ?? '-')})`,
      typstString(s.batchNumber ?? '-'),
      typstString(this.fmtNum(s.availableQuantity)),
      typstString(this.fmtNum(s.minimumStock)),
      typstString(s.expiryDate ? new Date(s.expiryDate).toLocaleDateString('es-BO') : '-'),
      typstString(this.fmtBs(s.unitCost)),
    ]);

    const body = `
  #kpiGrid((
    kpiCard(${typstString('Bajo Mínimo')}, ${typstString(this.fmtNum(summary.belowMinimumCount))}, ${typstString('Requieren reposición')}, color: "amber"),
    kpiCard(${typstString('Próx. a Vencer')}, ${typstString(this.fmtNum(summary.expiringSoonCount))}, ${typstString('Próximos 60 días')}, color: "amber"),
    kpiCard(${typstString('Ya Vencidos')}, ${typstString(this.fmtNum(summary.expiredCount))}, ${typstString('Acción inmediata')}, color: "red"),
    kpiCard(${typstString('Valor en Riesgo')}, ${typstString(this.fmtBs(summary.totalAtRiskValue))}, ${typstString('Total comprometido')}, color: "red"),
  ))

  ${expired.length > 0 ? this.typstTableSection('⚠ Ya Vencidos — Acción Inmediata', headers, rowsOf(expired), align) : ''}
  ${this.typstTableSection('Stock Bajo Mínimo', headers, rowsOf(belowMinimum), align)}
  ${this.typstTableSection('Próximos a Vencer (60 días)', headers, rowsOf(expiringSoon), align)}
  `;

    return this.wrapTypstDoc('Stock Crítico — Farmacia', 'Stock Crítico', [
      ['Generado', this.nowBO()],
      ['Bajo mínimo', this.fmtNum(summary.belowMinimumCount)],
      ['Próx. a vencer', this.fmtNum(summary.expiringSoonCount)],
      ['Vencidos', this.fmtNum(summary.expiredCount)],
      ['Valor en riesgo', this.fmtBs(summary.totalAtRiskValue)],
    ], body);
  }

  // ─── Transfer Efficiency Report Typst ─────────────────────────────────────

  private transferEfficiencyTypst(data: any): string {
    const { kpiByRoute = [], stalledTransfers = [], stalledCount = 0 } = data;

    const stalledAlert = stalledCount > 0
      ? `#block(width: 100%, fill: rgb("#fee2e2"), stroke: 1.5pt + rgb("#dc2626"), radius: 6pt, inset: (x: 14pt, y: 10pt), below: 14pt)[
    #text(size: 9pt, weight: "bold", fill: rgb("#991b1b"))[⚠ ${this.fmtNum(stalledCount)} traslado(s) detenido(s) hace más de 48 horas]
  ]`
      : '';

    const kpiTableSection = this.typstTableSection(
      'KPI por Ruta de Traspaso',
      ['Origen', 'Destino', 'Completados', 'Hrs prom. despacho', 'Hrs prom. total', 'P95 tránsito', 'Merma (u.)'],
      kpiByRoute.map((r: any) => [
        typstString(r.source_clinic_name ?? '-'),
        typstString(r.target_clinic_name ?? '-'),
        typstString(this.fmtNum(r.total_completed)),
        typstString(this.fmtNum(r.avg_hrs_to_dispatch, 1)),
        typstString(this.fmtNum(r.avg_total_hrs, 1)),
        typstString(this.fmtNum(r.p95_hrs_in_transit, 1)),
        typstString(this.fmtNum(r.total_discrepancy_units)),
      ]),
      ['left', 'left', 'right', 'right', 'right', 'right', 'right'],
    );

    const stalledTableTypst = stalledCount > 0
      ? this.typstTableSection(
          'Traslados Detenidos (+48 horas)',
          ['N° Traspaso', 'Origen', 'Destino', 'Despachado', 'Hrs esperando'],
          stalledTransfers.map((t: any) => [
            typstString(t.transferNumber ?? '-'),
            typstString(t.source_clinic_name ?? '-'),
            typstString(t.target_clinic_name ?? '-'),
            typstString(t.dispatchedAt ? new Date(t.dispatchedAt).toLocaleString('es-BO') : '-'),
            `badge(${typstString(`${this.fmtNum(t.hrs_waiting, 1)} hrs`)}, color: "red")`,
          ]),
          ['left', 'left', 'left', 'center', 'right'],
        )
      : '';

    const totalMerma = kpiByRoute.reduce((s: number, r: any) => s + Number(r.total_discrepancy_units ?? 0), 0);

    const body = `
  #kpiGrid((
    kpiCard(${typstString('Rutas Analizadas')}, ${typstString(this.fmtNum(kpiByRoute.length))}, ${typstString('Pares origen-destino')}, color: "blue"),
    kpiCard(${typstString('Detenidos +48h')}, ${typstString(this.fmtNum(stalledCount))}, ${typstString('Requieren atención')}, color: "${stalledCount > 0 ? 'red' : 'green'}"),
    kpiCard(${typstString('Merma Total')}, ${typstString(this.fmtNum(totalMerma))}, ${typstString('Unidades con discrepancia')}, color: "amber"),
  ), columns: 3)

  ${stalledAlert}
  ${kpiTableSection}
  ${stalledTableTypst}
  `;

    return this.wrapTypstDoc('Eficiencia de Traspasos', 'Eficiencia de Traspasos', [
      ['Generado', this.nowBO()],
      ['Rutas analizadas', this.fmtNum(kpiByRoute.length)],
      ['Detenidos +48h', this.fmtNum(stalledCount)],
    ], body);
  }

  // ─── Dashboard Report Typst ───────────────────────────────────────────────

  private dashboardTypst(data: any): string {
    const patients = data.patients ?? {};
    const appointments = data.appointments ?? {};
    const financial = data.financial ?? {};
    const stock = data.stock ?? {};

    const kpi = (label: string, value: string, sub: string, color: string) =>
      `kpiCard(${typstString(label)}, ${typstString(value)}, ${typstString(sub)}, color: "${color}")`;

    const body = `
  #kpiGrid((
    ${kpi('Pacientes Activos', this.fmtNum(patients.total), 'Registrados', 'blue')},
    ${kpi('Citas del Período', this.fmtNum(appointments.total), 'Total programadas', 'green')},
    ${kpi('Ingresos', this.fmtBs(financial.totalBilled), 'Facturado', 'purple')},
    ${kpi('Stock Bajo Mínimo', this.fmtNum(stock.belowMinimum), 'Alertas activas', 'red')},
  ))

  #section(${typstString('Pacientes')})[
    #kpiGrid((
      ${kpi('Total', this.fmtNum(patients.total), 'Activos', 'blue')},
      ${kpi('Nuevos (período)', this.fmtNum(patients.newThisPeriod), 'Registros nuevos', 'green')},
    ), columns: 2)
  ]

  #section(${typstString('Citas Médicas')})[
    #kpiGrid((
      ${kpi('Total', this.fmtNum(appointments.total), 'Citas', 'blue')},
      ${kpi('Completadas', this.fmtNum(appointments.completed), 'Atendidas', 'green')},
      ${kpi('Canceladas', this.fmtNum(appointments.cancelled), 'No realizadas', 'red')},
      ${kpi('Tasa cancelación', this.fmtPct(appointments.cancellationRate), 'Del período', 'amber')},
    ))
  ]

  #section(${typstString('Resumen Financiero')})[
    #kpiGrid((
      ${kpi('Facturado', this.fmtBs(financial.totalBilled), 'Total emitido', 'blue')},
      ${kpi('Cobrado', this.fmtBs(financial.totalCollected), 'Efectivo recibido', 'green')},
      ${kpi('Pendiente', this.fmtBs((financial.totalBilled ?? 0) - (financial.totalCollected ?? 0)), 'Por cobrar', 'amber')},
      ${kpi('Tasa de cobro', this.fmtPct(financial.collectionRate), 'Eficiencia', 'purple')},
    ))
  ]

  #section(${typstString('Inventario Farmacia')})[
    #kpiGrid((
      ${kpi('Total Ítems', this.fmtNum(stock.totalItems), 'En inventario', 'blue')},
      ${kpi('Bajo Mínimo', this.fmtNum(stock.belowMinimum), 'Necesitan reposición', 'red')},
      ${kpi('Por Vencer', this.fmtNum(stock.expiringSoon), 'Próximos 60 días', 'amber')},
      ${kpi('Valor Total', this.fmtBs(stock.totalValue), 'En inventario', 'green')},
    ))
  ]
  `;

    return this.wrapTypstDoc('Resumen General — Dashboard', 'Resumen General', [
      ['Generado', this.nowBO()],
    ], body);
  }

  // ─── Pharmacy Rotation PDF ────────────────────────────────────────────────

  async generateRotationPdf(data: RotationRow[]): Promise<Buffer> {
    return this.typstCompiler.compile(this.rotationTypst(data));
  }

  private rotationTypst(data: any[]): string {
    const critical = data.filter(r => r.alertLevel === 'critical');
    const warning  = data.filter(r => r.alertLevel === 'warning');
    const ok       = data.filter(r => r.alertLevel === 'ok');

    const alertBadgeTypst = (level: string) => {
      if (level === 'critical') return `badge(${typstString('CRÍTICO')}, color: "red")`;
      if (level === 'warning')  return `badge(${typstString('ATENCIÓN')}, color: "amber")`;
      return `badge(${typstString('OK')}, color: "green")`;
    };

    const headers = ['Medicamento', 'Genérico', 'Categoría', 'Stock Disp.', 'Venta Diaria', 'Días Restantes', 'Alerta'];
    const align = ['left', 'left', 'left', 'right', 'right', 'right', 'center'];
    const rowsOf = (items: any[]) => items.map(r => [
      `strong(${typstString(r.medicationName ?? '-')})`,
      typstString(r.genericName ?? '-'),
      typstString(r.category ?? '-'),
      typstString(this.fmtNum(r.availableQty)),
      typstString(this.fmtNum(r.avgDailySales, 2)),
      typstString(Number(r.daysRemaining) >= 9999 ? '∞' : this.fmtNum(r.daysRemaining, 1)),
      alertBadgeTypst(r.alertLevel),
    ]);

    const body = `
  #kpiGrid((
    kpiCard(${typstString('Total Ítems')}, ${typstString(this.fmtNum(data.length))}, ${typstString('Con stock activo')}, color: "blue"),
    kpiCard(${typstString('Estado Crítico')}, ${typstString(this.fmtNum(critical.length))}, ${typstString('Menos de 7 días')}, color: "red"),
    kpiCard(${typstString('Requieren Atención')}, ${typstString(this.fmtNum(warning.length))}, ${typstString('Menos de 30 días')}, color: "amber"),
    kpiCard(${typstString('Estado Normal')}, ${typstString(this.fmtNum(ok.length))}, ${typstString('Más de 30 días')}, color: "green"),
  ))

  ${critical.length > 0 ? this.typstTableSection('Estado Crítico — Menos de 7 días', headers, rowsOf(critical), align) : ''}
  ${warning.length  > 0 ? this.typstTableSection('Requieren Atención — Menos de 30 días', headers, rowsOf(warning), align) : ''}
  ${ok.length       > 0 ? this.typstTableSection('Estado Normal', headers, rowsOf(ok), align) : ''}
  `;

    return this.wrapTypstDoc('Rotación y Días de Stock — Farmacia', 'Rotación de Stock', [
      ['Generado', this.nowBO()],
      ['Total ítems', this.fmtNum(data.length)],
      ['Críticos (<7d)', this.fmtNum(critical.length)],
      ['Atención (<30d)', this.fmtNum(warning.length)],
    ], body);
  }

  // ─── Helpers Typst compartidos (Fase 2 en adelante) ───────────────────────

  /** Envuelve un `body` .typ ya armado con el import + bartolomedDoc + header + metaBar estándar. */
  private wrapTypstDoc(title: string, badge: string, metaFields: Array<[string, string]>, body: string): string {
    // Coma final obligatoria — ver nota en typstRows(): sin ella, un reporte
    // con un solo metaField (ej. dashboardTypst) rompe metaBar() en silencio.
    const metaTypst = metaFields.map(([k, v]) => `(${typstString(k)}, ${typstString(v)})`).join(',\n  ') + ',';
    return `#import "/templates/bartolomed-base.typ": bartolomedDoc, header, metaBar, section, kpiCard, kpiGrid, styledTable, badge, noData, hBarChart, chartLabel, gris-texto

#show: bartolomedDoc.with(title: ${typstString(title)}, paper: "a4")

#header(name: "BARTOLOMED", subtitle: "Sistema de Gestión Clínica", badge: ${typstString(badge)})
#metaBar((
  ${metaTypst}
))

#pad(x: 28pt, y: 12pt)[
${body}
]
`;
  }

  /**
   * Arma el bloque `(celda1, celda2, ...)` de cada fila a partir de expresiones
   * Typst ya construidas (typstString/strong/badge/...). La coma final es
   * obligatoria: sin ella, un array de UNA sola fila `((a, b))` no es un array
   * de tuplas para Typst sino la tupla `(a, b)` sola — `.at(0)`/`.at(1)` en
   * `styledTable` terminan indexando caracteres de string en vez de columnas
   * (bug real encontrado en vivo migrando dashboardTypst, mismo patrón que
   * afecta cualquier tabla con exactamente 1 fila).
   */
  private typstRows(rows: string[][]): string {
    return rows.map(cells => `(${cells.join(', ')})`).join(',\n        ') + ',';
  }

  /** `#styledTable(...)` sola, sin envolver en `#section(...)`. `widths` (fracciones Typst, ej. `'2fr'`) es opcional — ver nota en la plantilla sobre tablas con muchas columnas. */
  private typstTable(headers: string[], rows: string[][], align: string[], widths?: string[]): string {
    return `#styledTable(
      (${headers.map(typstString).join(', ')}),
      (
        ${this.typstRows(rows)}
      ),
      align: (${align.join(', ')}),
      widths: ${widths ? `(${widths.join(', ')})` : 'none'},
    )`;
  }

  /** `#section(title)[ ...styledTable... ]`, o cadena vacía si no hay filas (a diferencia de noData(), algunos reportes simplemente omiten la sección). */
  private typstTableSection(title: string, headers: string[], rows: string[][], align: string[], emptyState: 'noData' | 'omit' = 'noData', widths?: string[]): string {
    if (rows.length === 0) {
      if (emptyState === 'omit') return '';
      return `#section(${typstString(title)})[#noData()]`;
    }
    return `#section(${typstString(title)})[
    ${this.typstTable(headers, rows, align, widths)}
  ]`;
  }

  /**
   * Rasteriza un gráfico de Chart.js (mismo config que armaba `inlineChart()`
   * en Puppeteer, sin reescribirlo — ver plan enchanted-percolating-candle.md)
   * y lo agrega a `assets`. `canvasWidthPx` es el ancho del canvas rasterizado;
   * el ancho de despliegue en el PDF se escala a ~0.74x (mismo ratio que el
   * piloto B, dailySalesTypst) para verse nítido sin ocupar el canvas completo.
   */
  private async rasterizeChart(
    assets: Array<{ filename: string; buffer: Buffer }>,
    filename: string,
    config: object,
    canvasWidthPx: number,
    canvasHeightPx: number,
  ): Promise<string> {
    const buffer = await this.chartRasterizer.rasterize(config as any, canvasWidthPx, canvasHeightPx);
    assets.push({ filename, buffer });
    return `#align(center, image(${typstString(filename)}, width: ${Math.round(canvasWidthPx * 0.74)}pt))`;
  }

  // ─── Pharmacy Margins PDF ─────────────────────────────────────────────────
  // Piloto A de la migración a Typst (sin gráfico) — ver plan
  // enchanted-percolating-candle.md. Los otros 21 reportes de este archivo
  // siguen en Puppeteer hasta la Fase 2.

  async generateMarginsPdf(data: MarginRow[]): Promise<Buffer> {
    return this.typstCompiler.compile(this.marginsTypst(data));
  }

  private marginsTypst(data: any[]): string {
    const totalMarginAbs = data.reduce((s, r) => s + Number(r.marginAbs ?? 0), 0);
    const totalRevenue   = data.reduce((s, r) => s + Number(r.sellingPrice ?? 0) * Number(r.qtySold ?? 0), 0);
    const avgMarginPct   = totalRevenue > 0 ? (totalMarginAbs / totalRevenue) * 100 : 0;

    const rowsTypst = data.map(r => {
      const marginPct = Number(r.marginPct ?? 0);
      const badgeColor = marginPct >= 20 ? 'green' : marginPct >= 10 ? 'amber' : 'red';
      return `(strong(${typstString(r.medicationName ?? '-')}), ${typstString(r.genericName ?? '-')}, ${typstString(this.fmtBs(r.unitCost))}, ${typstString(this.fmtBs(r.sellingPrice))}, ${typstString(this.fmtNum(r.qtySold))}, ${typstString(this.fmtBs(r.marginAbs))}, badge(${typstString(this.fmtPct(r.marginPct))}, color: "${badgeColor}"))`;
    }).join(',\n        ') + (data.length > 0 ? ',' : '');

    const headers = ['Medicamento', 'Genérico', 'Costo Unit.', 'Precio Venta', 'Qty Vendida', 'Margen Bs', 'Margen %']
      .map(typstString).join(', ');

    const tableOrEmpty = data.length > 0
      ? `#styledTable(
        (${headers}),
        (
        ${rowsTypst}
        ),
        align: (left, left, right, right, right, right, center),
      )`
      : '#noData()';

    return `#import "/templates/bartolomed-base.typ": bartolomedDoc, header, metaBar, section, kpiCard, kpiGrid, styledTable, badge, noData

#show: bartolomedDoc.with(title: ${typstString('Márgenes por Producto — Farmacia')}, paper: "a4")

#header(name: "BARTOLOMED", subtitle: "Sistema de Gestión Clínica", badge: ${typstString('Márgenes por Producto')})
#metaBar((
  (${typstString('Generado')}, ${typstString(this.nowBO())}),
  (${typstString('Productos')}, ${typstString(this.fmtNum(data.length))}),
  (${typstString('Margen Bruto Total')}, ${typstString(this.fmtBs(totalMarginAbs))}),
  (${typstString('Margen Promedio')}, ${typstString(this.fmtPct(avgMarginPct))}),
))

#pad(x: 28pt, y: 12pt)[
  #kpiGrid((
    kpiCard(${typstString('Productos Analizados')}, ${typstString(this.fmtNum(data.length))}, ${typstString('Con ventas')}, color: "blue"),
    kpiCard(${typstString('Margen Bruto Total')}, ${typstString(this.fmtBs(totalMarginAbs))}, ${typstString('Ganancia bruta')}, color: "green"),
    kpiCard(${typstString('Margen % Promedio')}, ${typstString(this.fmtPct(avgMarginPct))}, ${typstString('Ponderado por ventas')}, color: "purple"),
  ), columns: 3)

  #section(${typstString('Detalle de Márgenes por Producto')})[
    ${tableOrEmpty}
  ]
]
`;
  }

  // ─── Pharmacy Daily Sales PDF ─────────────────────────────────────────────
  // Piloto B de la migración a Typst (con gráfico) — ver plan
  // enchanted-percolating-candle.md. El gráfico de barras se rasteriza server-
  // side con ChartRasterizerService (chartjs-node-canvas) usando EXACTAMENTE
  // el mismo config de Chart.js que ya armaba inlineChart() — se inserta como
  // imagen PNG en el .typ, mismo patrón que el QR de cotizaciones-tecnocondor.

  private fmtDateReport(d: any): string {
    return d instanceof Date ? d.toISOString().slice(0, 10) : String(d ?? '-');
  }

  async generateDailySalesPdf(data: DailySalesReportData): Promise<Buffer> {
    const daily = (data as any).dailySales ?? [];

    const assets: Array<{ filename: string; buffer: Buffer }> = [];
    let chartTypst: string;
    if (daily.length > 0) {
      const chartBuffer = await this.chartRasterizer.rasterize(
        {
          type: 'bar',
          data: {
            labels: daily.map((d: any) => this.fmtDateReport(d.date)),
            datasets: [{
              label: 'Ingresos (Bs)',
              data: daily.map((d: any) => Number(d.totalRevenue ?? 0)),
              backgroundColor: '#f97316',
              borderRadius: 4,
            }],
          },
          options: { responsive: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } },
        } as any,
        540,
        200,
      );
      assets.push({ filename: 'chart-revenue.png', buffer: chartBuffer });
      // Nota: `image()` acá va directo en el .typ de entrada (no en un
      // helper de la plantilla compartida) — la ruta relativa se resuelve
      // contra el archivo donde la LLAMADA está escrita, y el PNG vive en el
      // mismo directorio de trabajo temporal que este .typ, no en templates/.
      chartTypst = '#align(center, image("chart-revenue.png", width: 400pt))';
    } else {
      chartTypst = '#noData()';
    }

    return this.typstCompiler.compile(this.dailySalesTypst(data, chartTypst), assets);
  }

  private dailySalesTypst(data: any, chartTypst: string): string {
    const daily   = data.dailySales ?? [];
    const payment = data.paymentBreakdown ?? [];

    const totalRevenue = daily.reduce((s: number, r: any) => s + Number(r.totalRevenue ?? 0), 0);
    const totalTickets = daily.reduce((s: number, r: any) => s + Number(r.ticketCount ?? 0), 0);
    const avgTicket    = totalTickets > 0 ? totalRevenue / totalTickets : 0;

    const dailyRowsTypst = daily.map((d: any) =>
      `(${typstString(this.fmtDateReport(d.date))}, ${typstString(this.fmtBs(d.totalRevenue))}, ${typstString(this.fmtNum(d.ticketCount))}, ${typstString(this.fmtBs(d.avgTicket))})`,
    ).join(',\n        ') + (daily.length > 0 ? ',' : '');

    const paymentRowsTypst = payment.map((p: any) =>
      `(${typstString(p.method ?? '-')}, ${typstString(this.fmtBs(p.total))}, ${typstString(this.fmtNum(p.count))})`,
    ).join(',\n        ') + (payment.length > 0 ? ',' : '');

    const dailyTableTypst = daily.length > 0
      ? `#section(${typstString('Detalle Diario')})[
    #styledTable(
      (${['Fecha', 'Ingresos', 'Tickets', 'Ticket Promedio'].map(typstString).join(', ')}),
      (
        ${dailyRowsTypst}
      ),
      align: (left, right, right, right),
    )
  ]`
      : '';

    const paymentTableTypst = payment.length > 0
      ? `#section(${typstString('Desglose por Método de Pago')})[
    #styledTable(
      (${['Método', 'Total (Bs)', 'Transacciones'].map(typstString).join(', ')}),
      (
        ${paymentRowsTypst}
      ),
      align: (left, right, right),
    )
  ]`
      : '';

    return `#import "/templates/bartolomed-base.typ": bartolomedDoc, header, metaBar, section, kpiCard, kpiGrid, styledTable, noData

#show: bartolomedDoc.with(title: ${typstString('Ventas Diarias — Farmacia')}, paper: "a4")

#header(name: "BARTOLOMED", subtitle: "Sistema de Gestión Clínica", badge: ${typstString('Ventas Diarias')})
#metaBar((
  (${typstString('Generado')}, ${typstString(this.nowBO())}),
  (${typstString('Total Ingresos')}, ${typstString(this.fmtBs(totalRevenue))}),
  (${typstString('Total Tickets')}, ${typstString(this.fmtNum(totalTickets))}),
  (${typstString('Ticket Promedio')}, ${typstString(this.fmtBs(avgTicket))}),
))

#pad(x: 28pt, y: 12pt)[
  #kpiGrid((
    kpiCard(${typstString('Total Ingresos')}, ${typstString(this.fmtBs(totalRevenue))}, ${typstString('Período seleccionado')}, color: "orange"),
    kpiCard(${typstString('Total Tickets')}, ${typstString(this.fmtNum(totalTickets))}, ${typstString('Ventas completadas')}, color: "blue"),
    kpiCard(${typstString('Ticket Promedio')}, ${typstString(this.fmtBs(avgTicket))}, ${typstString('Por transacción')}, color: "green"),
  ), columns: 3)

  #section(${typstString('Ingresos por Día')})[
    ${chartTypst}
  ]

  ${dailyTableTypst}

  ${paymentTableTypst}
]
`;
  }

  // ─── Pharmacy Expiry Buckets PDF ──────────────────────────────────────────

  async generateExpiryBucketsPdf(data: ExpiryBucketsReportData): Promise<Buffer> {
    return this.typstCompiler.compile(this.expiryBucketsTypst(data));
  }

  private expiryBucketsTypst(data: any): string {
    const { already_expired = [], expires_lt30 = [], expires_30_60 = [], expires_60_90 = [], summary = {} } = data;

    const headers = ['Medicamento', 'Lote', 'Vencimiento', 'Unidades', 'Valor (Bs)'];
    const align = ['left', 'left', 'center', 'right', 'right'];
    const rowsOf = (items: any[]) => items.map((r: any) => [
      `strong(${typstString(r.medicationName ?? '-')})`,
      typstString(r.batchNumber ?? '-'),
      typstString(r.expiryDate ? new Date(r.expiryDate).toLocaleDateString('es-BO') : '-'),
      typstString(this.fmtNum(r.availableQuantity)),
      typstString(this.fmtBs(r.stockValue)),
    ]);

    const body = `
  #kpiGrid((
    kpiCard(${typstString('Ya Vencidos')}, ${typstString(this.fmtNum(summary.alreadyExpiredCount))}, ${typstString(this.fmtBs(summary.alreadyExpiredValue))}, color: "red"),
    kpiCard(${typstString('Vencen <30 días')}, ${typstString(this.fmtNum(summary.lt30Count))}, ${typstString(this.fmtBs(summary.lt30Value))}, color: "red"),
    kpiCard(${typstString('Vencen 30-60 días')}, ${typstString(this.fmtNum(summary.bt30_60Count))}, ${typstString(this.fmtBs(summary.bt30_60Value))}, color: "amber"),
    kpiCard(${typstString('Vencen 60-90 días')}, ${typstString(this.fmtNum(summary.bt60_90Count))}, ${typstString(this.fmtBs(summary.bt60_90Value))}, color: "amber"),
  ))

  ${already_expired.length > 0 ? this.typstTableSection('Ya Vencidos — Acción Inmediata', headers, rowsOf(already_expired), align) : ''}
  ${expires_lt30.length    > 0 ? this.typstTableSection('Vencen en Menos de 30 Días', headers, rowsOf(expires_lt30), align) : ''}
  ${expires_30_60.length   > 0 ? this.typstTableSection('Vencen en 30-60 Días', headers, rowsOf(expires_30_60), align) : ''}
  ${expires_60_90.length   > 0 ? this.typstTableSection('Vencen en 60-90 Días', headers, rowsOf(expires_60_90), align) : ''}
  `;

    return this.wrapTypstDoc('Vencimientos por Período — Farmacia', 'Vencimientos por Período', [
      ['Generado', this.nowBO()],
      ['Ya vencidos', this.fmtNum(summary.alreadyExpiredCount)],
      ['Vencen <30d', this.fmtNum(summary.lt30Count)],
      ['Vencen 30-60d', this.fmtNum(summary.bt30_60Count)],
      ['Vencen 60-90d', this.fmtNum(summary.bt60_90Count)],
    ], body);
  }

  // ─── Pharmacy Profitability PDF ───────────────────────────────────────────

  async generateProfitabilityPdf(data: ProfitabilityRow[]): Promise<Buffer> {
    const d: any[] = data as any;
    const assets: Array<{ filename: string; buffer: Buffer }> = [];

    const profitChartTypst = d.length > 0
      ? await this.rasterizeChart(assets, 'chart-profitability.png', {
          type: 'bar',
          data: {
            labels: d.map((r: any) => r.month ?? '-'),
            datasets: [
              { label: 'Ingresos', data: d.map((r: any) => Number(r.revenue ?? 0)), backgroundColor: '#3b82f6', borderRadius: 4 },
              { label: 'CMV', data: d.map((r: any) => Number(r.cogs ?? 0)), backgroundColor: '#ef4444', borderRadius: 4 },
              { label: 'Margen', data: d.map((r: any) => Number(r.grossMargin ?? 0)), backgroundColor: '#10b981', borderRadius: 4 },
            ],
          },
          options: { responsive: false, plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true } } },
        }, 540, 220)
      : '#noData()';

    return this.typstCompiler.compile(this.profitabilityTypst(d, profitChartTypst), assets);
  }

  // ─── A1: PDF Ventas por Farmacéutico ─────────────────────────────────────

  async generateSalesByPharmacistPdf(data: SalesByPharmacistRow[]): Promise<Buffer> {
    const d: any[] = data as any;
    const assets: Array<{ filename: string; buffer: Buffer }> = [];

    const chartTypst = d.length > 0
      ? await this.rasterizeChart(assets, 'chart-sales-by-pharmacist.png', {
          type: 'bar',
          data: {
            labels: d.map((r: any) => r.pharmacistName ?? '-'),
            datasets: [{ label: 'Ingresos (Bs)', data: d.map((r: any) => Number(r.totalRevenue ?? 0)), backgroundColor: '#8b5cf6', borderRadius: 4 }],
          },
          options: { responsive: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } },
        }, 540, 200)
      : '#noData()';

    return this.typstCompiler.compile(this.salesByPharmacistTypst(d, chartTypst), assets);
  }

  private salesByPharmacistTypst(data: any[], chartTypst: string): string {
    const totalRevenue = data.reduce((s, r) => s + Number(r.totalRevenue ?? 0), 0);
    const totalUnits   = data.reduce((s, r) => s + Number(r.totalUnits ?? 0), 0);
    const totalSales   = data.reduce((s, r) => s + Number(r.salesCount ?? 0), 0);

    const body = `
  #kpiGrid((
    kpiCard(${typstString('Total Ingresos')}, ${typstString(this.fmtBs(totalRevenue))}, ${typstString('Período seleccionado')}, color: "purple"),
    kpiCard(${typstString('Total Ventas')}, ${typstString(this.fmtNum(totalSales))}, ${typstString('Tickets emitidos')}, color: "blue"),
    kpiCard(${typstString('Farmacéuticos')}, ${typstString(this.fmtNum(data.length))}, ${typstString('Con ventas en el período')}, color: "green"),
  ), columns: 3)

  #section(${typstString('Ingresos por Farmacéutico')})[
    ${chartTypst}
  ]

  ${this.typstTableSection(
    'Detalle por Encargado',
    ['Farmacéutico', 'Ventas', 'Unidades', 'Ingresos', 'Ticket Prom.', 'Días trab.', '% del total'],
    data.map(r => [
      `strong(${typstString(r.pharmacistName ?? '-')})`,
      typstString(this.fmtNum(r.salesCount)),
      typstString(this.fmtNum(r.totalUnits)),
      typstString(this.fmtBs(r.totalRevenue)),
      typstString(this.fmtBs(r.avgTicket)),
      typstString(this.fmtNum(r.workDays)),
      typstString(this.fmtPct(r.revenuePct)),
    ]),
    ['left', 'right', 'right', 'right', 'right', 'right', 'center'],
    'omit',
  )}
  `;

    return this.wrapTypstDoc('Ventas por Farmacéutico', 'Ventas por Farmacéutico', [
      ['Generado', this.nowBO()],
      ['Total Ingresos', this.fmtBs(totalRevenue)],
      ['Total Tickets', this.fmtNum(totalSales)],
      ['Total Unidades', this.fmtNum(totalUnits)],
    ], body);
  }

  // ─── A2: PDF Encargado × Día × Medicamento ────────────────────────────────

  async generatePharmacistDayMedicationPdf(data: PharmacistDayMedicationData): Promise<Buffer> {
    return this.typstCompiler.compile(this.pharmacistDayMedicationTypst(data));
  }

  private pharmacistDayMedicationTypst(data: any): string {
    const rows: any[] = data.rows ?? [];
    const byPharmacist: any[] = data.byPharmacist ?? [];

    const totalRevenue = rows.reduce((s: number, r: any) => s + Number(r.totalRevenue ?? 0), 0);
    const totalUnits   = rows.reduce((s: number, r: any) => s + Number(r.qtySold ?? 0), 0);

    const tableRows = rows.slice(0, 200).map((r: any) => [
      typstString(r.pharmacistName ?? '-'),
      typstString(r.saleDay ?? '-'),
      `strong(${typstString(r.medicationName ?? '-')})`,
      typstString(r.category ?? '-'),
      typstString(this.fmtNum(r.qtySold)),
      typstString(this.fmtBs(r.totalRevenue)),
      typstString(this.fmtBs(r.unitPrice)),
    ]);

    const body = `
  #kpiGrid((
    kpiCard(${typstString('Total Ingresos')}, ${typstString(this.fmtBs(totalRevenue))}, ${typstString('Período seleccionado')}, color: "purple"),
    kpiCard(${typstString('Total Unidades')}, ${typstString(this.fmtNum(totalUnits))}, ${typstString('Dispensadas')}, color: "orange"),
    kpiCard(${typstString('Farmacéuticos')}, ${typstString(this.fmtNum(byPharmacist.length))}, ${typstString('Con actividad')}, color: "blue"),
  ), columns: 3)

  ${this.typstTableSection(
    'Detalle Completo (máx. 200 filas)',
    ['Farmacéutico', 'Fecha', 'Medicamento', 'Categoría', 'Unidades', 'Ingresos', 'Precio Unit.'],
    tableRows,
    ['left', 'center', 'left', 'left', 'right', 'right', 'right'],
  )}
  `;

    return this.wrapTypstDoc('Detalle Encargado × Día × Medicamento', 'Encargado × Día × Medic.', [
      ['Generado', this.nowBO()],
      ['Total Ingresos', this.fmtBs(totalRevenue)],
      ['Total Unidades', this.fmtNum(totalUnits)],
      ['Farmacéuticos', this.fmtNum(byPharmacist.length)],
    ], body);
  }

  // ─── B1: PDF Inventario Valorizado ───────────────────────────────────────

  async generateValorizedInventoryPdf(data: ValorizedInventoryData): Promise<Buffer> {
    return this.typstCompiler.compile(this.valorizedInventoryTypst(data));
  }

  private valorizedInventoryTypst(data: any): string {
    const rows: any[] = data.rows ?? [];
    const summary     = data.summary ?? {};

    const statusLabel: Record<string, string> = {
      ok: 'Normal', critico: 'Crítico', sin_stock: 'Sin Stock', por_vencer: 'Por Vencer',
    };
    const statusColor: Record<string, string> = {
      ok: 'green', critico: 'red', sin_stock: 'red', por_vencer: 'amber',
    };

    const tableRows = rows.map((r: any) => [
      `strong(${typstString(r.medicationName ?? '-')})`,
      typstString(r.genericName ?? '-'),
      typstString(r.category ?? '-'),
      typstString(r.batchNumber ?? '-'),
      typstString(this.fmtNum(r.availableQuantity)),
      typstString(this.fmtNum(r.minimumStock)),
      typstString(this.fmtBs(r.unitCost)),
      typstString(this.fmtBs(r.sellingPrice)),
      typstString(this.fmtBs(r.costValue)),
      `badge(${typstString(statusLabel[r.status] ?? r.status)}, color: "${statusColor[r.status] ?? 'green'}")`,
    ]);

    const alertCount = (summary.sinStock ?? 0) + (summary.critico ?? 0) + (summary.porVencer ?? 0);

    const body = `
  #kpiGrid((
    kpiCard(${typstString('Valor a Costo')}, ${typstString(this.fmtBs(summary.totalCostValue))}, ${typstString(`${this.fmtNum(summary.totalProducts)} SKUs`)}, color: "blue"),
    kpiCard(${typstString('Valor Venta')}, ${typstString(this.fmtBs(summary.totalSaleValue))}, ${typstString('Precio de venta')}, color: "green"),
    kpiCard(${typstString('Margen Potencial')}, ${typstString(this.fmtBs(summary.potentialMargin))}, ${typstString('Si se vende todo')}, color: "purple"),
    kpiCard(${typstString('Alertas')}, ${typstString(this.fmtNum(alertCount))}, ${typstString('Sin stock + crítico + por vencer')}, color: "red"),
  ))

  ${this.typstTableSection(
    'Detalle de Inventario',
    ['Medicamento', 'Genérico', 'Categoría', 'Lote', 'Disponible', 'Mínimo', 'Costo', 'Precio', 'Valor Costo', 'Estado'],
    tableRows,
    ['left', 'left', 'left', 'left', 'right', 'right', 'right', 'right', 'right', 'center'],
    'noData',
    // 10 columnas: sin esto, ancho uniforme hace que headers largos como
    // "MEDICAMENTO"/"GENÉRICO" se superpongan entre sí (bug real, ver
    // styledTable() en bartolomed-base.typ).
    ['1.6fr', '1.3fr', '1fr', '1.2fr', '0.8fr', '0.8fr', '0.9fr', '0.9fr', '1fr', '0.9fr'],
  )}
  `;

    return this.wrapTypstDoc('Inventario General Valorizado', 'Inventario Valorizado', [
      ['Generado', this.nowBO()],
      ['Productos', this.fmtNum(summary.totalProducts)],
      ['Valor Costo', this.fmtBs(summary.totalCostValue)],
      ['Valor Venta', this.fmtBs(summary.totalSaleValue)],
      ['Margen Potencial', this.fmtBs(summary.potentialMargin)],
    ], body);
  }

  // ─── B2: PDF Inventario por Categoría ────────────────────────────────────

  async generateInventoryByCategoryPdf(data: InventoryByCategoryRow[]): Promise<Buffer> {
    const d: any[] = data as any;
    const assets: Array<{ filename: string; buffer: Buffer }> = [];

    const chartTypst = d.length > 0
      ? await this.rasterizeChart(assets, 'chart-inventory-category.png', {
          type: 'doughnut',
          data: {
            labels: d.map((r: any) => r.category ?? 'Sin categoría'),
            datasets: [{ data: d.map((r: any) => Number(r.totalCostValue ?? 0)), backgroundColor: this.PALETTE_MIXED, borderWidth: 2 }],
          },
          options: { responsive: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 10 } } } } },
        }, 320, 220)
      : '#noData()';

    return this.typstCompiler.compile(this.inventoryByCategoryTypst(d, chartTypst), assets);
  }

  private inventoryByCategoryTypst(data: any[], chartTypst: string): string {
    const totalCost  = data.reduce((s, r) => s + Number(r.totalCostValue ?? 0), 0);
    const totalSale  = data.reduce((s, r) => s + Number(r.totalSaleValue ?? 0), 0);
    const totalUnits = data.reduce((s, r) => s + Number(r.totalUnits ?? 0), 0);

    const rows = data.map(r => [
      `strong(${typstString(r.category ?? 'Sin categoría')})`,
      typstString(this.fmtNum(r.productCount)),
      typstString(this.fmtNum(r.totalUnits)),
      typstString(this.fmtBs(r.totalCostValue)),
      typstString(this.fmtBs(r.totalSaleValue)),
      Number(r.lowStockCount) > 0
        ? `badge(${typstString(this.fmtNum(r.lowStockCount))}, color: "amber")`
        : typstString(this.fmtNum(r.lowStockCount)),
      Number(r.expiringSoonCount) > 0
        ? `badge(${typstString(this.fmtNum(r.expiringSoonCount))}, color: "red")`
        : typstString(this.fmtNum(r.expiringSoonCount)),
    ]);

    const body = `
  #kpiGrid((
    kpiCard(${typstString('Categorías')}, ${typstString(this.fmtNum(data.length))}, ${typstString('Activas con stock')}, color: "blue"),
    kpiCard(${typstString('Total Unidades')}, ${typstString(this.fmtNum(totalUnits))}, ${typstString('En stock')}, color: "green"),
    kpiCard(${typstString('Valor Costo Total')}, ${typstString(this.fmtBs(totalCost))}, ${typstString('Inversión en inventario')}, color: "orange"),
  ), columns: 3)

  #section(${typstString('Distribución por Categoría (valor costo)')})[
    ${chartTypst}
  ]

  ${this.typstTableSection(
    'Resumen por Categoría',
    ['Categoría', 'Productos', 'Unidades', 'Valor Costo', 'Valor Venta', 'Bajo Mínimo', 'Por Vencer'],
    rows,
    ['left', 'right', 'right', 'right', 'right', 'center', 'center'],
  )}
  `;

    return this.wrapTypstDoc('Inventario por Categoría', 'Inventario por Categoría', [
      ['Generado', this.nowBO()],
      ['Categorías', this.fmtNum(data.length)],
      ['Total SKUs', this.fmtNum(data.reduce((s, r) => s + Number(r.productCount ?? 0), 0))],
      ['Valor Total Costo', this.fmtBs(totalCost)],
      ['Valor Total Venta', this.fmtBs(totalSale)],
    ], body);
  }

  // ─── B3: PDF Medicamentos sin Movimiento ─────────────────────────────────

  async generateNoMovementPdf(data: NoMovementReportData): Promise<Buffer> {
    return this.typstCompiler.compile(this.noMovementTypst(data));
  }

  private noMovementTypst(data: any): string {
    const rows: any[] = data.rows ?? [];
    const days: number = data.days ?? 30;
    const totalStockValue: number = data.totalStockValue ?? 0;

    const tableRows = rows.map((r: any) => {
      const expiry = r.expiryDate ? new Date(r.expiryDate).toLocaleDateString('es-BO') : '-';
      const lastSale = r.lastSaleDate
        ? (r.lastSaleDate instanceof Date ? r.lastSaleDate : new Date(r.lastSaleDate)).toLocaleDateString('es-BO')
        : 'Sin ventas';
      return [
        `strong(${typstString(r.medicationName ?? '-')})`,
        typstString(r.genericName ?? '-'),
        typstString(r.category ?? '-'),
        typstString(r.batchNumber ?? '-'),
        typstString(this.fmtNum(r.availableQuantity)),
        typstString(this.fmtBs(r.stockValue)),
        typstString(expiry),
        typstString(lastSale),
      ];
    });

    const body = `
  #kpiGrid((
    kpiCard(${typstString('Sin Movimiento')}, ${typstString(this.fmtNum(rows.length))}, ${typstString(`Más de ${days} días`)}, color: "red"),
    kpiCard(${typstString('Valor Inmovilizado')}, ${typstString(this.fmtBs(totalStockValue))}, ${typstString('A precio de costo')}, color: "amber"),
    kpiCard(${typstString('Acción Recomendada')}, ${typstString('Revisión')}, ${typstString('Promocionar o devolver')}, color: "purple"),
  ), columns: 3)

  ${this.typstTableSection(
    'Detalle de Medicamentos Inactivos',
    ['Medicamento', 'Genérico', 'Categoría', 'Lote', 'Disponible', 'Valor', 'Vencimiento', 'Última Venta'],
    tableRows,
    ['left', 'left', 'left', 'left', 'right', 'right', 'center', 'center'],
  )}
  `;

    return this.wrapTypstDoc(`Medicamentos Sin Movimiento (>${days} días)`, 'Sin Movimiento', [
      ['Generado', this.nowBO()],
      ['Sin movimiento', this.fmtNum(rows.length)],
      ['Valor inmovilizado', this.fmtBs(totalStockValue)],
      ['Umbral', `${days} días`],
    ], body);
  }

  // ─── C1: PDF Ventas por Medicamento Detalle ───────────────────────────────

  async generateMedicationDetailPdf(data: MedicationDetailRow[]): Promise<Buffer> {
    const d: any[] = data as any;
    const top15 = d.slice(0, 15);
    const assets: Array<{ filename: string; buffer: Buffer }> = [];

    const chartTypst = top15.length > 0
      ? await this.rasterizeChart(assets, 'chart-medication-detail.png', {
          type: 'bar',
          data: {
            labels: top15.map((r: any) => r.medicationName ?? '-'),
            datasets: [
              { label: 'Ingresos', data: top15.map((r: any) => Number(r.totalRevenue ?? 0)), backgroundColor: '#3b82f6', borderRadius: 4 },
              { label: 'Margen', data: top15.map((r: any) => Number(r.grossMargin ?? 0)), backgroundColor: '#10b981', borderRadius: 4 },
            ],
          },
          options: { responsive: false, plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true } } },
        }, 540, 220)
      : '#noData()';

    return this.typstCompiler.compile(this.medicationDetailTypst(d, chartTypst), assets);
  }

  private medicationDetailTypst(data: any[], chartTypst: string): string {
    const totalRevenue = data.reduce((s, r) => s + Number(r.totalRevenue ?? 0), 0);
    const totalUnits   = data.reduce((s, r) => s + Number(r.qtySold ?? 0), 0);
    const totalMargin  = data.reduce((s, r) => s + Number(r.grossMargin ?? 0), 0);

    const rows = data.map(r => {
      const marginColor = Number(r.marginPct) >= 20 ? 'green' : Number(r.marginPct) >= 10 ? 'amber' : 'red';
      return [
        `strong(${typstString(r.medicationName ?? '-')})`,
        typstString(r.category ?? '-'),
        typstString(r.dosageForm ?? '-'),
        typstString(this.fmtNum(r.qtySold)),
        typstString(this.fmtBs(r.avgUnitPrice)),
        typstString(this.fmtBs(r.totalRevenue)),
        typstString(this.fmtBs(r.grossMargin)),
        `badge(${typstString(this.fmtPct(r.marginPct))}, color: "${marginColor}")`,
      ];
    });

    const body = `
  #kpiGrid((
    kpiCard(${typstString('Total Ingresos')}, ${typstString(this.fmtBs(totalRevenue))}, ${typstString('Período seleccionado')}, color: "blue"),
    kpiCard(${typstString('Total Unidades')}, ${typstString(this.fmtNum(totalUnits))}, ${typstString('Dispensadas')}, color: "orange"),
    kpiCard(${typstString('Margen Bruto')}, ${typstString(this.fmtBs(totalMargin))}, ${typstString('Ganancia bruta')}, color: "green"),
  ), columns: 3)

  #section(${typstString('Top 15 Medicamentos por Ingresos')})[
    ${chartTypst}
  ]

  ${this.typstTableSection(
    'Detalle Completo',
    ['Medicamento', 'Categoría', 'Forma', 'Unidades', 'Precio Prom.', 'Ingresos', 'Margen Bs', 'Margen %'],
    rows,
    ['left', 'left', 'left', 'right', 'right', 'right', 'right', 'center'],
  )}
  `;

    return this.wrapTypstDoc('Ventas por Medicamento — Detalle', 'Ventas por Medicamento', [
      ['Generado', this.nowBO()],
      ['Productos vendidos', this.fmtNum(data.length)],
      ['Total Ingresos', this.fmtBs(totalRevenue)],
      ['Margen Bruto', this.fmtBs(totalMargin)],
    ], body);
  }

  // ─── C2: PDF Ventas con Receta vs Libres ─────────────────────────────────

  async generatePrescriptionVsFreePdf(data: PrescriptionVsFreeData): Promise<Buffer> {
    const d: any = data;
    const summary: any[] = d.summary ?? [];
    const assets: Array<{ filename: string; buffer: Buffer }> = [];
    const typeLabel: Record<string, string> = { con_receta: 'Con Receta', libre: 'Venta Libre' };

    const chartTypst = summary.length > 0
      ? await this.rasterizeChart(assets, 'chart-prescription-vs-free.png', {
          type: 'doughnut',
          data: {
            labels: summary.map((r: any) => typeLabel[r.type] ?? r.type),
            datasets: [{ data: summary.map((r: any) => Number(r.totalRevenue ?? 0)), backgroundColor: ['#3b82f6', '#10b981'], borderWidth: 2 }],
          },
          options: { responsive: false, plugins: { legend: { position: 'bottom' } } },
        }, 280, 200)
      : '#noData()';

    return this.typstCompiler.compile(this.prescriptionVsFreeTypst(d, chartTypst), assets);
  }

  private prescriptionVsFreeTypst(data: any, chartTypst: string): string {
    const summary: any[]      = data.summary ?? [];
    const byMedication: any[] = data.byMedication ?? [];

    const conReceta = summary.find(r => r.type === 'con_receta') ?? {};
    const libre     = summary.find(r => r.type === 'libre') ?? {};

    const medCR  = byMedication.filter((r: any) => r.type === 'con_receta').slice(0, 15);
    const medLib = byMedication.filter((r: any) => r.type === 'libre').slice(0, 15);
    const medTableTypst = (title: string, items: any[]) => this.typstTableSection(
      title,
      ['Medicamento', 'Unidades', 'Ingresos'],
      items.map((r: any) => [
        typstString(r.medicationName ?? '-'),
        typstString(this.fmtNum(r.qtySold)),
        typstString(this.fmtBs(r.revenue)),
      ]),
      ['left', 'right', 'right'],
    );

    const body = `
  #kpiGrid((
    kpiCard(${typstString('Con Receta')}, ${typstString(this.fmtBs(conReceta.totalRevenue))}, ${typstString(`${conReceta.pct ?? 0}% del total`)}, color: "blue"),
    kpiCard(${typstString('Venta Libre')}, ${typstString(this.fmtBs(libre.totalRevenue))}, ${typstString(`${libre.pct ?? 0}% del total`)}, color: "green"),
    kpiCard(${typstString('Tickets CR')}, ${typstString(this.fmtNum(conReceta.salesCount))}, ${typstString('Ventas con receta')}, color: "purple"),
    kpiCard(${typstString('Tickets Libres')}, ${typstString(this.fmtNum(libre.salesCount))}, ${typstString('Ventas sin receta')}, color: "orange"),
  ))

  #section(${typstString('Distribución de Ingresos')})[
    ${chartTypst}
  ]

  ${medTableTypst('Top Medicamentos — Con Receta', medCR)}

  ${medTableTypst('Top Medicamentos — Venta Libre', medLib)}
  `;

    return this.wrapTypstDoc('Ventas con Receta vs. Ventas Libres', 'Con Receta vs. Libre', [
      ['Generado', this.nowBO()],
      ['Con receta', `${this.fmtBs(conReceta.totalRevenue)} (${conReceta.pct ?? 0}%)`],
      ['Libre', `${this.fmtBs(libre.totalRevenue)} (${libre.pct ?? 0}%)`],
    ], body);
  }

  private profitabilityTypst(data: any[], profitChartTypst: string): string {
    const totalRevenue = data.reduce((s, r) => s + Number(r.revenue ?? 0), 0);
    const totalCogs    = data.reduce((s, r) => s + Number(r.cogs ?? 0), 0);
    const totalMargin  = totalRevenue - totalCogs;
    const avgMarginPct = totalRevenue > 0 ? (totalMargin / totalRevenue) * 100 : 0;

    const tableRows = data.map(r => {
      const marginColor = Number(r.grossMarginPct) >= 20 ? 'green' : Number(r.grossMarginPct) >= 10 ? 'amber' : 'red';
      return [
        typstString(r.month ?? '-'),
        typstString(this.fmtBs(r.revenue)),
        typstString(this.fmtBs(r.cogs)),
        typstString(this.fmtBs(r.grossMargin)),
        `badge(${typstString(this.fmtPct(r.grossMarginPct))}, color: "${marginColor}")`,
      ];
    });

    const body = `
  #kpiGrid((
    kpiCard(${typstString('Ingresos Totales')}, ${typstString(this.fmtBs(totalRevenue))}, ${typstString('Ventas completadas')}, color: "blue"),
    kpiCard(${typstString('CMV Total')}, ${typstString(this.fmtBs(totalCogs))}, ${typstString('Costo de mercadería vendida')}, color: "red"),
    kpiCard(${typstString('Margen Bruto')}, ${typstString(this.fmtBs(totalMargin))}, ${typstString('Ganancia bruta')}, color: "green"),
    kpiCard(${typstString('Margen %')}, ${typstString(this.fmtPct(avgMarginPct))}, ${typstString('Del período total')}, color: "purple"),
  ))

  #section(${typstString('Evolución Mensual')})[
    ${profitChartTypst}
  ]

  ${this.typstTableSection(
    'Detalle por Mes',
    ['Mes', 'Ingresos', 'CMV', 'Margen Bruto', 'Margen %'],
    tableRows,
    ['left', 'right', 'right', 'right', 'center'],
    'omit',
  )}
  `;

    return this.wrapTypstDoc('Rentabilidad Mensual — Farmacia', 'Rentabilidad Mensual', [
      ['Generado', this.nowBO()],
      ['Ingresos Totales', this.fmtBs(totalRevenue)],
      ['CMV Total', this.fmtBs(totalCogs)],
      ['Margen Bruto', this.fmtBs(totalMargin)],
      ['Margen %', this.fmtPct(avgMarginPct)],
    ], body);
  }

  // ─── C3: PDF Ventas por método de pago ───────────────────────────────────

  async generateSalesByPaymentMethodPdf(data: SalesByPaymentMethodData): Promise<Buffer> {
    const d: any = data;
    const summary: any[] = d.summary ?? [];
    const assets: Array<{ filename: string; buffer: Buffer }> = [];
    const methodLabel: Record<string, string> = {
      cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transferencia', qr: 'QR', other: 'Otro',
    };
    const methodColor: Record<string, string> = {
      cash: '#22c55e', card: '#3b82f6', transfer: '#f59e0b', qr: '#8b5cf6', other: '#6b7280',
    };

    // Bug real heredado del código Puppeteer: pasaba {labels, datasets} directo
    // como config en vez de {data: {labels, datasets}} — inlineChart() hacía
    // `new Chart(ctx, {type, ...config})`, así que el gráfico quedaba sin la
    // clave `data` (Chart.js inválido). Se corrige naturalmente acá al armar
    // el config correcto para ChartRasterizerService — ver plan
    // enchanted-percolating-candle.md, "Hallazgo colateral".
    const chartTypst = summary.length > 0
      ? await this.rasterizeChart(assets, 'chart-payment-method.png', {
          type: 'doughnut',
          data: {
            labels: summary.map((r: any) => methodLabel[r.method] ?? r.method),
            datasets: [{ data: summary.map((r: any) => Number(r.totalRevenue ?? 0)), backgroundColor: summary.map((r: any) => methodColor[r.method] ?? '#6b7280') }],
          },
          options: { responsive: false, plugins: { legend: { position: 'bottom' } } },
        }, 320, 200)
      : '#noData()';

    return this.typstCompiler.compile(this.salesByPaymentMethodTypst(d, chartTypst), assets);
  }

  private salesByPaymentMethodTypst(data: any, chartTypst: string): string {
    const summary: any[] = data.summary ?? [];
    const daily: any[]   = data.daily ?? [];
    const grandTotal: number = data.grandTotal ?? 0;

    const methodLabel: Record<string, string> = {
      cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transferencia', qr: 'QR', other: 'Otro',
    };

    const kpiCardsTypst = summary.slice(0, 4).map((r: any) =>
      `kpiCard(${typstString(methodLabel[r.method] ?? r.method)}, ${typstString(this.fmtBs(r.totalRevenue))}, ${typstString(`${r.pct ?? 0}% · ${this.fmtNum(r.salesCount)} ventas`)}, color: "blue"),`,
    ).join('\n      ');

    const summaryRows = summary.map((r: any) => [
      `strong(${typstString(methodLabel[r.method] ?? r.method)})`,
      typstString(this.fmtNum(r.salesCount)),
      typstString(this.fmtBs(r.totalRevenue)),
      typstString(this.fmtBs(r.avgTicket)),
      typstString(`${r.pct ?? 0}%`),
      typstString(this.fmtBs(r.totalChange)),
    ]);

    const dailyRows = daily.slice(0, 150).map((r: any) => [
      typstString(r.saleDay ?? '-'),
      `strong(${typstString(methodLabel[r.method] ?? r.method)})`,
      typstString(this.fmtNum(r.salesCount)),
      typstString(this.fmtBs(r.totalRevenue)),
    ]);

    const body = `
  #grid(columns: (1fr, 1fr), column-gutter: 16pt,
    [
      #section(${typstString('Distribución por Método')})[
        ${chartTypst}
      ]
    ],
    [
      #kpiGrid((
      ${kpiCardsTypst}
      ), columns: 2)
    ],
  )

  ${this.typstTableSection(
    'Resumen por Método',
    ['Método', 'N° Ventas', 'Total', 'Ticket Prom.', '% Total', 'Vuelto Total'],
    summaryRows,
    ['left', 'right', 'right', 'right', 'center', 'right'],
  )}

  ${this.typstTableSection(
    'Detalle Diario por Método (máx. 150)',
    ['Fecha', 'Método', 'N° Ventas', 'Total'],
    dailyRows,
    ['center', 'left', 'right', 'right'],
    'omit',
  )}
  `;

    return this.wrapTypstDoc('Ventas por Método de Pago', 'Método de Pago', [
      ['Generado', this.nowBO()],
      ['Total Ingresos', this.fmtBs(grandTotal)],
      ['Métodos', this.fmtNum(summary.length)],
    ], body);
  }

  // ─── C6: PDF Comparativo mensual ─────────────────────────────────────────

  async generateMonthlySalesComparisonPdf(data: MonthlySalesComparisonData): Promise<Buffer> {
    const d: any = data;
    const rows: any[] = d.rows ?? [];
    const assets: Array<{ filename: string; buffer: Buffer }> = [];

    // Mismo bug heredado de Puppeteer que salesByPaymentMethodHtml — config
    // sin envolver en `data:`, corregido acá naturalmente (ver plan).
    const barChartTypst = rows.length > 0
      ? await this.rasterizeChart(assets, 'chart-monthly-comparison.png', {
          type: 'bar',
          data: {
            labels: rows.map((r: any) => r.month as string),
            datasets: [
              { label: 'Ingresos (Bs)', data: rows.map((r: any) => Number(r.totalRevenue ?? 0)), backgroundColor: '#3b82f6' },
              { label: 'N° Ventas', data: rows.map((r: any) => Number(r.salesCount ?? 0)), backgroundColor: '#22c55e' },
            ],
          },
          options: { responsive: false, plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true } } },
        }, 560, 220)
      : '#noData()';

    return this.typstCompiler.compile(this.monthlySalesComparisonTypst(d, barChartTypst), assets);
  }

  private monthlySalesComparisonTypst(data: any, barChartTypst: string): string {
    const rows: any[]  = data.rows ?? [];
    const summary: any = data.summary ?? {};

    const tableRows = rows.map((r: any) => {
      const growth = r.revenueGrowth;
      const growthTypst = growth === null || growth === undefined
        ? typstString('—')
        : `text(fill: rgb(${typstString(Number(growth) >= 0 ? '#16a34a' : '#dc2626')}))[${typstEscape(`${Number(growth) >= 0 ? '▲' : '▼'} ${Math.abs(Number(growth))}%`)}]`;
      return [
        `strong(${typstString(r.month ?? '-')})`,
        typstString(this.fmtNum(r.salesCount)),
        typstString(this.fmtNum(r.totalUnits)),
        typstString(this.fmtBs(r.totalRevenue)),
        typstString(this.fmtBs(r.avgTicket)),
        typstString(this.fmtNum(r.uniquePatients)),
        typstString(this.fmtNum(r.prescriptionSales)),
        growthTypst,
      ];
    });

    const body = `
  #kpiGrid((
    kpiCard(${typstString('Ingresos Totales')}, ${typstString(this.fmtBs(summary.totalRevenue))}, ${typstString('6 meses')}, color: "blue"),
    kpiCard(${typstString('Promedio Mensual')}, ${typstString(this.fmtBs(summary.avgMonthlyRevenue))}, ${typstString('Por mes')}, color: "green"),
    kpiCard(${typstString('Mejor Mes')}, ${typstString(summary.bestMonth ?? '-')}, ${typstString('Mayor ingreso')}, color: "purple"),
  ), columns: 3)

  #section(${typstString('Evolución Mensual')})[
    ${barChartTypst}
  ]

  ${this.typstTableSection(
    'Detalle por Mes',
    ['Mes', 'N° Ventas', 'Unidades', 'Ingresos', 'Ticket Prom.', 'Pacientes', 'Con Receta', 'Variación'],
    tableRows,
    ['center', 'right', 'right', 'right', 'right', 'right', 'right', 'center'],
  )}
  `;

    return this.wrapTypstDoc('Comparativo Mensual de Ventas — Últimos 6 Meses', 'Comparativo Mensual', [
      ['Generado', this.nowBO()],
      ['Ingresos Totales', this.fmtBs(summary.totalRevenue)],
      ['Promedio Mensual', this.fmtBs(summary.avgMonthlyRevenue)],
      ['Mejor Mes', summary.bestMonth ?? '-'],
    ], body);
  }

}
