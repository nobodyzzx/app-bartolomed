import { Component, DestroyRef, inject, OnInit } from '@angular/core'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { FormControl, FormGroup } from '@angular/forms'
import { ActivatedRoute, Router } from '@angular/router'
import { AlertService } from '@core/services/alert.service'
import { RoleStateService } from '@core/services/role-state.service'
import { UserRoles } from '@core/enums/user-roles.enum'
import { LabOrder, LabOrderItem } from './interfaces/lab-order-ui.interface'
import { LaboratoryService } from './laboratory.service'

const STATUS_LABELS: Record<string, string> = {
  requested: 'Solicitada',
  sample_collected: 'Muestra Tomada',
  in_progress: 'En Proceso',
  completed: 'Completada',
  cancelled: 'Cancelada',
}

const NEXT_STATUS: Record<string, { status: string; label: string; icon: string }[]> = {
  requested: [
    { status: 'sample_collected', label: 'Marcar muestra tomada', icon: 'colorize' },
    { status: 'cancelled', label: 'Cancelar orden', icon: 'cancel' },
  ],
  sample_collected: [
    { status: 'in_progress', label: 'Marcar en proceso', icon: 'science' },
    { status: 'cancelled', label: 'Cancelar orden', icon: 'cancel' },
  ],
  in_progress: [
    { status: 'completed', label: 'Marcar completada', icon: 'done_all' },
    { status: 'cancelled', label: 'Cancelar orden', icon: 'cancel' },
  ],
  completed: [],
  cancelled: [],
}

@Component({
    selector: 'app-lab-order-detail',
    templateUrl: './lab-order-detail.component.html',
    standalone: false
})
export class LabOrderDetailComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef)
  private readonly roleState = inject(RoleStateService)

  loading = false
  order: LabOrder | undefined
  resultForms: Record<string, FormGroup> = {}
  editingItemId: string | null = null

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private svc: LaboratoryService,
    private alert: AlertService,
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id')!
    this.fetch(id)
  }

  fetch(id: string) {
    this.loading = true
    this.svc.get(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (o: any) => {
        this.loading = false
        this.order = o
        this.editingItemId = null
      },
      error: () => (this.loading = false),
    })
  }

  goBack() {
    this.router.navigate(['/dashboard/laboratory'])
  }

  getStatusBadgeClass(status: string): string {
    const classes: Record<string, string> = {
      requested: 'bg-slate-100 text-slate-700',
      sample_collected: 'bg-amber-100 text-amber-700',
      in_progress: 'bg-blue-100 text-blue-700',
      completed: 'bg-emerald-100 text-emerald-700',
      cancelled: 'bg-red-100 text-red-700',
    }
    return classes[status] || 'bg-slate-100 text-slate-700'
  }

  getStatusLabel(status: string): string {
    return STATUS_LABELS[status] || status
  }

  /** DOCTOR/ADMIN/LABORATORY pueden mover el estado — mismo set de roles que el backend en PATCH :id/status. */
  canManageStatus(): boolean {
    const roles = this.roleState.currentUserRoles()
    return roles.includes(UserRoles.DOCTOR) || roles.includes(UserRoles.ADMIN) ||
      roles.includes(UserRoles.SUPER_ADMIN) || roles.includes(UserRoles.LABORATORY)
  }

  getNextStatusOptions() {
    if (!this.order) return []
    return NEXT_STATUS[this.order.status] || []
  }

  changeStatus(status: string) {
    if (!this.order) return
    this.alert
      .fire({
        icon: 'question',
        title: '¿Confirmar cambio de estado?',
        text: `La orden pasará a estado "${this.getStatusLabel(status)}".`,
        showCancelButton: true,
        confirmButtonText: 'Confirmar',
        cancelButtonText: 'Cancelar',
      })
      .then(res => {
        if (res.isConfirmed) {
          this.svc.setStatus(this.order!.id, status).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: () => this.fetch(this.order!.id),
          })
        }
      })
  }

  /** Solo LABORATORY/ADMIN/SUPER_ADMIN cargan resultados — mismo set que backend en RequirePermissions(LabResultEnter). */
  canEnterResult(): boolean {
    const roles = this.roleState.currentUserRoles()
    return roles.includes(UserRoles.LABORATORY) || roles.includes(UserRoles.ADMIN) || roles.includes(UserRoles.SUPER_ADMIN)
  }

  startEnterResult(item: LabOrderItem) {
    this.resultForms[item.id] = new FormGroup({
      resultValue: new FormControl(item.resultValue || ''),
      resultUnit: new FormControl(item.resultUnit || ''),
      referenceRange: new FormControl(item.referenceRange || ''),
      isAbnormal: new FormControl(item.isAbnormal || false),
      resultNotes: new FormControl(item.resultNotes || ''),
    })
    this.editingItemId = item.id
  }

  cancelEnterResult() {
    this.editingItemId = null
  }

  saveResult(itemId: string) {
    const form = this.resultForms[itemId]
    if (!form || !this.order) return
    this.svc.enterResult(this.order.id, itemId, form.value).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => this.fetch(this.order!.id),
    })
  }

  categoryLabel(category: string): string {
    const labels: Record<string, string> = { blood: 'Sangre', imaging: 'Imagenología', other: 'Otro' }
    return labels[category] || category
  }

  categoryIcon(category: string): string {
    const icons: Record<string, string> = { blood: 'water_drop', imaging: 'camera_alt', other: 'science' }
    return icons[category] || 'science'
  }
}
