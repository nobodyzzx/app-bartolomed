import { Component, DestroyRef, inject, OnInit } from '@angular/core'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { FormControl, FormGroup } from '@angular/forms'
import { ActivatedRoute, Router } from '@angular/router'
import { AlertService } from '@core/services/alert.service'
import { RoleStateService } from '@core/services/role-state.service'
import { LAB_MODULE_CONFIG } from './lab-module.config'
import { LabOrder, LabOrderItem } from './interfaces/lab-order-ui.interface'
import { LabOrdersService } from './lab-orders.service'
import { labCategoryLabel } from '../service-prices/service-prices.service'

const STATUS_LABELS: Record<string, string> = {
  requested: 'Solicitada',
  sample_collected: 'Muestra Tomada',
  sent_to_provider: 'Enviada al Laboratorio',
  in_progress: 'En Proceso',
  completed: 'Completada',
  cancelled: 'Cancelada',
}

interface StatusAction {
  status: string
  label: string
  icon: string
}

@Component({
    selector: 'app-lab-order-detail',
    templateUrl: './lab-order-detail.component.html',
    standalone: false
})
export class LabOrderDetailComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef)
  private readonly roleState = inject(RoleStateService)
  readonly config = inject(LAB_MODULE_CONFIG)
  readonly texts = this.config.texts

  loading = false
  printing = false
  order: LabOrder | undefined
  resultForms: Record<string, FormGroup> = {}
  editingItemId: string | null = null

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private svc: LabOrdersService,
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

  /** Nombre completo del médico; el email solo si no hay ficha personal. */
  doctorName(order: any): string {
    // En una solicitud externa no hay médico de la casa: el solicitante es el
    // texto que registró quien la recibió en el mesón.
    if (order?.origin === 'external') {
      return order?.referringDoctorName?.trim() || 'Particular, sin orden médica'
    }
    const info = order?.doctor?.personalInfo
    const name = `${info?.firstName ?? ''} ${info?.lastName ?? ''}`.trim()
    return name || order?.doctor?.email || '—'
  }

  /** El paciente derivado no tiene ficha: se guarda solo su nombre. */
  patientName(order: any): string {
    if (order?.patient) return `${order.patient.firstName} ${order.patient.lastName}`.trim()
    return order?.patientName?.trim() || '—'
  }

  isExternal(order: any): boolean {
    return order?.origin === 'external'
  }

  goBack() {
    this.router.navigate([this.config.routeBase])
  }

  getStatusBadgeClass(status: string): string {
    const classes: Record<string, string> = {
      requested: 'bg-slate-100 text-slate-700',
      sample_collected: 'bg-amber-100 text-amber-700',
      sent_to_provider: 'bg-violet-100 text-violet-700',
      in_progress: 'bg-blue-100 text-blue-700',
      completed: 'bg-emerald-100 text-emerald-700',
      cancelled: 'bg-red-100 text-red-700',
    }
    return classes[status] || 'bg-slate-100 text-slate-700'
  }

  getStatusLabel(status: string): string {
    if (status === 'sent_to_provider') return this.texts.sentToProviderStatus
    return STATUS_LABELS[status] || status
  }

  /** Mismo set de roles que el backend en `PATCH :id/status`. */
  canManageStatus(): boolean {
    return this.roleState.hasAnyRole(this.config.statusRoles)
  }

  /**
   * Qué se puede hacer a continuación, calculado y no leído de una tabla fija:
   * los dos módulos no recorren el mismo camino.
   *
   * - **Sin muestra que tomar** (estudios especiales) se salta
   *   `sample_collected`: la orden va de *solicitada* a *en proceso*.
   * - **`sent_to_provider` solo si algo se deriva**; ofrecerlo en un estudio que
   *   hace la propia clínica sería un paso que nunca ocurre.
   */
  getNextStatusOptions(): StatusAction[] {
    if (!this.order) return []

    const cancelar: StatusAction = { status: 'cancelled', label: 'Cancelar orden', icon: 'cancel' }
    const derivar: StatusAction = {
      status: 'sent_to_provider',
      label: this.texts.sendToProviderLabel,
      icon: 'local_shipping',
    }
    const enProceso: StatusAction = { status: 'in_progress', label: 'Marcar en proceso', icon: 'science' }
    const completar: StatusAction = { status: 'completed', label: 'Marcar completada', icon: 'done_all' }

    let opciones: StatusAction[]
    switch (this.order.status) {
      case 'requested':
        opciones = this.config.hasSpecimen
          ? [{ status: 'sample_collected', label: 'Marcar muestra tomada', icon: 'colorize' }, cancelar]
          : [derivar, enProceso, cancelar]
        break
      case 'sample_collected':
        opciones = [derivar, enProceso, cancelar]
        break
      case 'sent_to_provider':
        opciones = [enProceso, cancelar]
        break
      case 'in_progress':
        opciones = [completar, cancelar]
        break
      default:
        opciones = []
    }

    if (this.isDerived()) return opciones
    return opciones.filter(o => o.status !== 'sent_to_provider')
  }

  /** ¿Algún estudio de la orden va a un centro externo? */
  isDerived(): boolean {
    return (this.order?.items ?? []).some((i: any) => !!i.providerName)
  }

  /** Nombre del centro al que se deriva, para mostrarlo en la orden. */
  providerName(): string {
    const conProveedor = (this.order?.items ?? []).find((i: any) => !!i.providerName)
    return (conProveedor as any)?.providerName ?? ''
  }

  /** ¿Algún estudio de la orden exige consentimiento informado? */
  requiresConsent(): boolean {
    return (this.order?.items ?? []).some((i: any) => !!i.requiresConsent)
  }

  /** Estudios de la orden que exigen consentimiento, por nombre. */
  consentStudies(): string {
    return (this.order?.items ?? [])
      .filter((i: any) => i.requiresConsent)
      .map((i: any) => i.testName)
      .join(', ')
  }

  /** Días de retraso sobre la fecha estimada; 0 o menos si aún está en plazo. */
  daysOverdue(): number {
    const esperada = (this.order as any)?.expectedResultDate
    if (!esperada || this.order?.status === 'completed' || this.order?.status === 'cancelled') return 0
    const limite = new Date(esperada)
    const hoy = new Date()
    // Ambas a medianoche UTC: `expectedResultDate` es una columna `date`, un
    // día del calendario, y compararla contra un instante daría un día de más.
    const dif = Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()) - limite.getTime()
    return Math.floor(dif / 86400000)
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

  hasAnyResult(): boolean {
    return (this.order?.items ?? []).some(i => !!i.resultedAt)
  }

  /**
   * Siempre hay algo que imprimir salvo que la orden esté cancelada.
   *
   * Antes se exigía al menos un resultado, y eso dejaba sin imprimir dos casos
   * reales: la solicitud que acompaña la muestra al laboratorio externo, y la
   * orden cerrada cuyo resultado se entregó en papel (el informe ya sabe
   * marcarse como parcial cuando faltan estudios).
   */
  canPrint(): boolean {
    return !!this.order && this.order.status !== 'cancelled'
  }

  /** Sin resultados el papel es la solicitud; con ellos, el informe. */
  printLabel(): string {
    return this.hasAnyResult() ? 'Imprimir resultados' : 'Imprimir solicitud'
  }

  printResults(): void {
    if (!this.order || this.printing) return
    this.printing = true
    this.svc
      .getResultsPdf(this.order.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: blob => {
          this.printing = false
          const url = URL.createObjectURL(blob)
          window.open(url, '_blank')
          setTimeout(() => URL.revokeObjectURL(url), 60000)
        },
        error: () => (this.printing = false),
      })
  }

  /** Mismo set de roles que el backend en `RequirePermissions(…ResultEnter)`. */
  canEnterResult(): boolean {
    return this.roleState.hasAnyRole(this.config.resultRoles)
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

  /**
   * Etiqueta que se muestra junto al estudio: la categoría clínica del
   * tarifario si la hay (Hematología, Química sanguínea…), que es como un
   * laboratorio agrupa su trabajo. El tipo de muestra va aparte.
   */
  itemCategoryLabel(item: any): string {
    return item?.labCategory ? labCategoryLabel(item.labCategory) : this.categoryLabel(item?.category)
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
