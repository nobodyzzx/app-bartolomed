import { Sort } from '@angular/material/sort'
import { ListStateService } from '../../../../shared/services/list-state.service'
import { EstadoOrden, leerOrden, ordenar } from '../../../../shared/utils/table-sort.util'
import { Component, DestroyRef, inject, OnInit } from '@angular/core'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { ActivatedRoute, Router } from '@angular/router'
import { AlertService } from '@core/services/alert.service'
import { RoleStateService } from '@core/services/role-state.service'
import { UserRoles } from '@core/enums/user-roles.enum'
import { Prescription } from './interfaces/prescription-ui.interface'
import { PrescriptionsService } from './prescriptions.service'
import { openPdfInNewTab } from '../../../../shared/utils/pdf-viewer.util'

const STATUS_MAP: Record<string, { label: string; classes: string }> = {
  draft:     { label: 'Borrador',    classes: 'bg-slate-100 text-slate-700' },
  active:    { label: 'Activa',      classes: 'bg-emerald-100 text-emerald-700' },
  dispensed: { label: 'Dispensada',  classes: 'bg-blue-100 text-blue-700' },
  completed: { label: 'Completada',  classes: 'bg-purple-100 text-purple-700' },
  cancelled: { label: 'Cancelada',   classes: 'bg-red-100 text-red-700' },
  expired:   { label: 'Vencida',     classes: 'bg-orange-100 text-orange-700' },
}

