import { Component, DestroyRef, inject, OnInit } from '@angular/core'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { ActivatedRoute, Router } from '@angular/router'
import { UserRoles } from '@core/enums/user-roles.enum'
import { RoleStateService } from '@core/services/role-state.service'
import { StatCardColor } from '@shared/components/stat-card/stat-card.component'
import { ChartData, ChartOptions } from 'chart.js'
import { forkJoin, of } from 'rxjs'
import { AuthService } from '../../../auth/services/auth.service'
import { ClinicContextService } from '../../../clinics/services/clinic-context.service'
import { DashboardService } from './dashboard.service'
import { DashboardStats, RecentAppointment, RecentPatient, StockAlert } from './interfaces/dashboard-ui.interfaces'

interface StatCardDef {
  label: string
  sublabel: string
  icon: string
  color: StatCardColor
  route: string
  value: string | number
  roles: string[]
}

interface QuickActionDef {
  label: string
  icon: string
  route: string
  color: string
  roles: string[]
}

const ALL_ROLES: string[] = Object.values(UserRoles)
const CLINICAL:   string[] = [UserRoles.DOCTOR, UserRoles.NURSE, UserRoles.RECEPTIONIST, UserRoles.ADMIN, UserRoles.SUPER_ADMIN]
const ADMIN_ONLY: string[] = [UserRoles.ADMIN, UserRoles.SUPER_ADMIN]
const PHARMACY:   string[] = [UserRoles.PHARMACIST, UserRoles.ADMIN, UserRoles.SUPER_ADMIN]

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
    monthlyRevenue: 0,
    pendingAppointments: 0,
    lowStockItems: 0,
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

  // ── Rol del usuario autenticado ──────────────────────────────────────────

  /** Rol de mayor jerarquía del usuario actual (usa RoleStateService — fuente de verdad de UI) */
  get userRole(): string {
    const roles = this.roleState.currentUserRoles()
    const priority: UserRoles[] = [
      UserRoles.SUPER_ADMIN, UserRoles.ADMIN, UserRoles.DOCTOR,
      UserRoles.PHARMACIST,  UserRoles.NURSE, UserRoles.RECEPTIONIST,
    ]
    return priority.find(r => roles.includes(r)) ?? 'user'
  }

  get userName(): string {
    const u = this.authService.currentUser()
    if (!u) return 'Bartolomé'
    return u.personalInfo.firstName ?? u.email.split('@')[0] ?? 'Bartolomé'
  }

  // ── KPI Cards filtrados por rol ──────────────────────────────────────────

  get visibleStatCards(): StatCardDef[] {
    const cards: StatCardDef[] = [
      {
        label: 'Total Pacientes', sublabel: 'Registrados',
        icon: 'people', color: 'blue', route: '/dashboard/patients',
        value: this.stats.totalPatients,
        roles: CLINICAL,
      },
      {
        label: 'Citas Hoy', sublabel: 'Programadas',
        icon: 'calendar_today', color: 'green', route: '/dashboard/appointments',
        value: this.stats.totalAppointments,
        roles: CLINICAL,
      },
      {
        label: 'Por Confirmar', sublabel: 'Citas pendientes',
        icon: 'pending_actions', color: 'amber', route: '/dashboard/appointments',
        value: this.stats.pendingAppointments,
        roles: CLINICAL,
      },
      {
        label: 'Doctores', sublabel: 'Personal activo',
        icon: 'medical_services', color: 'purple', route: '/dashboard/users',
        value: this.stats.totalDoctors,
        roles: ADMIN_ONLY,
      },
      {
        label: 'Stock Bajo', sublabel: 'Medicamentos',
        icon: 'inventory_2', color: 'red', route: '/dashboard/pharmacy/inventory',
        value: this.stats.lowStockItems,
        roles: PHARMACY,
      },
      {
        label: 'Ingresos Mes', sublabel: 'Facturación',
        icon: 'attach_money', color: 'orange', route: '/dashboard/reports/financial-reports',
        value: this.formatCurrency(this.stats.monthlyRevenue),
        roles: PHARMACY,
      },
    ]
    return cards.filter(c => c.roles.includes(this.userRole))
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
        roles: [...CLINICAL],
      },
      {
        label: 'Nueva Venta', icon: 'point_of_sale',
        route: '/dashboard/pharmacy/sales-dispensing/new',
        color: 'bg-purple-50 text-purple-600 hover:bg-purple-100 border-purple-100',
        roles: PHARMACY,
      },
      {
        label: 'Expediente Médico', icon: 'note_add',
        route: '/dashboard/medical-records/new',
        color: 'bg-teal-50 text-teal-600 hover:bg-teal-100 border-teal-100',
        roles: [UserRoles.ADMIN, UserRoles.SUPER_ADMIN, UserRoles.DOCTOR, UserRoles.NURSE],
      },
      {
        label: 'Nueva Receta', icon: 'receipt_long',
        route: '/dashboard/prescriptions/new',
        color: 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border-indigo-100',
        roles: [UserRoles.ADMIN, UserRoles.SUPER_ADMIN, UserRoles.DOCTOR, UserRoles.PHARMACIST],
      },
      {
        label: 'Nueva Factura', icon: 'request_quote',
        route: '/dashboard/billing/invoices/new',
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
        roles: PHARMACY,
      },
    ]
    return actions.filter(a => a.roles.includes(this.userRole))
  }

  // ── Visibilidad de secciones por rol ─────────────────────────────────────

  get showAppointmentsSection(): boolean {
    return CLINICAL.includes(this.userRole)
  }

  get showStockSection(): boolean {
    return PHARMACY.includes(this.userRole)
  }

  get showPatientsSection(): boolean {
    return CLINICAL.includes(this.userRole)
  }

  get showSalesCharts(): boolean {
    return PHARMACY.includes(this.userRole)
  }

  get showAppointmentChart(): boolean {
    return CLINICAL.includes(this.userRole)
  }

  // ── Alertas críticas (solo si el rol las ve) ─────────────────────────────

  get hasCriticalAlerts(): boolean {
    const stockAlert = this.showStockSection && this.stats.lowStockItems > 0
    const apptAlert  = this.showAppointmentsSection && this.stats.pendingAppointments > 0
    return stockAlert || apptAlert
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private dashboardService: DashboardService,
  ) {}

  ngOnInit(): void {
    this.route.queryParams.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      if (params['error'] === 'insufficient_permissions') {
        const required = params['required']?.split(',') || []
        this.permissionError = `No tienes permisos para acceder a ese módulo. Requeridos: ${required.join(', ')}`
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
    const needsStock    = this.showStockSection

    forkJoin({
      patientStats: needsClinical ? this.dashboardService.getPatientStats()            : of({ total: 0 }),
      appointments: needsClinical ? this.dashboardService.getTodayAppointments()        : of([] as RecentAppointment[]),
      pending:      needsClinical ? this.dashboardService.getPendingAppointmentsCount() : of(0),
      stock:        needsStock    ? this.dashboardService.getLowStockAlerts()           : of([] as StockAlert[]),
      patients:     needsClinical ? this.dashboardService.getRecentPatients()           : of([] as RecentPatient[]),
    }).pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ patientStats, appointments, pending, stock, patients }) => {
          this.stats = {
            totalPatients:       patientStats.total,
            totalAppointments:   appointments.length,
            pendingAppointments: pending,
            totalDoctors:        0,
            monthlyRevenue:      0,
            lowStockItems:       stock.length,
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
