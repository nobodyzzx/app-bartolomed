import { Component, inject, OnInit } from '@angular/core'
import { FormBuilder, FormGroup } from '@angular/forms'
import { Router } from '@angular/router'
import { Permission } from '@core/enums/permission.enum'
import { RoleStateService } from '@core/services/role-state.service'
import { ChartData, ChartOptions } from 'chart.js'
import { Observable, forkJoin } from 'rxjs'
import { finalize } from 'rxjs/operators'
import { ReportsService } from './services/reports.service'
import { toLocalISODate } from '../../../../shared/utils/date-format.util'

@Component({
    selector: 'app-reports',
    templateUrl: './reports.component.html',
    standalone: false
})
export class ReportsComponent implements OnInit {
  private router = inject(Router)
  private fb = inject(FormBuilder)
  private reportsService = inject(ReportsService)
  private roleState = inject(RoleStateService)

  readonly Permission = Permission

  // Cada sección de la página llama a endpoints con @Auth/permisos distintos
  // en el backend (ver reports.controller.ts) — antes se mostraban las 6
  // secciones y ~50 botones a todos los roles por igual, sin importar si el
  // usuario realmente podía generarlos.
  get canViewClinical(): boolean {
    return this.roleState.hasPermission(Permission.ReportsClinical)
  }

  get canViewFinancial(): boolean {
    return this.roleState.hasPermission(Permission.ReportsFinancial)
  }

  get canViewPharmacy(): boolean {
    return this.roleState.hasPermission(Permission.ReportsPharmacy)
  }

  /** Laboratorio y Estudios Especiales — antes ningún rol de ese módulo tenía acceso a Reportes. */
  get canViewLab(): boolean {
    return this.roleState.hasPermission(Permission.ReportsLab)
  }

  /**
   * Los informes de activos cuelgan de `/assets` y el backend los cubre con
   * `AssetsManage` (ADMIN/SUPER_ADMIN), no con los permisos de reportes: gatear
   * la sección por `ReportsPharmacy` mostraría al farmacéutico cinco botones que
   * siempre le devolverían 403.
   */
  get canViewAssets(): boolean {
    return this.roleState.hasPermission(Permission.AssetsManage)
  }

  rangeForm: FormGroup = this.fb.group({ startDate: [null], endDate: [null] })

  loadingStats = false
  downloading: Record<string, boolean> = {}

  patientStats: any = null
  appointmentStats: any = null
  financialStats: any = null
  revenueStats: any = null
  discountStats: any = null
  receivableStats: any = null
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

