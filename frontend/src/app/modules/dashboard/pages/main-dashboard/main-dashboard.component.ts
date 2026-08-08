import { Component, DestroyRef, inject, OnInit } from '@angular/core'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { ActivatedRoute, Router } from '@angular/router'
import { permissionLabel } from '@core/constants/permission-labels'
import { ADMIN_ONLY_ROLES, BILLING_ROLES, CLINICAL_ROLES, LAB_ROLES, PHARMACY_ROLES, SPECIAL_STUDY_ROLES } from '@core/constants/role-groups'
import { Permission } from '@core/enums/permission.enum'
import { UserRoles } from '@core/enums/user-roles.enum'
import { RoleStateService } from '@core/services/role-state.service'
import { StatCardColor } from '@shared/components/stat-card/stat-card.component'
import { ChartData, ChartOptions } from 'chart.js'
import { forkJoin, of } from 'rxjs'
import { AuthService } from '../../../auth/services/auth.service'
import { ClinicContextService } from '../../../clinics/services/clinic-context.service'
import { DashboardService } from './dashboard.service'
import { DashboardStats, RecentAppointment, RecentPatient, StockAlert } from './interfaces/dashboard-ui.interfaces'

/**
 * `permissions` es opcional y se suma al filtro por rol: hay pantallas que un rol
 * ve por pertenecer al grupo pero que el backend le niega igual. El caso vivo es
 * DOCTOR con las citas —está en `CLINICAL_ROLES` pero no tiene `AppointmentsRead`
 * a propósito—: sin este filtro se le pintaban las tarjetas "Mis Citas Hoy" y
 * "Por Confirmar" con un 0 que no era real (el dato ni se pide) y que además
 * llevaban a una ruta que su guard bloquea.
 */
interface StatCardDef {
  label: string
  sublabel: string
  icon: string
  color: StatCardColor
  route: string
  value: string | number
  roles: UserRoles[]
  permissions?: Permission[]
}

interface QuickActionDef {
  label: string
  icon: string
  route: string
  color: string
  roles: UserRoles[]
  permissions?: Permission[]
}

// Roles que ven "todas" las citas/pacientes de la clínica en vez de solo las propias.
const BROAD_VIEW: UserRoles[] = [UserRoles.NURSE, UserRoles.RECEPTIONIST, UserRoles.ADMIN, UserRoles.SUPER_ADMIN]

@Component({
    selector: 'app-main-dashboard',
    templateUrl: './main-dashboard.component.html',
    styleUrls: ['./main-dashboard.component.css'],
    standalone: false
})
export class MainDashboardComponent implements OnInit {
  private readonly destroyRef     = inject(DestroyRef)
  private readonly authService    = inject(AuthService)
  private readonly roleState      = inject(RoleStateService)
  private readonly clinicContext  = inject(ClinicContextService)

  stats: DashboardStats = {
    totalPatients: 0,
    totalAppointments: 0,
    totalDoctors: 0,
    totalNurses: 0,
    totalReceptionists: 0,
    totalPharmacists: 0,
    totalLaboratory: 0,
    monthlyRevenue: 0,
    pendingAppointments: 0,
    lowStockItems: 0,
    pendingInvoices: 0,
    overdueInvoices: 0,
    pendingRevenue: 0,
    openLabOrders: 0,
  }

  recentAppointments: RecentAppointment[] = []
  todayAppointments: RecentAppointment[] = []
  stockAlerts: StockAlert[] = []
  recentPatients: RecentPatient[] = []

  loading = false
  loadingStats = false
  loadingAppointments = false
  loadingStock = false
  loadingPatients = false
  loadingCharts = false

  // ── Chart data ────────────────────────────────────────────────────────────

  weeklyChartData: ChartData<'bar'> = { labels: [], datasets: [] }
  monthlyChartData: ChartData<'line'> = { labels: [], datasets: [] }
  appointmentChartData: ChartData<'doughnut'> = { labels: [], datasets: [] }

  weeklyChartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: ctx => ` Bs ${Number(ctx.parsed.y).toLocaleString('es-BO')}` } },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: '#f1f5f9' },
        ticks: { callback: v => `Bs ${Number(v).toLocaleString('es-BO')}` },
      },
      x: { grid: { display: false } },
    },
  }

  monthlyChartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: ctx => ` Bs ${Number(ctx.parsed.y).toLocaleString('es-BO')}` } },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: '#f1f5f9' },
        ticks: { callback: v => `Bs ${Number(v).toLocaleString('es-BO')}` },
      },
      x: { grid: { display: false } },
    },
  }

  appointmentChartOptions: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '65%',
    plugins: {
      legend: { position: 'bottom', labels: { padding: 16, boxWidth: 12, font: { size: 12 } } },
    },
  }

  permissionError: string | null = null
  showAlertBanner = true

  readonly today          = new Date()
  readonly greeting       = this.buildGreeting()
  readonly todayFormatted = new Intl.DateTimeFormat('es-BO', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  }).format(this.today)

  get userName(): string {
    const u = this.authService.currentUser()
    if (!u) return 'Bartolomé'
    return u.personalInfo.firstName ?? u.email.split('@')[0] ?? 'Bartolomé'
  }

  // ── KPI Cards filtrados por rol ──────────────────────────────────────────

  get visibleStatCards(): StatCardDef[] {
    const totalStaff = this.stats.totalDoctors + this.stats.totalNurses
      + this.stats.totalReceptionists + this.stats.totalPharmacists + this.stats.totalLaboratory

    const cards: StatCardDef[] = [
      {
        label: 'Total Pacientes', sublabel: 'Registrados',
        icon: 'people', color: 'blue', route: '/dashboard/patients',
        value: this.stats.totalPatients,
        roles: CLINICAL_ROLES,
      },
      {
        label: this.isDoctorOnlyView ? 'Mis Citas Hoy' : 'Citas Hoy', sublabel: 'Programadas',
        icon: 'calendar_today', color: 'green', route: '/dashboard/appointments',
        value: this.stats.totalAppointments,
        roles: CLINICAL_ROLES,
        permissions: [Permission.AppointmentsRead],
      },
      {
        label: 'Por Confirmar', sublabel: this.isDoctorOnlyView ? 'Mis citas pendientes' : 'Citas pendientes',
        icon: 'pending_actions', color: 'amber', route: '/dashboard/appointments',
        value: this.stats.pendingAppointments,
        roles: CLINICAL_ROLES,
        permissions: [Permission.AppointmentsRead],
      },
      {
        label: 'Personal Activo', sublabel: this.staffBreakdownLabel(totalStaff),
        icon: 'medical_services', color: 'purple', route: '/dashboard/users',
        value: totalStaff,
        roles: ADMIN_ONLY_ROLES,
      },
      {
        label: 'Stock Bajo', sublabel: 'Medicamentos',
        icon: 'inventory_2', color: 'red', route: '/dashboard/pharmacy/inventory',
        value: this.stats.lowStockItems,
        roles: PHARMACY_ROLES,
      },
      {
        // `/dashboard/reports/financial-reports` no existe: el módulo de reportes
        // define una sola ruta (`/dashboard/reports`) y las secciones se gatean
        // por permiso dentro de la página. El comodín mandaba a `/auth`, y de ahí
        // el guestGuard devolvía al dashboard: la tarjeta no hacía nada.
        label: 'Ventas Farmacia', sublabel: 'Este mes',
        icon: 'attach_money', color: 'orange', route: '/dashboard/reports',
        value: this.formatCurrency(this.stats.monthlyRevenue),
        roles: PHARMACY_ROLES,
      },
      {
        label: 'Órdenes de Laboratorio', sublabel: 'Pendientes de resultado',
        icon: 'biotech', color: 'purple', route: '/dashboard/laboratory',
        value: this.stats.openLabOrders,
        roles: LAB_ROLES,
      },
      {
        label: 'Facturas Pendientes', sublabel: this.stats.overdueInvoices > 0 ? `${this.stats.overdueInvoices} vencida(s)` : 'Por cobrar',
        icon: 'receipt_long', color: 'amber', route: '/dashboard/billing',
        value: this.stats.pendingInvoices,
        roles: BILLING_ROLES,
      },
      {
        label: 'Por Cobrar', sublabel: 'Monto pendiente',
        icon: 'payments', color: 'red', route: '/dashboard/billing',
        value: this.formatCurrency(this.stats.pendingRevenue),
        roles: BILLING_ROLES,
      },
    ]
    return cards.filter(c => this.roleState.hasAnyRole(c.roles) && this.hasCardPermissions(c))
  }

  /** Sin `permissions` declarados, basta el rol. Con ellos, hacen falta todos. */
  private hasCardPermissions(item: { permissions?: Permission[] }): boolean {
    return (item.permissions ?? []).every(p => this.roleState.hasPermission(p))
  }

  private staffBreakdownLabel(totalStaff: number): string {
    if (totalStaff === 0) return 'Personal activo'
    const parts: string[] = []
    if (this.stats.totalDoctors > 0) parts.push(`${this.stats.totalDoctors} doctor(es)`)
    if (this.stats.totalNurses > 0) parts.push(`${this.stats.totalNurses} enfermero(s)`)
    if (this.stats.totalReceptionists > 0) parts.push(`${this.stats.totalReceptionists} recepción`)
    if (this.stats.totalPharmacists > 0) parts.push(`${this.stats.totalPharmacists} farmacia`)
    if (this.stats.totalLaboratory > 0) parts.push(`${this.stats.totalLaboratory} laboratorio`)
    return parts.join(' · ')
  }

  // ── Accesos Rápidos filtrados por rol ────────────────────────────────────

  get visibleQuickActions(): QuickActionDef[] {
    const actions: QuickActionDef[] = [
      {
        label: 'Registrar Paciente', icon: 'person_add',
        route: '/dashboard/patients/new',
        color: 'bg-blue-50 text-blue-600 hover:bg-blue-100 border-blue-100',
        roles: [UserRoles.ADMIN, UserRoles.SUPER_ADMIN, UserRoles.DOCTOR, UserRoles.RECEPTIONIST, UserRoles.NURSE],
      },
      {
        label: 'Nueva Cita', icon: 'event_available',
        route: '/dashboard/appointments/new',
        color: 'bg-green-50 text-green-600 hover:bg-green-100 border-green-100',
        roles: [...CLINICAL_ROLES],
        permissions: [Permission.AppointmentsWrite],
      },
      {
        label: 'Nueva Venta', icon: 'point_of_sale',
        route: '/dashboard/pharmacy/sales-dispensing/new',
        color: 'bg-purple-50 text-purple-600 hover:bg-purple-100 border-purple-100',
        roles: PHARMACY_ROLES,
      },
      {
        // NURSE tiene RecordsRead (ve el módulo) pero el backend solo permite
        // crear/editar expedientes a DOCTOR/ADMIN — no incluir NURSE acá.
        label: 'Expediente Médico', icon: 'note_add',
        route: '/dashboard/medical-records/new',
        color: 'bg-teal-50 text-teal-600 hover:bg-teal-100 border-teal-100',
        roles: [UserRoles.ADMIN, UserRoles.SUPER_ADMIN, UserRoles.DOCTOR],
      },
      {
        label: 'Nueva Receta', icon: 'receipt_long',
        route: '/dashboard/prescriptions/new',
        color: 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border-indigo-100',
        roles: [UserRoles.ADMIN, UserRoles.SUPER_ADMIN, UserRoles.DOCTOR, UserRoles.PHARMACIST],
      },
      {
        // Apuntaba a `/dashboard/billing/invoices/new`, una ruta que no existe en
        // ningún módulo: el comodín del router devolvía al usuario al dashboard sin
        // decir nada, así que el acceso rápido más visible de recepción no hacía
        // nada. Desde la facturación unificada por cargos no se crea una factura
        // suelta: se cobra en el Punto de Cobro, que es lo que se enlaza ahora.
        label: 'Punto de Cobro', icon: 'point_of_sale',
        route: '/dashboard/checkout',
        color: 'bg-amber-50 text-amber-600 hover:bg-amber-100 border-amber-100',
        roles: [UserRoles.ADMIN, UserRoles.SUPER_ADMIN, UserRoles.RECEPTIONIST],
      },
      {
        label: 'Reportes', icon: 'analytics',
        route: '/dashboard/reports',
        color: 'bg-slate-50 text-slate-600 hover:bg-slate-100 border-slate-100',
        roles: [UserRoles.DOCTOR, UserRoles.PHARMACIST, UserRoles.ADMIN, UserRoles.SUPER_ADMIN],
      },
      {
        label: 'Ver Inventario', icon: 'inventory',
        route: '/dashboard/pharmacy/inventory',
        color: 'bg-orange-50 text-orange-600 hover:bg-orange-100 border-orange-100',
        roles: PHARMACY_ROLES,
      },
      {
        // Bug real (auditoría de interrelación de módulos, 2026-08-04):
        // LABORATORY no aparecía en ningún grupo de roles de este dashboard
        // (CLINICAL_ROLES/PHARMACY_ROLES/BILLING_ROLES/ADMIN_ONLY_ROLES), así
        // que un usuario solo-laboratorio veía la home completamente vacía
        // pese a tener acceso pleno al módulo Laboratorio. 3ra recurrencia del
        // mismo patrón que role-state.service.ts y sidebar/navbar ROLE_LABELS.
        label: 'Laboratorio', icon: 'biotech',
        route: '/dashboard/laboratory',
        color: 'bg-cyan-50 text-cyan-600 hover:bg-cyan-100 border-cyan-100',
        roles: [UserRoles.DOCTOR, UserRoles.LABORATORY, UserRoles.ADMIN, UserRoles.SUPER_ADMIN],
      },
      {
        // Mismo motivo que la acción de Laboratorio de aquí arriba: sin esto,
        // un usuario solo-SPECIAL_STUDIES entra y ve la home vacía pese a
        // tener su módulo completo.
        label: 'Estudios Especiales', icon: 'monitor_heart',
        route: '/dashboard/special-studies',
        color: 'bg-violet-50 text-violet-600 hover:bg-violet-100 border-violet-100',
        roles: SPECIAL_STUDY_ROLES,
      },
    ]
    return actions.filter(a => this.roleState.hasAnyRole(a.roles) && this.hasCardPermissions(a))
  }

  // ── Visibilidad de secciones por rol ─────────────────────────────────────

  /**
   * Por permiso y no por rol: el backend gatea `/appointments` con
   * `AppointmentsRead`, que DOCTOR no tiene a propósito. Decidirlo por rol
   * pedía las citas igual y se llevaba un 403 en cada carga, en silencio.
   */
  get showAppointmentsSection(): boolean {
    return this.roleState.hasAnyRole(CLINICAL_ROLES) && this.roleState.hasPermission(Permission.AppointmentsRead)
  }

  /** Laboratorio: lo ve quien pide órdenes y quien las procesa. */
  get showLabSection(): boolean {
    return this.roleState.hasAnyRole(LAB_ROLES) && this.roleState.hasPermission(Permission.LabRead)
  }

  get showStockSection(): boolean {
    return this.roleState.hasAnyRole(PHARMACY_ROLES)
  }

  get showPatientsSection(): boolean {
    return this.roleState.hasAnyRole(CLINICAL_ROLES)
  }

  get showSalesCharts(): boolean {
    return this.roleState.hasAnyRole(PHARMACY_ROLES)
  }

  get showStaffSection(): boolean {
    return this.roleState.hasAnyRole(ADMIN_ONLY_ROLES)
  }

  /**
   * Mismo gate que el timeline: el gráfico se alimenta de `todayAppointments`, que
   * solo se pide si hay permiso. Filtrando únicamente por rol, a DOCTOR le salía
   * un "Citas de Hoy — Sin citas hoy" permanente aunque tuviera la agenda llena:
   * el dato nunca se pedía.
   */
  get showAppointmentChart(): boolean {
    return this.showAppointmentsSection
  }

  get showBillingSection(): boolean {
    return this.roleState.hasAnyRole(BILLING_ROLES)
  }

  /**
   * Un DOCTOR sin ningún otro rol "de vista amplia" (NURSE/RECEPTIONIST/ADMIN) ve solo
   * sus propias citas en vez de las de toda la clínica. Un híbrido (ej. DOCTOR+ADMIN)
   * mantiene la vista completa — no reducir el alcance de un usuario con más de un rol.
   */
  get isDoctorOnlyView(): boolean {
    return this.roleState.hasRole(UserRoles.DOCTOR) && !this.roleState.hasAnyRole(BROAD_VIEW)
  }

  private get currentDoctorId(): string | undefined {
    return this.isDoctorOnlyView ? this.authService.currentUser()?.id : undefined
  }

  // ── Alertas críticas (solo si el rol las ve) ─────────────────────────────

  get hasCriticalAlerts(): boolean {
    const stockAlert   = this.showStockSection && this.stats.lowStockItems > 0
    const apptAlert    = this.showAppointmentsSection && this.stats.pendingAppointments > 0
    const billingAlert = this.showBillingSection && this.stats.overdueInvoices > 0
    return stockAlert || apptAlert || billingAlert
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private dashboardService: DashboardService,
  ) {}

  ngOnInit(): void {
    this.route.queryParams.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      if (params['error'] === 'insufficient_permissions') {
        // Se traduce a lenguaje de clínica: "patients.read" no le dice nada a
        // quien lo lee, "ver pacientes" sí — y es lo que tiene que pedirle a
        // quien administra el sistema.
        const required: string[] = params['required']?.split(',').filter(Boolean) || []
        const acciones = required.map(permissionLabel)
        this.permissionError = acciones.length
          ? `No tienes acceso a ese módulo. Necesitas permiso para ${acciones.join(' o ')}. Pídeselo al administrador de la clínica.`
          : 'No tienes acceso a ese módulo. Pídele acceso al administrador de la clínica.'
        setTimeout(() => (this.permissionError = null), 8000)
      }
    })
    this.loadDashboardData()
  }

  loadDashboardData(): void {
    this.loading = true
    this.loadingStats = true
    this.loadingAppointments = true
    this.loadingStock = true
    this.loadingPatients = true
    this.loadingCharts = true

    const needsClinical = this.showAppointmentsSection || this.showPatientsSection
    const needsAppointments = this.showAppointmentsSection
    const needsStock    = this.showStockSection
    const needsStaff    = this.showStaffSection
    const needsBilling  = this.showBillingSection
    const needsLab      = this.showLabSection
    const doctorId      = this.currentDoctorId

    forkJoin({
      patientStats: needsClinical ? this.dashboardService.getPatientStats()                     : of({ total: 0 }),
      appointments: needsAppointments ? this.dashboardService.getTodayAppointments(doctorId)        : of([] as RecentAppointment[]),
      pending:      needsAppointments ? this.dashboardService.getPendingAppointmentsCount(doctorId) : of(0),
      stock:        needsStock    ? this.dashboardService.getLowStockAlerts()                    : of([] as StockAlert[]),
      patients:     needsClinical ? this.dashboardService.getRecentPatients()                    : of([] as RecentPatient[]),
      staff:        needsStaff    ? this.dashboardService.getStaffStatistics()                   : of({ totalDoctors: 0, totalNurses: 0, totalReceptionists: 0, totalPharmacists: 0, totalLaboratory: 0 }),
      labOrders:    needsLab      ? this.dashboardService.getOpenLabOrdersCount()                  : of(0),
      billing:      needsBilling  ? this.dashboardService.getBillingSummary()                    : of({ pendingInvoices: 0, overdueInvoices: 0, pendingRevenue: 0 }),
    }).pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ patientStats, appointments, pending, stock, patients, staff, billing, labOrders }) => {
          this.stats = {
            totalPatients:       patientStats.total,
            totalAppointments:   appointments.length,
            pendingAppointments: pending,
            totalDoctors:        staff.totalDoctors,
            totalNurses:         staff.totalNurses,
            totalReceptionists:  staff.totalReceptionists,
            totalPharmacists:    staff.totalPharmacists,
            totalLaboratory:     staff.totalLaboratory,
            monthlyRevenue:      this.stats.monthlyRevenue,
            lowStockItems:       stock.length,
            pendingInvoices:     billing.pendingInvoices,
            overdueInvoices:     billing.overdueInvoices,
            pendingRevenue:      billing.pendingRevenue,
            openLabOrders:       labOrders,
          }
          this.recentAppointments  = appointments
          this.todayAppointments   = appointments
          this.stockAlerts         = stock
          this.recentPatients      = patients
          this.buildAppointmentChart(appointments)
        },
        complete: () => {
          this.loading = false
          this.loadingStats = false
          this.loadingAppointments = false
          this.loadingStock = false
          this.loadingPatients = false
          this.loadSalesCharts()
        },
      })
  }

  private buildAppointmentChart(appointments: RecentAppointment[]): void {
    const counts: Record<string, number> = { scheduled: 0, confirmed: 0, completed: 0, cancelled: 0 }
    appointments.forEach(a => {
      const s = a.status in counts ? a.status : 'scheduled'
      counts[s]++
    })
    this.appointmentChartData = {
      labels: ['Programadas', 'Confirmadas', 'Completadas', 'Canceladas'],
      datasets: [{
        data: [counts['scheduled'], counts['confirmed'], counts['completed'], counts['cancelled']],
        backgroundColor: ['#fbbf24', '#34d399', '#60a5fa', '#f87171'],
        borderWidth: 0,
        hoverOffset: 6,
      }],
    }
  }

  private loadSalesCharts(): void {
    if (!this.showSalesCharts) {
      this.loadingCharts = false
      return
    }
    const clinicId = this.clinicContext.clinicId ?? ''
    forkJoin({
      weekly:  this.dashboardService.getWeeklySales(clinicId),
      monthly: this.dashboardService.getMonthlySales(clinicId),
    }).pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ weekly, monthly }) => {
          this.weeklyChartData = {
            labels: weekly.labels,
            datasets: [{
              data: weekly.values,
              backgroundColor: '#3b82f6',
              hoverBackgroundColor: '#2563eb',
              borderRadius: 6,
              borderSkipped: false,
            }],
          }
          this.monthlyChartData = {
            labels: monthly.labels,
            datasets: [{
              data: monthly.values,
              borderColor: '#6366f1',
              backgroundColor: 'rgba(99,102,241,0.12)',
              pointBackgroundColor: '#6366f1',
              pointRadius: 4,
              tension: 0.4,
              fill: true,
            }],
          }
          // El último valor del comparativo mensual (6 meses, orden ascendente) es el mes en curso.
          this.stats.monthlyRevenue = monthly.values[monthly.values.length - 1] ?? 0
        },
        complete: () => { this.loadingCharts = false },
      })
  }

  refreshDashboard(): void {
    this.loadDashboardData()
  }

  checkLoadingComplete(): void {
    if (!this.loadingStats && !this.loadingAppointments && !this.loadingStock && !this.loadingPatients) {
      this.loading = false
    }
  }

  // ── Helpers de UI ──────────────────────────────────────────────────────────

  stockPercent(alert: StockAlert): number {
    return Math.min(100, Math.round((alert.currentStock / alert.minimumStock) * 100))
  }

  stockBarColor(alert: StockAlert): string {
    const pct = this.stockPercent(alert)
    if (pct <= 25) return 'bg-red-500'
    if (pct <= 50) return 'bg-amber-400'
    return 'bg-green-500'
  }

  stockUrgencyBadge(alert: StockAlert): { text: string; cls: string } {
    const pct = this.stockPercent(alert)
    if (pct <= 25) return { text: 'Crítico', cls: 'bg-red-100 text-red-700' }
    if (pct <= 50) return { text: 'Bajo', cls: 'bg-amber-100 text-amber-700' }
    return { text: 'Normal', cls: 'bg-green-100 text-green-700' }
  }

  appointmentStatusCfg(status: string): { icon: string; dot: string; badge: string; text: string } {
    const map: Record<string, { icon: string; dot: string; badge: string; text: string }> = {
      confirmed: { icon: 'check_circle', dot: 'bg-green-400',  badge: 'bg-green-100 text-green-700', text: 'Confirmada' },
      pending:   { icon: 'schedule',     dot: 'bg-amber-400',  badge: 'bg-amber-100 text-amber-700', text: 'Pendiente' },
      cancelled: { icon: 'cancel',       dot: 'bg-red-400',    badge: 'bg-red-100 text-red-700',     text: 'Cancelada' },
      completed: { icon: 'task_alt',     dot: 'bg-blue-300',   badge: 'bg-blue-100 text-blue-600',   text: 'Completada' },
    }
    return map[status] ?? { icon: 'info', dot: 'bg-slate-300', badge: 'bg-slate-100 text-slate-600', text: status }
  }

  patientInitials(name: string): string {
    return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
  }

  patientAvatarColor(id: number): string {
    const colors = [
      'bg-blue-100 text-blue-700',   'bg-purple-100 text-purple-700',
      'bg-green-100 text-green-700', 'bg-amber-100 text-amber-700',
      'bg-pink-100 text-pink-700',   'bg-teal-100 text-teal-700',
    ]
    return colors[id % colors.length]
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-BO', { style: 'currency', currency: 'BOB', minimumFractionDigits: 0 }).format(value)
  }

  navigate(route: string): void {
    this.router.navigate([route])
  }

  navigateWithPatient(patientId: number, route: string): void {
    this.router.navigate([route], { queryParams: { patientId } })
  }

  private buildGreeting(): string {
    const h = new Date().getHours()
    if (h < 12) return 'Buenos días'
    if (h < 19) return 'Buenas tardes'
    return 'Buenas noches'
  }
}