@Component({
    selector: 'app-prescription-list',
    templateUrl: './prescription-list.component.html',
    styleUrls: ['./prescription-list.component.css'],
    standalone: false
})
export class PrescriptionListComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef)
  private readonly listState = inject(ListStateService)

  /** Clave con la que se recuerda la vista de este listado. */
  private static readonly RUTA = '/dashboard/prescriptions'

  private readonly roleState = inject(RoleStateService)

  /**
   * Quién puede crear, editar o resurtir una receta. Va por ROL y no por permiso
   * porque el backend lo gatea así: `POST /prescriptions`, `PATCH /:id` y
   * `POST /:id/refill` son `@Auth(DOCTOR, ADMIN)`. Por permiso no saldría igual —
   * `PrescriptionsSign` lo tienen DOCTOR y SUPER_ADMIN, pero no ADMIN, que sí
   * puede por rol.
   *
   * Al farmacéutico se le mostraban las tres acciones y las tres acababan en 403:
   * tiene `PrescriptionsRead` y entra al módulo, pero solo puede activar,
   * dispensar e imprimir, que siguen visibles para él.
   */
  get canManagePrescriptions(): boolean {
    return this.roleState.hasAnyRole([UserRoles.DOCTOR, UserRoles.ADMIN, UserRoles.SUPER_ADMIN])
  }

  prescriptions: Prescription[] = []
  filteredPrescriptions: Prescription[] = []

  /** Columna elegida en la cabecera. Vacío = como vino del servidor. */
  orden: EstadoOrden = { key: '', dir: '' }

  onSort(sort: Sort): void {
    this.orden = leerOrden(sort)
    this.recordarVista()
  }

  /** Deja la vista en la URL y la recuerda para cuando se vuelva de una ficha. */
  private recordarVista(): void {
    const estado = {
      q: this.searchTerm.trim() || undefined,
      estado: this.selectedStatus && this.selectedStatus !== 'all' ? this.selectedStatus : undefined,
      sort: this.orden.dir ? this.orden.key : undefined,
      dir: this.orden.dir || undefined,
    }
    this.listState.guardar(PrescriptionListComponent.RUTA, estado)
    this.listState.reflejarEnUrl(this.route, estado)
  }

  /**
   * Restaura la vista si se vuelve de una ficha; si no, lee la URL. Al abrir un
   * registro Angular destruye este componente, y sin esto la vuelta dejaba la
   * lista entera y sin filtro.
   */
  private restaurarVista(): void {
    const guardado = this.listState.recuperarSiVuelve(PrescriptionListComponent.RUTA)
    const params = this.route.snapshot.queryParamMap
    this.searchTerm = String(guardado?.['q'] ?? params.get('q') ?? '')
    const estado = String(guardado?.['estado'] ?? params.get('estado') ?? '')
    if (estado) this.selectedStatus = estado
    const sort = String(guardado?.['sort'] ?? params.get('sort') ?? '')
    const dir = String(guardado?.['dir'] ?? params.get('dir') ?? '')
    if (sort && (dir === 'asc' || dir === 'desc')) this.orden = { key: sort, dir }

    // Guardar lo restaurado, no solo leerlo: si nadie toca un filtro no habría
    // nada en memoria, y al volver de una ficha la pantalla —a la que se llega
    // por su ruta pelada, sin parámetros— aparecería en la página 1 y sin orden.
    this.recordarVista()
  }

  get ordenadas(): Prescription[] {
    return ordenar(this.filteredPrescriptions, this.orden, (p, key) => {
      switch (key) {
        case 'numero': return p.prescriptionNumber
        // Por apellido, que es como se busca a alguien en una lista.
        case 'paciente': return `${p.patient?.lastName ?? ''} ${p.patient?.firstName ?? ''}`.trim()
        case 'doctor': return this.doctorName(p)
        // Por cuántos medicamentos lleva: es lo que se compara de un vistazo.
        case 'medicamentos': return p.items?.length ?? 0
        case 'vencimiento': return p.expiryDate ? new Date(p.expiryDate) : null
        // La etiqueta y no el valor del enum: la columna dice "Dispensada".
        case 'estado': return this.getStatusLabel(p.status)
        default: return null
      }
    })
  }
  loading = false
  searchTerm = ''
  selectedStatus = ''

  // Filtro por paciente (llegando desde "Accesos Rápidos" en la ficha del paciente)
  patientIdFilter: string | null = null
  patientNameFilter: string | null = null

  constructor(
    private prescriptionsService: PrescriptionsService,
    private router: Router,
    private route: ActivatedRoute,
    private alert: AlertService,
  ) {}

  ngOnInit(): void {
    this.patientIdFilter = this.route.snapshot.queryParamMap.get('patientId')
    this.restaurarVista()
    this.loadPrescriptions()
  }

  loadPrescriptions(): void {
    this.loading = true
    const filter: any = {}
    // 'expired' no es un valor real de status en la mayoría de los casos (una receta
    // vencida sigue guardada como 'active' salvo que alguien la haya marcado a mano) —
    // filtrar por 'expired' en el backend devolvería vacío casi siempre. Se resuelve
    // client-side en filteredPrescriptions.
    if (this.selectedStatus && this.selectedStatus !== 'expired') filter.status = this.selectedStatus
    if (this.searchTerm?.trim()) filter.search = this.searchTerm.trim()
    if (this.patientIdFilter) filter.patientId = this.patientIdFilter

    this.prescriptionsService.list(1, 100, filter).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response: any) => {
        this.prescriptions = response.items || []
        this.filteredPrescriptions =
          this.selectedStatus === 'expired'
            ? this.prescriptions.filter(p => this.isEffectivelyExpired(p))
            : this.prescriptions
        this.patientNameFilter = this.patientIdFilter && this.prescriptions[0]
          ? `${this.prescriptions[0].patient?.firstName ?? ''} ${this.prescriptions[0].patient?.lastName ?? ''}`.trim()
          : null
        this.loading = false
      },
      error: () => {
        this.loading = false
        this.alert.fire({
          icon: 'error',
          title: 'Error',
          text: 'No se pudieron cargar las recetas',
        })
      },
    })
  }

  clearPatientFilter(): void {
    this.router.navigate([], { queryParams: {} })
    this.patientIdFilter = null
    this.patientNameFilter = null
    this.loadPrescriptions()
  }

  onSearch(): void {
    this.recordarVista()
    this.loadPrescriptions()
  }

  createPrescription(): void {
    this.router.navigate(['/dashboard/prescriptions/new'])
  }

  viewPrescription(prescription: Prescription): void {
    this.router.navigate(['/dashboard/prescriptions', prescription.id])
  }

  editPrescription(prescription: Prescription): void {
    this.router.navigate(['/dashboard/prescriptions/edit', prescription.id])
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

  /**
   * Una receta 'active' cuya expiryDate ya pasó sigue vigente en la BD (nada la
   * marca 'expired' automáticamente) pero ya no es utilizable — se muestra como
   * vencida en vez de activa.
   */
  isEffectivelyExpired(p: Prescription): boolean {
    return p.status === 'expired' || (p.status === 'active' && this.isExpired(p.expiryDate))
  }

  getEffectiveStatus(p: Prescription): string {
    return this.isEffectivelyExpired(p) ? 'expired' : p.status
  }

  getDaysUntilExpiry(expiryDate: string): number {
    const today = new Date()
    const expiry = new Date(expiryDate)
    const diffTime = expiry.getTime() - today.getTime()
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  }

  isExpiringSoon(expiryDate: string): boolean {
    const days = this.getDaysUntilExpiry(expiryDate)
    return days > 0 && days <= 7
  }

  isExpired(expiryDate: string): boolean {
    return this.getDaysUntilExpiry(expiryDate) <= 0
  }

  canRefill(p: Prescription): boolean {
    return (
      p.status === 'active' &&
      !this.isExpired(p.expiryDate) &&
      (p.refillsAllowed || 0) > (p.refillsUsed || 0)
    )
  }

  getCountByStatus(status: string): number {
    return this.prescriptions.filter(p => p.status === status).length
  }

  /** 'Activas' = status 'active' Y no vencida — igual que canRefill/el gate de "Dispensar". */
  getActiveCount(): number {
    return this.prescriptions.filter(p => p.status === 'active' && !this.isExpired(p.expiryDate)).length
  }

  getExpiredCount(): number {
    return this.prescriptions.filter(p => this.isEffectivelyExpired(p)).length
  }

  getPatientInitials(p: Prescription): string {
    return (
      (p.patient?.firstName?.charAt(0) ?? '') + (p.patient?.lastName?.charAt(0) ?? '')
    ).toUpperCase() || '?'
  }

  setStatusFilter(status: string): void {
    this.selectedStatus = status
    this.recordarVista()
    this.loadPrescriptions()
  }

  changeStatus(p: Prescription, status: string) {
    this.alert
      .fire({
        icon: 'question',
        title: '¿Confirmar cambio de estado?',
        text: `La receta pasará a estado ${this.getStatusLabel(status)}.`,
        showCancelButton: true,
        confirmButtonText: 'Confirmar',
        cancelButtonText: 'Cancelar',
      })
      .then(res => {
        if (res.isConfirmed) {
          this.prescriptionsService.setStatus(p.id, status).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: () => {
              this.alert
                .success('Estado actualizado', 'La receta fue actualizada.')
                .then(() => this.loadPrescriptions())
            },
          })
        }
      })
  }

  doRefill(p: Prescription) {
    this.alert
      .fire({
        icon: 'question',
        title: '¿Agregar resurtido?',
        text: 'Se incrementará el contador de resurtidos.',
        showCancelButton: true,
        confirmButtonText: 'Confirmar',
        cancelButtonText: 'Cancelar',
      })
      .then(res => {
        if (res.isConfirmed) {
          this.prescriptionsService.refill(p.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: () => {
              this.alert
                .success('Resurtido registrado', 'La receta fue resurtida.')
                .then(() => this.loadPrescriptions())
            },
          })
        }
      })
  }

  activate(p: Prescription) {
    this.prescriptionsService.setStatus(p.id, 'active').pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => this.loadPrescriptions(),
    })
  }

  /**
   * Nombre del médico que firma. Vive en `personalInfo`, y el tratamiento en
   * `professionalInfo.title`. La plantilla caía al `email` cuando no venía el
   * nombre —y no venía nunca, porque el backend no cargaba la relación—, así que
   * la columna "Doctor" mostraba "Dr. dr.vargas@sanjorge.local".
   */
  doctorName(p: Prescription): string {
    const doctor = p.doctor as any
    const fullName = `${doctor?.personalInfo?.firstName ?? ''} ${doctor?.personalInfo?.lastName ?? ''}`.trim()
    if (!fullName) return 'Médico no registrado'
    const title = doctor?.professionalInfo?.title?.trim()
    return title ? `${title} ${fullName}` : fullName
  }

  printPdf(p: Prescription) {
    this.prescriptionsService.getPdf(p.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: blob => openPdfInNewTab(blob, 'receta.pdf'),
    })
  }
}
