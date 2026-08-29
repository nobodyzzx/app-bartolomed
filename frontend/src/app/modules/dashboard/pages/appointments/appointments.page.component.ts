import { Component, DestroyRef, inject, OnInit } from '@angular/core'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { Sort } from '@angular/material/sort'
import { ListStateService } from '../../../../shared/services/list-state.service'
import { ActivatedRoute, Router } from '@angular/router'
import { EstadoOrden, leerOrden, ordenar } from '../../../../shared/utils/table-sort.util'
import { matchesSearch } from '../../../../shared/utils/text-search.util'
import { AlertService } from '@core/services/alert.service'
import {
  Appointment,
  AppointmentFilters,
  AppointmentsService,
  AppointmentStatus,
} from './services/appointments.service'

@Component({
    selector: 'app-appointments-page',
    templateUrl: './appointments.page.component.html',
    styleUrls: ['./appointments.page.component.css'],
    standalone: false
})
export class AppointmentsPageComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef)
  private readonly listState = inject(ListStateService)

  /** Clave con la que se recuerda la vista de este listado. */
  private static readonly RUTA = '/dashboard/appointments'

  appointments: Appointment[] = []
  filteredAppointments: Appointment[] = []

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
    this.listState.guardar(AppointmentsPageComponent.RUTA, estado)
    this.listState.reflejarEnUrl(this.route, estado)
  }

  /**
   * Restaura la vista si se vuelve de una ficha; si no, lee la URL. Al abrir un
   * registro Angular destruye este componente, y sin esto la vuelta dejaba la
   * lista entera y sin filtro.
   */
  private restaurarVista(): void {
    const guardado = this.listState.recuperarSiVuelve(AppointmentsPageComponent.RUTA)
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

  get ordenadas(): Appointment[] {
    return ordenar(this.filteredAppointments, this.orden, (apt, key) => {
      switch (key) {
        case 'fecha': return apt.appointmentDate ? new Date(apt.appointmentDate) : null
        // Por apellido, que es como se busca a alguien en una lista.
        case 'paciente': return `${apt.patient?.lastName ?? ''} ${apt.patient?.firstName ?? ''}`.trim()
        case 'doctor': return this.getDoctorFullName(apt)
        case 'motivo': return apt.reason
        // La etiqueta y no el valor del enum: la columna dice "Confirmada".
        case 'estado': return this.getStatusLabel(apt.status)
        default: return null
      }
    })
  }
  loading: boolean = false
  searchTerm: string = ''
  selectedStatus: string = 'all'

  // Filtro por paciente (llegando desde "Accesos Rápidos" en la ficha del paciente)
  patientIdFilter: string | null = null
  patientNameFilter: string | null = null

  readonly statusColors: { [key: string]: string } = {
    scheduled: 'bg-blue-100 text-blue-800',
    confirmed: 'bg-green-100 text-green-800',
    in_progress: 'bg-yellow-100 text-yellow-800',
    completed: 'bg-gray-100 text-gray-800',
    cancelled: 'bg-red-100 text-red-800',
    no_show: 'bg-orange-100 text-orange-800',
    rescheduled: 'bg-purple-100 text-purple-800',
  }

  readonly statusLabels: { [key: string]: string } = {
    scheduled: 'Programada',
    confirmed: 'Confirmada',
    in_progress: 'En Curso',
    completed: 'Completada',
    cancelled: 'Cancelada',
    no_show: 'No Asistió',
    rescheduled: 'Reprogramada',
  }

  readonly priorityColors: { [key: string]: string } = {
    low: 'text-blue-600',
    normal: 'text-green-600',
    high: 'text-yellow-600',
    urgent: 'text-red-600',
  }

  readonly priorityIcons: { [key: string]: string } = {
    low: 'flag',
    normal: 'flag',
    high: 'flag',
    urgent: 'priority_high',
  }

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private appointmentsService: AppointmentsService,
    private alert: AlertService,
  ) {}

  goBack(): void {
    this.router.navigate(['/dashboard'])
  }

  ngOnInit() {
    this.patientIdFilter = this.route.snapshot.queryParamMap.get('patientId')
    this.restaurarVista()
    this.loadAppointments()
  }

  loadAppointments() {
    this.loading = true
    // Filtrado por paciente (desde "Accesos Rápidos" en su ficha): se quiere ver todo su
    // historial, no solo desde hoy — el default "desde hoy" solo aplica a la vista general.
    const filters: AppointmentFilters = this.patientIdFilter
      ? { patientId: this.patientIdFilter }
      : { startDate: new Date().toISOString() }

    this.appointmentsService.getAppointments(filters).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: appointments => {
        this.appointments = appointments.sort((a, b) => {
          return new Date(a.appointmentDate).getTime() - new Date(b.appointmentDate).getTime()
        })
        this.patientNameFilter = this.patientIdFilter && appointments[0]
          ? `${appointments[0].patient.firstName} ${appointments[0].patient.lastName}`
          : null
        this.applyFilters()
        this.loading = false
      },
      error: () => {
        this.loading = false
      },
    })
  }

  clearPatientFilter(): void {
    this.router.navigate([], { queryParams: {} })
    this.patientIdFilter = null
    this.patientNameFilter = null
    this.loadAppointments()
  }

  applyFilters() {
    const term = this.searchTerm ?? ''
    this.filteredAppointments = this.appointments.filter(apt => {
      // `matchesSearch` (la función compartida) ignora tildes y mayúsculas en
      // los dos lados. Antes era un `.toLowerCase().includes()` a mano, sin
      // eso: buscar "García" no encontraba "Garcia" tal como está cargado.
      const matches =
        !term ||
        matchesSearch(term, apt.patient?.firstName, apt.patient?.lastName, this.getDoctorFullName(apt), apt.reason)

      const matchesStatus = this.selectedStatus === 'all' || apt.status === this.selectedStatus

      return matches && matchesStatus
    })
  }

  onSearch() {
    this.recordarVista()
    this.applyFilters()
  }

  onStatusChange() {
    this.applyFilters()
  }

  viewCalendar() {
    this.router.navigate(['/dashboard/appointments/calendar'])
  }

  createAppointment() {
    this.router.navigate(['/dashboard/appointments/new'])
  }

  editAppointment(appointment: Appointment) {
    this.router.navigate(['/dashboard/appointments/edit', appointment.id])
  }

  async confirmAppointment(event: Event, appointment: Appointment) {
    event.stopPropagation()

    const result = await this.alert.fire({
      icon: 'question',
      title: '¿Confirmar cita?',
      text: `¿Deseas confirmar la cita con ${appointment.patient.firstName} ${appointment.patient.lastName}?`,
      showCancelButton: true,
      confirmButtonText: 'Sí, confirmar',
      cancelButtonText: 'Cancelar',
    })

    if (result.isConfirmed) {
      this.appointmentsService.confirmAppointment(appointment.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => {
          this.loadAppointments()
        },
      })
    }
  }

  async cancelAppointment(event: Event, appointment: Appointment) {
    event.stopPropagation()

    const result = await this.alert.fire({
      icon: 'question',
      title: '¿Cancelar cita?',
      text: `¿Deseas cancelar la cita con ${appointment.patient.firstName} ${appointment.patient.lastName}?`,
      input: 'textarea',
      inputLabel: 'Motivo de cancelación',
      inputPlaceholder: 'Escribe el motivo...',
      showCancelButton: true,
      confirmButtonText: 'Sí, cancelar',
      cancelButtonText: 'No',
      inputValidator: (value: string) => {
        if (!value) {
          return 'Debes proporcionar un motivo'
        }
        return null
      },
    })

    if (result.isConfirmed) {
      this.appointmentsService.cancelAppointment(appointment.id, result.value ?? '').pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => {
          this.loadAppointments()
        },
      })
    }
  }

  formatDate(date: Date | string): string {
    return new Date(date).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  }

  formatTime(date: Date | string): string {
    return new Date(date).toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  getStatusLabel(status: string): string {
    return this.statusLabels[status] || status
  }

  getStatusColor(status: string): string {
    return this.statusColors[status] || 'bg-gray-100 text-gray-800'
  }

  getPriorityColor(priority: string): string {
    return this.priorityColors[priority] || 'text-gray-600'
  }

  getPriorityIcon(priority: string): string {
    return this.priorityIcons[priority] || 'flag'
  }

  getCountByStatus(status: string): number {
    return this.appointments.filter(a => a.status === status).length
  }

  getTodayCount(): number {
    const today = new Date().toDateString()
    return this.appointments.filter(
      a => new Date(a.appointmentDate).toDateString() === today,
    ).length
  }

  getPatientInitials(apt: Appointment): string {
    return (
      (apt.patient.firstName?.charAt(0) ?? '') + (apt.patient.lastName?.charAt(0) ?? '')
    ).toUpperCase() || '?'
  }

  /**
   * El nombre del médico sale de `doctor.personalInfo` (un User no tiene columnas
   * propias de nombre) y el tratamiento de `professionalInfo.title`, para no
   * imprimir "Dr." a una doctora. Si por lo que sea no viene el nombre, mejor un
   * guion que un "Dr." suelto, que es justo lo que se veía antes.
   */
  getDoctorFullName(apt: Appointment): string {
    const { firstName = '', lastName = '' } = apt.doctor?.personalInfo ?? {}
    const fullName = `${firstName} ${lastName}`.trim()
    if (!fullName) return '—'
    const title = apt.doctor?.professionalInfo?.title?.trim()
    return title ? `${title} ${fullName}` : fullName
  }

  setStatus(status: string): void {
    this.selectedStatus = status
    this.recordarVista()
    this.applyFilters()
  }

  canConfirm(appointment: Appointment): boolean {
    return appointment.status === AppointmentStatus.SCHEDULED
  }

  canCancel(appointment: Appointment): boolean {
    return (
      appointment.status === AppointmentStatus.SCHEDULED ||
      appointment.status === AppointmentStatus.CONFIRMED
    )
  }
}
