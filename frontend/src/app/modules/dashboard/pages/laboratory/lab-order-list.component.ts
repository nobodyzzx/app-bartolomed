import { Component, DestroyRef, inject, OnInit } from '@angular/core'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { ActivatedRoute, Router } from '@angular/router'
import { AlertService } from '@core/services/alert.service'
import { RoleStateService } from '@core/services/role-state.service'
import { UserRoles } from '@core/enums/user-roles.enum'
import { LabOrder } from './interfaces/lab-order-ui.interface'
import { LaboratoryService } from './laboratory.service'

const STATUS_MAP: Record<string, { label: string; classes: string }> = {
  requested:        { label: 'Solicitada',        classes: 'bg-slate-100 text-slate-700' },
  sample_collected: { label: 'Muestra Tomada',     classes: 'bg-amber-100 text-amber-700' },
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

  orders: LabOrder[] = []
  loading = false
  searchTerm = ''
  selectedStatus = ''

  patientIdFilter: string | null = null
  patientNameFilter: string | null = null

  constructor(
    private labService: LaboratoryService,
    private router: Router,
    private route: ActivatedRoute,
    private alert: AlertService,
  ) {}

  ngOnInit(): void {
    this.patientIdFilter = this.route.snapshot.queryParamMap.get('patientId')
    this.loadOrders()
  }

  /** Solo DOCTOR/ADMIN/SUPER_ADMIN pueden solicitar órdenes de laboratorio. */
  canOrder(): boolean {
    const roles = this.roleState.currentUserRoles()
    return roles.includes(UserRoles.DOCTOR) || roles.includes(UserRoles.ADMIN) || roles.includes(UserRoles.SUPER_ADMIN)
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
        this.alert.fire({ icon: 'error', title: 'Error', text: 'No se pudieron cargar las órdenes de laboratorio' })
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
    this.router.navigate(['/dashboard/laboratory/new'])
  }

  viewOrder(order: LabOrder): void {
    this.router.navigate(['/dashboard/laboratory', order.id])
  }

  goBack(): void {
    this.router.navigate(['/dashboard'])
  }

  getStatusBadgeClass(status: string): string {
    return STATUS_MAP[status]?.classes ?? 'bg-slate-100 text-slate-700'
  }

  getStatusLabel(status: string): string {
    return STATUS_MAP[status]?.label ?? status
  }

  getCountByStatus(status: string): number {
    return this.orders.filter(o => o.status === status).length
  }

  getPendingCount(): number {
    return this.orders.filter(o => o.status === 'requested' || o.status === 'sample_collected' || o.status === 'in_progress').length
  }

  getPatientInitials(o: LabOrder): string {
    return ((o.patient?.firstName?.charAt(0) ?? '') + (o.patient?.lastName?.charAt(0) ?? '')).toUpperCase() || '?'
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
