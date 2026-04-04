import { Component, inject, OnInit } from '@angular/core'
import { FormBuilder, FormGroup } from '@angular/forms'
import { Router } from '@angular/router'
import { ChartData, ChartOptions } from 'chart.js'
import { forkJoin } from 'rxjs'
import { finalize } from 'rxjs/operators'
import { ReportsService } from './services/reports.service'

@Component({
  selector: 'app-reports',
  templateUrl: './reports.component.html',
})
export class ReportsComponent implements OnInit {
  private router = inject(Router)
  private fb = inject(FormBuilder)
  private reportsService = inject(ReportsService)

  rangeForm: FormGroup = this.fb.group({ startDate: [null], endDate: [null] })

  loadingStats = false
  downloading: Record<string, boolean> = {}
  seeding = false
  resetting = false

  patientStats: any = null
  appointmentStats: any = null
  financialStats: any = null
  stockStats: any = null

  // ── Gráficos clínica ──────────────────────────────────────────────────────
  genderChart: ChartData<'doughnut'> | null = null
  ageChart: ChartData<'bar'> | null = null
  appointmentStatusChart: ChartData<'doughnut'> | null = null

  // ── Gráficos finanzas ─────────────────────────────────────────────────────
  revenueChart: ChartData<'bar'> | null = null
  paymentMethodsChart: ChartData<'doughnut'> | null = null