    if (this.canViewAssets) {
      this.reportsService.getAssetLocations().subscribe({
        next: locations => (this.assetLocations = [...locations].sort((a, b) => a.localeCompare(b, 'es'))),
        error: () => (this.assetLocations = []),
      })
    }
  }

  loadStats(): void {
    const params = this.buildParams()
    this.loadingStats = true
    this.genderChart = null
    this.ageChart = null
    this.appointmentStatusChart = null
    this.revenueChart = null
    this.paymentMethodsChart = null

    // Bug real: forkJoin con las 5 llamadas fijas fallaba completo si UNA
    // sola devolvía 403 (p. ej. DOCTOR no tiene ReportsFinancial/ReportsPharmacy,
    // PHARMACIST no tiene ReportsClinical) — la página quedaba en blanco
    // incluso para los datos que el rol sí puede ver. Ahora solo se piden los
    // reportes permitidos por el rol actual.
    const requests: Record<string, Observable<any>> = {}
    if (this.canViewClinical) {
      requests['patients'] = this.reportsService.getPatientStats(params)
      requests['appointments'] = this.reportsService.getAppointmentStats(params)
    }
    if (this.canViewFinancial) {
      requests['financial'] = this.reportsService.getFinancialStats(params)
      requests['payments'] = this.reportsService.getPaymentMethodStats(params)
      // Control de ingresos: se calcula sobre los cargos, así que sabe de qué
      // módulo salió cada boliviano — algo que el resumen financiero clásico
      // no puede responder porque lee facturas sin desglose.
      requests['revenue'] = this.reportsService.getRevenueByOrigin(params)
      requests['discounts'] = this.reportsService.getDiscountsReport(params)
      requests['receivables'] = this.reportsService.getReceivables(params)
    }
    if (this.canViewPharmacy) {
      requests['stock'] = this.reportsService.getStockStats(params)
    }

    if (Object.keys(requests).length === 0) {
      this.loadingStats = false
      return
    }

    forkJoin(requests).pipe(finalize(() => (this.loadingStats = false)))
      .subscribe({
        next: (result: Record<string, any>) => {
          this.patientStats     = result['patients'] ?? null
          this.appointmentStats = result['appointments'] ?? null
          this.financialStats   = result['financial'] ?? null
          this.revenueStats     = result['revenue'] ?? null
          this.discountStats    = result['discounts'] ?? null
          this.receivableStats  = result['receivables'] ?? null
          this.stockStats       = result['stock'] ?? null
          this.buildCharts(result['patients'], result['appointments'], result['financial'], result['payments'])
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
  downloadRevenueControl()     { this.download('revenueControl', () => this.reportsService.downloadRevenueControlPdf(this.buildParams())) }
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

  // ── D1: Corte de turno individual (farmacia + punto de cobro, por persona) ─
  downloadStaffShiftDetailPdf() { this.download('shiftPdf', () => this.reportsService.downloadStaffShiftDetailPdf(this.buildParams())) }

  // ── D2: Laboratorio y Estudios Especiales ─────────────────────────────────
  downloadLabActivityPdf() { this.download('labPdf', () => this.reportsService.downloadLabActivityPdf(this.buildParams())) }

  // ── A1: Ventas por farmacéutico ───────────────────────────────────────────
  downloadSalesByPharmacistPdf()   { this.download('pharmPdf',  () => this.reportsService.downloadSalesByPharmacistPdf(this.buildParams())) }
  downloadSalesByPharmacistExcel() { this.download('pharmXls',  () => this.reportsService.downloadSalesByPharmacistExcel(this.buildParams())) }

  // ── A2: Encargado × Día × Medicamento ────────────────────────────────────
  downloadPharmacistDayPdf()   { this.download('pharmDayPdf', () => this.reportsService.downloadPharmacistDayMedicationPdf(this.buildParams())) }
  downloadPharmacistDayExcel() { this.download('pharmDayXls', () => this.reportsService.downloadPharmacistDayMedicationExcel(this.buildParams())) }

  // ── B1: Inventario valorizado ─────────────────────────────────────────────
  downloadInventoryListPdf()        { this.download('invListPdf', () => this.reportsService.downloadInventoryListPdf(this.buildParams())) }
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

  // ── C3: Ventas por método de pago ─────────────────────────────────────────
  downloadSalesByPaymentPdf()   { this.download('payPdf', () => this.reportsService.downloadSalesByPaymentPdf(this.buildParams())) }
  downloadSalesByPaymentExcel() { this.download('payXls', () => this.reportsService.downloadSalesByPaymentExcel(this.buildParams())) }

  // ── C6: Comparativo mensual ───────────────────────────────────────────────
  downloadMonthlySalesComparisonPdf()   { this.download('monthlyPdf', () => this.reportsService.downloadMonthlySalesComparisonPdf(this.buildParams())) }
  downloadMonthlySalesComparisonExcel() { this.download('monthlyXls', () => this.reportsService.downloadMonthlySalesComparisonExcel(this.buildParams())) }

  // ── Activos fijos ─────────────────────────────────────────────────────────
  // Sin rango de fechas: el inventario se cargó sin fecha de compra, así que
  // filtrar por período dejaría los cinco informes en cero. El filtro que sí
  // sirve acá es el ambiente.
  assetLocations: string[] = []
  assetLocation = ''

  private assetParams(): Record<string, string> {
    return this.assetLocation ? { location: this.assetLocation } : {}
  }

  downloadAssetInventory()    { this.download('assetInv',   () => this.reportsService.downloadAssetInventoryPdf(this.assetParams())) }
  downloadAssetHandoverAct()  { this.download('assetActa',  () => this.reportsService.downloadAssetHandoverActPdf(this.assetParams())) }
  downloadAssetCountSheet()   { this.download('assetCount', () => this.reportsService.downloadAssetCountSheetPdf(this.assetParams())) }
  // Resumen y bajas son de toda la clínica: partirlos por ambiente los vacía de
  // sentido (el resumen justamente compara ambientes entre sí).
  downloadAssetSummary()      { this.download('assetSum',   () => this.reportsService.downloadAssetSummaryPdf()) }
  downloadAssetCondition()    { this.download('assetCond',  () => this.reportsService.downloadAssetConditionPdf()) }

  goBack(): void { this.router.navigateByUrl('/dashboard/home') }

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

  /**
   * Con decimales, para los desgloses donde las columnas tienen que sumar.
   * Redondeado, el detalle de descuentos mostraba "Bs 10 + Bs 1 + Bs 1" contra
   * un total de "Bs 13" y se leía como un error de cálculo.
   */
  formatCurrencyExact(value: number | null | undefined): string {
    if (value == null) return '—'
    return new Intl.NumberFormat('es-BO', {
      style: 'currency', currency: 'BOB', minimumFractionDigits: 2, maximumFractionDigits: 2,
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
      const order = ['Menor de 18', '18-30', '31-50', '51-70', 'Mayor de 70']
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
        scheduled: 'Programada', confirmed: 'Confirmada', in_progress: 'En progreso',
        completed: 'Completada', cancelled: 'Cancelada', no_show: 'No asistió',
        rescheduled: 'Reprogramada',
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
    // Día local: el datepicker devuelve medianoche local y con ISO el rango
    // se corría un día para quien consulta de noche.
    if (startDate) p['startDate'] = toLocalISODate(startDate as Date)
    if (endDate)   p['endDate']   = toLocalISODate(endDate as Date)
    return p
  }
}
