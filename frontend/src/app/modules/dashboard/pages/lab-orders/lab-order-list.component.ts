import { Sort } from '@angular/material/sort'
import { EstadoOrden, leerOrden, ordenar } from '../../../../shared/utils/table-sort.util'
import { Component, DestroyRef, inject, OnInit } from '@angular/core'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { ActivatedRoute, Router } from '@angular/router'
import { AlertService } from '@core/services/alert.service'
import { RoleStateService } from '@core/services/role-state.service'
import { LAB_MODULE_CONFIG } from './lab-module.config'
import { LabOrder } from './interfaces/lab-order-ui.interface'
import { LabOrdersService } from './lab-orders.service'

const STATUS_MAP: Record<string, { label: string; classes: string }> = {
  requested:        { label: 'Solicitada',        classes: 'bg-slate-100 text-slate-700' },
  sample_collected: { label: 'Muestra Tomada',     classes: 'bg-amber-100 text-amber-700' },
  sent_to_provider: { label: 'En el Laboratorio',   classes: 'bg-violet-100 text-violet-700' },
  in_progress:      { label: 'En Proceso',         classes: 'bg-blue-100 text-blue-700' },
  completed:        { label: 'Completada',         classes: 'bg-emerald-100 text-emerald-700' },
  cancelled:        { label: 'Cancelada',          classes: 'bg-red-100 text-red-700' },
}

@Component({
    selector: 'app-lab-order-list',
    templateUrl: './lab-order-list.component.html',
    standalone: false
})
export class LabOrderListComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef)
  private readonly roleState = inject(RoleStateService)
  readonly config = inject(LAB_MODULE_CONFIG)
  readonly texts = this.config.texts

  orders: LabOrder[] = []

  /** Columna elegida en la cabecera. Vacío = como vino del servidor. */
  orden: EstadoOrden = { key: '', dir: '' }

  onSort(sort: Sort): void {
    this.orden = leerOrden(sort)
  }

  get ordenadas(): LabOrder[] {
    return ordenar(this.orders, this.orden, (o, key) => {
      switch (key) {
        case 'numero': return o.orderNumber
        case 'paciente': return this.patientLabel(o)
        case 'medico': return this.requesterLabel(o)
        // Por cuántos estudios lleva la orden: es lo que se compara de un
        // vistazo entre una orden de uno y una de doce.
        case 'estudios': return o.items?.length ?? 0
        case 'resultados': return this.resultCount(o)
        // La etiqueta y no el valor del enum: la columna dice "En proceso".
        case 'estado': return this.getStatusLabel(o.status)
        default: return null
      }
    })
  }
  loading = false
  searchTerm = ''
  selectedStatus = ''

  patientIdFilter: string | null = null
  patientNameFilter: string | null = null

  constructor(
    private labService: LabOrdersService,
    private router: Router,
    private route: ActivatedRoute,
    private alert: AlertService,
  ) {}

  ngOnInit(): void {
    this.patientIdFilter = this.route.snapshot.queryParamMap.get('patientId')
    this.loadOrders()
  }

  /** Solo los roles que el backend acepta en el POST pueden emitir órdenes. */
  canOrder(): boolean {
    return this.roleState.hasAnyRole(this.config.orderRoles)
  }

  loadOrders(): void {
    this.loading = true
    const filter: any = {}
    if (this.selectedStatus) filter.status = this.selectedStatus
    if (this.searchTerm?.trim()) filter.search = this.searchTerm.trim()
    if (this.patientIdFilter) filter.patientId = this.patientIdFilter

    this.labService.list(1, 100, filter).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response: any) => {
        this.orders = response.items || []
        this.patientNameFilter = this.patientIdFilter && this.orders[0]
          ? `${this.orders[0].patient?.firstName ?? ''} ${this.orders[0].patient?.lastName ?? ''}`.trim()
          : null
        this.loading = false
      },
      error: () => {
        this.loading = false
        this.alert.fire({ icon: 'error', title: 'Error', text: `No se pudieron cargar las órdenes de ${this.texts.listTitle.toLowerCase()}` })
      },
    })
  }

  clearPatientFilter(): void {
    this.router.navigate([], { queryParams: {} })
    this.patientIdFilter = null
    this.patientNameFilter = null
    this.loadOrders()
  }

  onSearch(): void {
    this.loadOrders()
  }

  createOrder(): void {
    this.router.navigate([`${this.config.routeBase}/new`])
  }

  createExternalOrder(): void {
    this.router.navigate([`${this.config.routeBase}/new`], { queryParams: { external: 1 } })
  }

  viewOrder(order: LabOrder): void {
    this.router.navigate([this.config.routeBase, order.id])
  }

  goBack(): void {
    this.router.navigate(['/dashboard'])
  }

  getStatusBadgeClass(status: string): string {
    return STATUS_MAP[status]?.classes ?? 'bg-slate-100 text-slate-700'
  }

  getStatusLabel(status: string): string {
    // `sent_to_provider` no se llama igual en los dos módulos: la muestra va al
    // laboratorio externo, el paciente va derivado a otro centro.
    if (status === 'sent_to_provider') return this.texts.sentToProviderStatus
    return STATUS_MAP[status]?.label ?? status
  }

  getCountByStatus(status: string): number {
    return this.orders.filter(o => o.status === status).length
  }

  getPendingCount(): number {
    const abiertas = ['requested', 'sample_collected', 'sent_to_provider', 'in_progress']
    return this.orders.filter(o => abiertas.includes(o.status)).length
  }

  getPatientInitials(o: LabOrder): string {
    const fromFicha = (o.patient?.firstName?.charAt(0) ?? '') + (o.patient?.lastName?.charAt(0) ?? '')
    if (fromFicha.trim()) return fromFicha.toUpperCase()
    // Paciente derivado, sin ficha: las iniciales salen del nombre libre.
    const libre = (o as any).patientName?.trim() ?? ''
    const partes = libre.split(/\s+/).filter(Boolean)
    const iniciales = (partes[0]?.charAt(0) ?? '') + (partes[1]?.charAt(0) ?? '')
    return iniciales.toUpperCase() || '?'
  }

  /** Nombre del paciente, tenga ficha o no. */
  patientLabel(o: LabOrder): string {
    if (o.patient) return `${o.patient.firstName ?? ''} ${o.patient.lastName ?? ''}`.trim()
    return (o as any).patientName?.trim() || '—'
  }

  /** Quién indicó el examen: médico de la casa o solicitante externo. */
  requesterLabel(o: LabOrder): string {
    if ((o as any).origin === 'external') {
      return (o as any).referringDoctorName?.trim() || 'Particular'
    }
    const info = o.doctor?.personalInfo
    const name = `${info?.firstName ?? ''} ${info?.lastName ?? ''}`.trim()
    return name ? `Dr. ${name}` : (o.doctor?.email ?? '—')
  }

  isExternal(o: LabOrder): boolean {
    return (o as any).origin === 'external'
  }

  /** El servicio y recepción registran las solicitudes que llegan de fuera. */
  canOrderExternal(): boolean {
    return this.roleState.hasPermission(this.config.externalPermission)
  }

  setStatusFilter(status: string): void {
    this.selectedStatus = status
    this.loadOrders()
  }

  resultCount(o: LabOrder): string {
    const total = o.items?.length ?? 0
    const withResult = (o.items ?? []).filter(i => !!i.resultedAt).length
    return `${withResult}/${total}`
  }
}