  // ── Opciones comunes ─────────────────────────────────────────────────────
  readonly doughnutOptions: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } },
    },
  }

  readonly barOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { ticks: { font: { size: 10 } } },
      y: { beginAtZero: true, ticks: { font: { size: 10 } } },
    },
  }

  readonly revenueOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } } },
    scales: {
      x: { ticks: { font: { size: 10 } } },
      y: { beginAtZero: true, ticks: { font: { size: 10 } } },
    },
  }

  // Colores de la paleta del sistema
  private readonly BLUE   = ['#3b82f6', '#93c5fd', '#1d4ed8', '#60a5fa', '#2563eb', '#bfdbfe']
  private readonly GREEN  = ['#10b981', '#6ee7b7', '#059669', '#34d399', '#047857', '#a7f3d0']
  private readonly ORANGE = ['#f97316', '#fdba74', '#ea580c', '#fb923c', '#c2410c', '#fed7aa']

  ngOnInit(): void {
    const now = new Date()
    this.rangeForm.setValue({
      startDate: new Date(now.getFullYear(), now.getMonth(), 1),
      endDate: now,
    })
    this.loadStats()
  }

  loadStats(): void {
    const params = this.buildParams()
    this.loadingStats = true
    this.genderChart = null
    this.ageChart = null
    this.appointmentStatusChart = null
    this.revenueChart = null
    this.paymentMethodsChart = null

    forkJoin({
      patients:     this.reportsService.getPatientStats(params),
      appointments: this.reportsService.getAppointmentStats(params),
      financial:    this.reportsService.getFinancialStats(params),
      stock:        this.reportsService.getStockStats(params),
      payments:     this.reportsService.getPaymentMethodStats(params),
    }).pipe(finalize(() => (this.loadingStats = false)))
      .subscribe({
        next: ({ patients, appointments, financial, stock, payments }) => {
          this.patientStats     = patients
          this.appointmentStats = appointments
          this.financialStats   = financial
          this.stockStats       = stock
          this.buildCharts(patients, appointments, financial, payments)
        },
        error: () => {},
      })
  }

  // ── Descarga ──────────────────────────────────────────────────────────────
  download(key: string, fn: () => any): void {
    if (this.downloading[key]) return
    this.downloading[key] = true
    fn().pipe(finalize(() => (this.downloading[key] = false))).subscribe({ error: (e: any) => console.error('[Download error]', key, e) })
  }

  downloadDemographics()       { this.download('demographics',   () => this.reportsService.downloadDemographicsPdf(this.buildParams())) }
  downloadAppointments()       { this.download('appointments',   () => this.reportsService.downloadAppointmentsPdf(this.buildParams())) }
  downloadMedicalRecords()     { this.download('medicalRecords', () => this.reportsService.downloadMedicalRecordsPdf(this.buildParams())) }
  downloadDoctorPerformance()  { this.download('performance',    () => this.reportsService.downloadDoctorPerformancePdf(this.buildParams())) }
  downloadDashboard()          { this.download('dashboard',      () => this.reportsService.downloadDashboardPdf(this.buildParams())) }
  downloadFinancial()          { this.download('financial',      () => this.reportsService.downloadFinancialPdf(this.buildParams())) }
  downloadCriticalStockPdf()   { this.download('critStockPdf',   () => this.reportsService.downloadCriticalStockPdf(this.buildParams())) }
  downloadCriticalStockExcel() { this.download('critStockXls',   () => this.reportsService.downloadCriticalStockExcel(this.buildParams())) }
  downloadConsumptionExcel()   { this.download('consumption',    () => this.reportsService.downloadPharmacyConsumptionExcel(this.buildParams())) }
  downloadTransfersPdf()       { this.download('transfers',      () => this.reportsService.downloadTransferEfficiencyPdf(this.buildParams())) }

  // ── Farmacia: nuevas descargas (F1-R1..F3-R13) ───────────────────────────
  downloadRotationPdf()         { this.download('rotPdf',    () => this.reportsService.downloadRotationPdf(this.buildParams())) }
  downloadRotationExcel()       { this.download('rotXls',    () => this.reportsService.downloadRotationExcel(this.buildParams())) }
  downloadMarginsPdf()          { this.download('margPdf',   () => this.reportsService.downloadMarginsPdf(this.buildParams())) }
  downloadMarginsExcel()        { this.download('margXls',   () => this.reportsService.downloadMarginsExcel(this.buildParams())) }
  downloadDailySalesPdf()       { this.download('dailyPdf',  () => this.reportsService.downloadDailySalesPdf(this.buildParams())) }
  downloadTopSellingExcel()     { this.download('topXls',    () => this.reportsService.downloadTopSellingExcel(this.buildParams())) }
  downloadExpiryBucketsPdf()    { this.download('expBktPdf', () => this.reportsService.downloadExpiryBucketsPdf(this.buildParams())) }
  downloadProfitabilityPdf()    { this.download('profPdf',   () => this.reportsService.downloadProfitabilityPdf(this.buildParams())) }
  downloadStockMovementsExcel() { this.download('movXls',    () => this.reportsService.downloadStockMovementsExcel(this.buildParams())) }

  // ── A1: Ventas por farmacéutico ───────────────────────────────────────────
  downloadSalesByPharmacistPdf()   { this.download('pharmPdf',  () => this.reportsService.downloadSalesByPharmacistPdf(this.buildParams())) }
  downloadSalesByPharmacistExcel() { this.download('pharmXls',  () => this.reportsService.downloadSalesByPharmacistExcel(this.buildParams())) }

  // ── A2: Encargado × Día × Medicamento ────────────────────────────────────
  downloadPharmacistDayPdf()   { this.download('pharmDayPdf', () => this.reportsService.downloadPharmacistDayMedicationPdf(this.buildParams())) }
  downloadPharmacistDayExcel() { this.download('pharmDayXls', () => this.reportsService.downloadPharmacistDayMedicationExcel(this.buildParams())) }

  // ── B1: Inventario valorizado ─────────────────────────────────────────────
  downloadValorizedInventoryPdf()   { this.download('invValPdf', () => this.reportsService.downloadValorizedInventoryPdf(this.buildParams())) }
  downloadValorizedInventoryExcel() { this.download('invValXls', () => this.reportsService.downloadValorizedInventoryExcel(this.buildParams())) }

  // ── B2: Inventario por categoría ──────────────────────────────────────────
  downloadInventoryByCategoryPdf() { this.download('invCatPdf', () => this.reportsService.downloadInventoryByCategoryPdf(this.buildParams())) }

  // ── B3: Sin movimiento ────────────────────────────────────────────────────
  downloadNoMovementPdf()   { this.download('noMovPdf', () => this.reportsService.downloadNoMovementPdf(this.buildParams())) }
  downloadNoMovementExcel() { this.download('noMovXls', () => this.reportsService.downloadNoMovementExcel(this.buildParams())) }

  // ── C1: Ventas por medicamento detalle ────────────────────────────────────
  downloadMedicationDetailPdf()   { this.download('medDetPdf', () => this.reportsService.downloadMedicationDetailPdf(this.buildParams())) }
  downloadMedicationDetailExcel() { this.download('medDetXls', () => this.reportsService.downloadMedicationDetailExcel(this.buildParams())) }

  // ── C2: Receta vs Venta libre ─────────────────────────────────────────────
  downloadPrescriptionVsFreePdf() { this.download('rxFreePdf', () => this.reportsService.downloadPrescriptionVsFreePdf(this.buildParams())) }

  goBack(): void { this.router.navigateByUrl('/dashboard/home') }

  repopulateDemo(): void {
    if (!confirm('¿Repoblar todos los datos demo? Esto eliminará los datos actuales y los regenerará.')) return
    this.seeding = true
    this.reportsService.repopulateData()
      .pipe(finalize(() => { this.seeding = false; this.loadStats() }))
      .subscribe({
        next: () => alert('Datos demo repoblados correctamente.'),
        error: (e: any) => alert('Error al repoblar: ' + (e?.error?.message ?? e?.message ?? 'Error desconocido')),
      })
  }

  resetDemoData(): void {
    if (!confirm('¿Eliminar TODOS los datos? Esta acción no se puede deshacer.')) return
    this.resetting = true
    this.reportsService.resetAllData()
      .pipe(finalize(() => { this.resetting = false }))
      .subscribe({
        next: () => alert('Datos eliminados. Usa "Repoblar demo" para regenerarlos.'),
        error: (e: any) => alert('Error al eliminar: ' + (e?.error?.message ?? e?.message ?? 'Error desconocido')),
      })
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  get attendanceRate(): number {
    const total = +(this.appointmentStats?.totalAppointments ?? 0)
    const completed = +(this.appointmentStats?.statusDistribution
      ?.find((s: any) => s.status === 'completed')?.count ?? 0)
    return total > 0 ? Math.round((completed / total) * 100) : 0
  }

  get collectionRate(): number {
    return Math.round(this.financialStats?.summary?.collectionRate ?? 0)
  }

  formatCurrency(value: number | null | undefined): string {
    if (value == null) return '—'
    return new Intl.NumberFormat('es-BO', {
      style: 'currency', currency: 'BOB', maximumFractionDigits: 0,
    }).format(value)
  }

  // ── Construcción de gráficos ──────────────────────────────────────────────
  private buildCharts(patients: any, appointments: any, financial: any, payments: any): void {
    // Género
    if (patients?.genderDistribution?.length) {
      const genderLabels: Record<string, string> = { M: 'Masculino', F: 'Femenino', O: 'Otro' }
      this.genderChart = {
        labels: patients.genderDistribution.map((g: any) => genderLabels[g.gender] ?? g.gender ?? 'Sin dato'),
        datasets: [{
          data: patients.genderDistribution.map((g: any) => +g.count),
          backgroundColor: this.GREEN,
          borderWidth: 2,
          borderColor: '#fff',
        }],
      }
    }

    // Grupos de edad
    if (patients?.ageDistribution?.length) {
      const order = ['Under 18', '18-30', '31-50', '51-70', 'Over 70']
      const sorted = [...patients.ageDistribution].sort(
        (a: any, b: any) => order.indexOf(a.ageGroup) - order.indexOf(b.ageGroup)
      )
      this.ageChart = {
        labels: sorted.map((a: any) => a.ageGroup),
        datasets: [{
          label: 'Pacientes',
          data: sorted.map((a: any) => +a.count),
          backgroundColor: this.GREEN[0],
          borderRadius: 6,
        }],
      }
    }

    // Estado de citas
    if (appointments?.statusDistribution?.length) {
      const statusLabels: Record<string, string> = {
        scheduled: 'Programada', completed: 'Completada',
        cancelled: 'Cancelada', no_show: 'No asistió',
      }
      this.appointmentStatusChart = {
        labels: appointments.statusDistribution.map((s: any) => statusLabels[s.status] ?? s.status),
        datasets: [{
          data: appointments.statusDistribution.map((s: any) => +s.count),
          backgroundColor: this.BLUE,
          borderWidth: 2,
          borderColor: '#fff',
        }],
      }
    }

    // Ingresos por mes
    if (financial?.monthlyRevenue?.length) {
      this.revenueChart = {
        labels: financial.monthlyRevenue.map((m: any) => m.month),
        datasets: [
          {
            label: 'Facturado',
            data: financial.monthlyRevenue.map((m: any) => +m.totalBilled),
            backgroundColor: '#3b82f6',
            borderRadius: 4,
          },
          {
            label: 'Recaudado',
            data: financial.monthlyRevenue.map((m: any) => +m.totalPaid),
            backgroundColor: '#10b981',
            borderRadius: 4,
          },
        ],
      }
    }

    // Métodos de pago
    if (Array.isArray(payments) && payments.length) {
      const methodLabels: Record<string, string> = {
        cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transferencia', insurance: 'Seguro',
      }
      this.paymentMethodsChart = {
        labels: payments.map((p: any) => methodLabels[p.method] ?? p.method),
        datasets: [{
          data: payments.map((p: any) => +p.totalAmount),
          backgroundColor: this.BLUE,
          borderWidth: 2,
          borderColor: '#fff',
        }],
      }
    }
  }

  private buildParams(): Record<string, string> {
    const { startDate, endDate } = this.rangeForm.value
    const p: Record<string, string> = {}
    if (startDate) p['startDate'] = (startDate as Date).toISOString().slice(0, 10)
    if (endDate)   p['endDate']   = (endDate   as Date).toISOString().slice(0, 10)
    return p
  }
}
