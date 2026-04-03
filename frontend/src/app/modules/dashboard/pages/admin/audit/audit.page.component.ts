import { Component, DestroyRef, OnInit, inject } from '@angular/core'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { FormControl, FormGroup } from '@angular/forms'
import { PageEvent } from '@angular/material/paginator'
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs'
import { AuditService } from './audit.service'
import {
  AuditDistinctValues,
  AuditFilters,
  AuditLog,
  AuditStats,
} from './interfaces/audit-log.interface'

@Component({
  selector: 'app-audit-page',
  templateUrl: './audit.page.component.html',
  styleUrls: ['./audit.page.component.css'],
})
export class AuditPageComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef)
  private readonly searchSubject = new Subject<string>()

  logs: AuditLog[] = []
  stats: AuditStats | null = null
  distinctValues: AuditDistinctValues = { resources: [], actions: [] }

  total = 0
  page = 1
  pageSize = 50
  loading = false
  statsLoading = false
  expandedLogId: string | null = null

  displayedColumns = [
    'createdAt',
    'userEmail',
    'action',
    'resource',
    'method',
    'statusCode',
    'status',
    'ipAddress',
    'expand',
  ]

  filterForm = new FormGroup({
    search: new FormControl(''),
    action: new FormControl(''),
    resource: new FormControl(''),
    status: new FormControl(''),
    startDate: new FormControl(''),
    endDate: new FormControl(''),
  })

  readonly actionOptions = [
    { value: 'LOGIN', label: 'Inicio de sesión' },
    { value: 'LOGOUT', label: 'Cierre de sesión' },
    { value: 'REFRESH', label: 'Renovar token' },
    { value: 'CREATE', label: 'Crear' },
    { value: 'UPDATE', label: 'Actualizar' },
    { value: 'DELETE', label: 'Eliminar' },
    { value: 'VIEW', label: 'Consultar' },
  ]

  readonly statusOptions = [
    { value: 'success', label: 'Exitoso' },
    { value: 'failure', label: 'Fallido' },
  ]

  constructor(private readonly auditService: AuditService) {}

  ngOnInit(): void {
    this.loadStats()
    this.loadLogs()
    this.loadFilters()

    this.searchSubject
      .pipe(debounceTime(400), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.page = 1
        this.loadLogs()
      })
  }

  loadLogs(): void {
    this.loading = true
    this.auditService
      .findAll(this.buildFilters())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: response => {
          this.logs = response.items
          this.total = response.total
          this.loading = false
        },
        error: () => {
          this.loading = false
        },
      })
  }

  loadStats(): void {
    this.statsLoading = true
    this.auditService
      .getStats()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: stats => {
          this.stats = stats
          this.statsLoading = false
        },
        error: () => {
          this.statsLoading = false
        },
      })
  }

  loadFilters(): void {
    this.auditService
      .getDistinctValues()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: values => (this.distinctValues = values) })
  }

  onSearch(value: string): void {
    this.searchSubject.next(value)
  }

  onFilterChange(): void {
    this.page = 1
    this.loadLogs()
  }

  onPageChange(event: PageEvent): void {
    this.page = event.pageIndex + 1
    this.pageSize = event.pageSize
    this.loadLogs()
  }

  resetFilters(): void {
    this.filterForm.reset({ search: '', action: '', resource: '', status: '', startDate: '', endDate: '' })
    this.page = 1
    this.loadLogs()
  }

  toggleExpand(id: string): void {
    this.expandedLogId = this.expandedLogId === id ? null : id
  }

  exportCsv(): void {
    const filters = { ...this.buildFilters(), page: 1, pageSize: 5000 }
    this.auditService
      .findAll(filters)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: response => this.downloadCsv(response.items) })
  }

  private buildFilters(): AuditFilters {
    const v = this.filterForm.value
    const filters: AuditFilters = { page: this.page, pageSize: this.pageSize }
    if (v.search) filters.search = v.search
    if (v.action) filters.action = v.action
    if (v.resource) filters.resource = v.resource
    if (v.status) filters.status = v.status
    if (v.startDate) filters.startDate = new Date(v.startDate).toISOString().split('T')[0]
    if (v.endDate) filters.endDate = new Date(v.endDate).toISOString().split('T')[0]
    return filters
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

  // ─── helpers de template ────────────────────────────────────────────────────

  getActionClass(action: string): string {
    const map: Record<string, string> = {
      LOGIN: 'bg-blue-100 text-blue-700',
      LOGOUT: 'bg-slate-100 text-slate-600',
      REFRESH: 'bg-slate-100 text-slate-400',
      CREATE: 'bg-green-100 text-green-700',
      UPDATE: 'bg-amber-100 text-amber-700',
      DELETE: 'bg-red-100 text-red-700',
      VIEW: 'bg-purple-100 text-purple-700',
    }
    return map[action] ?? 'bg-slate-100 text-slate-600'
  }

  getActionIcon(action: string): string {
    const map: Record<string, string> = {
      LOGIN: 'login',
      LOGOUT: 'logout',
      REFRESH: 'refresh',
      CREATE: 'add_circle',
      UPDATE: 'edit',
      DELETE: 'delete',
      VIEW: 'visibility',
    }
    return map[action] ?? 'radio_button_unchecked'
  }

  getStatusClass(status: string): string {
    return status === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
  }

  getMethodClass(method: string): string {
    const map: Record<string, string> = {
      POST: 'text-green-600',
      PATCH: 'text-amber-600',
      PUT: 'text-amber-600',
      DELETE: 'text-red-600',
      GET: 'text-blue-600',
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
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  hasExpandableContent(log: AuditLog): boolean {
    return !!(log.details || log.resourceId || log.path)
  }
}
