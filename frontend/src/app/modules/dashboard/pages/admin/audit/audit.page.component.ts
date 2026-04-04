import { Component, DestroyRef, OnInit, inject } from '@angular/core'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { FormBuilder, FormGroup } from '@angular/forms'
import { PageEvent } from '@angular/material/paginator'
import { ChartData, ChartOptions } from 'chart.js'
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs'
import { AuditService } from './audit.service'
import {
  AuditDistinctValues,
  AuditFilters,
  AuditLog,
  AuditStats,
  DailyActivity,
} from './interfaces/audit-log.interface'

@Component({
  selector: 'app-audit-page',
  templateUrl: './audit.page.component.html',
  styleUrls: ['./audit.page.component.css'],
})
export class AuditPageComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef)
  private readonly searchSubject = new Subject<string>()
  private refreshTimer: ReturnType<typeof setInterval> | null = null

  logs: AuditLog[] = []
  stats: AuditStats | null = null
  distinctValues: AuditDistinctValues = { resources: [], actions: [] }
  dailyActivity: DailyActivity[] = []

  total = 0
  page = 1
  pageSize = 50
  loading = false
  statsLoading = false
  activityLoading = false
  expandedLogId: string | null = null
  autoRefresh = false
  showFilters = true

  activityChart: ChartData<'bar'> | null = null

  readonly barOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } },
      tooltip: { callbacks: { title: (items) => `Día: ${items[0].label}` } },
    },
    scales: {
      x: { ticks: { font: { size: 10 } }, grid: { display: false } },
      y: { beginAtZero: true, ticks: { font: { size: 10 }, stepSize: 1 } },
    },
  }

  displayedColumns = [
    'createdAt', 'userEmail', 'action', 'resource',
    'method', 'statusCode', 'status', 'ipAddress', 'expand',
  ]

  filterForm!: FormGroup

  readonly actionOptions = [
    { value: 'LOGIN',   label: 'Inicio de sesión' },
    { value: 'LOGOUT',  label: 'Cierre de sesión' },
    { value: 'REFRESH', label: 'Renovar token' },
    { value: 'CREATE',  label: 'Crear' },
    { value: 'UPDATE',  label: 'Actualizar' },
    { value: 'DELETE',  label: 'Eliminar' },
    { value: 'VIEW',    label: 'Consultar' },
  ]

  readonly statusOptions = [
    { value: 'success', label: 'Exitoso' },
    { value: 'failure', label: 'Fallido' },
  ]

  readonly quickFilters = [
    { label: 'Hoy',          days: 1  },
    { label: 'Ayer',         days: -1 },
    { label: 'Últimos 7 días', days: 7 },
    { label: 'Este mes',     days: 30 },
  ]

  constructor(private readonly auditService: AuditService, private readonly fb: FormBuilder) {
    this.filterForm = this.fb.group({
      search:    [null],
      action:    [null],
      resource:  [null],
      status:    [null],
      startDate: [null],
      endDate:   [null],
    })
    this.destroyRef.onDestroy(() => {
      if (this.refreshTimer) clearInterval(this.refreshTimer)
    })
  }

  ngOnInit(): void {
    // Rango por defecto: últimos 7 días
    this.applyQuickFilter(7)

    // Búsqueda con debounce
    this.searchSubject
      .pipe(debounceTime(400), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => { this.page = 1; this.loadLogs() })

    // Dropdowns y fechas: recargar al cambiar cualquier valor
    ;['action', 'resource', 'status', 'startDate', 'endDate'].forEach(field => {
      this.filterForm.get(field)!.valueChanges
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => { this.page = 1; this.loadAll() })
    })

    this.auditService
      .getDistinctValues()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: v => (this.distinctValues = v) })
  }

  // ─── Carga de datos ────────────────────────────────────────────────────────

  loadAll(): void {
    this.loadLogs()
    this.loadStats()
    this.loadActivity()
  }

  loadLogs(): void {
    this.loading = true
    this.auditService.findAll(this.buildFilters())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: r => { this.logs = r.items; this.total = r.total; this.loading = false },
        error: () => { this.loading = false },
      })
  }

  loadStats(): void {
    this.statsLoading = true
    const { startDate, endDate } = this.filterForm.value
    this.auditService.getStats(this.toIso(startDate), this.toIso(endDate))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: s => { this.stats = s; this.statsLoading = false },
        error: () => { this.statsLoading = false },
      })
  }

  loadActivity(): void {
    this.activityLoading = true
    const { startDate, endDate } = this.filterForm.value
    this.auditService.getDailyActivity(this.toIso(startDate), this.toIso(endDate))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: data => { this.dailyActivity = data; this.buildChart(data); this.activityLoading = false },
        error: () => { this.activityLoading = false },
      })
  }

  private buildChart(data: DailyActivity[]): void {
    if (!data.length) { this.activityChart = null; return }
    this.activityChart = {
      labels: data.map(d =>
        new Date(d.date + 'T12:00:00').toLocaleDateString('es-BO', { day: '2-digit', month: 'short' })
      ),
      datasets: [
        {
          label: 'Total eventos',
          data: data.map(d => d.total),
          backgroundColor: '#3b82f6',
          borderRadius: 5,
        },
        {
          label: 'Errores',
          data: data.map(d => d.errors),
          backgroundColor: '#ef4444',
          borderRadius: 5,
        },
      ],
    }
  }

  // ─── Filtros y navegación ──────────────────────────────────────────────────

  applyQuickFilter(days: number): void {
    const end = new Date()
    end.setHours(23, 59, 59, 999)
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    if (days === -1) {
      start.setDate(start.getDate() - 1)
      end.setDate(end.getDate() - 1)
    } else {
      start.setDate(start.getDate() - (days - 1))
    }
    // patchValue sin emitir para evitar doble carga — loadAll() explícito abajo
    this.filterForm.patchValue({ startDate: start, endDate: end }, { emitEvent: false })
    this.page = 1
    this.loadAll()
  }

  onSearch(value: string): void {
    this.searchSubject.next(value)
  }

  onPageChange(event: PageEvent): void {
    this.page = event.pageIndex + 1
    this.pageSize = event.pageSize
    this.loadLogs()
  }

  resetFilters(): void {
    this.filterForm.reset(
      { search: null, action: null, resource: null, status: null, startDate: null, endDate: null },
      { emitEvent: false },
    )
    this.page = 1
    this.loadAll()
  }

  filterByUser(email: string | undefined): void {
    if (!email) return
    this.filterForm.patchValue({ search: email })
    this.page = 1
    this.loadLogs()
  }

  toggleExpand(id: string): void {
    this.expandedLogId = this.expandedLogId === id ? null : id
  }

  toggleAutoRefresh(): void {
    this.autoRefresh = !this.autoRefresh
    if (this.autoRefresh) {
      this.refreshTimer = setInterval(() => this.loadAll(), 30000)
    } else {
      if (this.refreshTimer) { clearInterval(this.refreshTimer); this.refreshTimer = null }
    }
  }

  manualRefresh(): void {
    this.loadAll()
  }

  // ─── Exportar CSV ──────────────────────────────────────────────────────────

  exportCsv(): void {
    const filters = { ...this.buildFilters(), page: 1, pageSize: 5000 }
    this.auditService.findAll(filters)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: r => this.downloadCsv(r.items) })
  }

  private buildFilters(): AuditFilters {
    const v = this.filterForm.value
    const filters: AuditFilters = { page: this.page, pageSize: this.pageSize }
    if (v.search)    filters.search    = v.search
    if (v.action)    filters.action    = v.action
    if (v.resource)  filters.resource  = v.resource
    if (v.status)    filters.status    = v.status
    const sd = this.toIso(v.startDate); if (sd) filters.startDate = sd
    const ed = this.toIso(v.endDate);   if (ed) filters.endDate   = ed
    return filters
  }

  private toIso(date: Date | string | null | undefined): string | undefined {
    if (!date) return undefined
    const d = date instanceof Date ? date : new Date(date)
    if (isNaN(d.getTime())) return undefined
    return d.toISOString().split('T')[0]
  }

  private downloadCsv(items: AuditLog[]): void {
    const headers = ['Fecha', 'Usuario', 'Nombre', 'Acción', 'Recurso', 'Método', 'HTTP', 'Estado', 'IP', 'Ruta']
    const rows = items.map(l => [
      new Date(l.createdAt).toLocaleString('es-BO'),
      l.userEmail ?? '',
      l.userName ?? '',
      l.action,
      l.resource,
      l.method,
      l.statusCode.toString(),
      l.status,
      l.ipAddress ?? '',
      l.path,
    ])
    const csv = [headers, ...rows]
      .map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `auditoria_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ─── Computed ─────────────────────────────────────────────────────────────

  get securityAlert(): boolean {
    if (!this.stats) return false
    return this.stats.errorsToday > 10 || this.stats.failedLogins > 3
  }

  get rangeLabel(): string {
    const { startDate, endDate } = this.filterForm.value
    const fmt = (d: Date | null | undefined) =>
      d ? d.toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' }) : ''
    if (!startDate && !endDate) return 'en total'
    if (startDate && endDate) return `del ${fmt(startDate)} al ${fmt(endDate)}`
    if (startDate) return `desde ${fmt(startDate)}`
    return `hasta ${fmt(endDate)}`
  }

  // ─── Helpers de template ───────────────────────────────────────────────────

  getActionClass(action: string): string {
    const map: Record<string, string> = {
      LOGIN:   'bg-blue-100 text-blue-700',
      LOGOUT:  'bg-slate-100 text-slate-600',
      REFRESH: 'bg-slate-100 text-slate-400',
      CREATE:  'bg-green-100 text-green-700',
      UPDATE:  'bg-amber-100 text-amber-700',
      DELETE:  'bg-red-100 text-red-700',
      VIEW:    'bg-purple-100 text-purple-700',
    }
    return map[action] ?? 'bg-slate-100 text-slate-600'
  }

  getActionIcon(action: string): string {
    const map: Record<string, string> = {
      LOGIN:   'login',
      LOGOUT:  'logout',
      REFRESH: 'refresh',
      CREATE:  'add_circle',
      UPDATE:  'edit',
      DELETE:  'delete',
      VIEW:    'visibility',
    }
    return map[action] ?? 'radio_button_unchecked'
  }

  getStatusClass(status: string): string {
    return status === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
  }

  getMethodClass(method: string): string {
    const map: Record<string, string> = {
      POST:   'text-green-600',
      PATCH:  'text-amber-600',
      PUT:    'text-amber-600',
      DELETE: 'text-red-600',
      GET:    'text-blue-600',
    }
    return map[method] ?? 'text-slate-600'
  }

  getHttpCodeClass(code: number): string {
    if (code < 300) return 'text-green-600'
    if (code < 400) return 'text-amber-500'
    return 'text-red-600'
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleString('es-BO', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    })
  }

  formatDetails(details: Record<string, unknown> | undefined): string {
    if (!details) return ''
    return JSON.stringify(details, null, 2)
  }

  hasExpandableContent(log: AuditLog): boolean {
    return !!(log.details || log.resourceId || log.path)
  }
}
