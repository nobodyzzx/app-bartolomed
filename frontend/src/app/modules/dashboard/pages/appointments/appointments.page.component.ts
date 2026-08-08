import { Component, DestroyRef, inject, OnInit } from '@angular/core'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { ActivatedRoute, Router } from '@angular/router'
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

  appointments: Appointment[] = []
  filteredAppointments: Appointment[] = []
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
    const term = this.searchTerm?.toLowerCase() ?? ''
    this.filteredAppointments = this.appointments.filter(apt => {
      // Todo va por `?? ''`: el buscador leía `apt.doctor.firstName`, que no existe
      // (el nombre del médico está en `personalInfo`), así que el primer carácter
      // tecleado reventaba con "Cannot read properties of undefined".
      const matchesSearch =
        !term ||
        (apt.patient?.firstName ?? '').toLowerCase().includes(term) ||
        (apt.patient?.lastName ?? '').toLowerCase().includes(term) ||
        this.getDoctorFullName(apt).toLowerCase().includes(term) ||
        (apt.reason ?? '').toLowerCase().includes(term)

      const matchesStatus = this.selectedStatus === 'all' || apt.status === this.selectedStatus

      return matchesSearch && matchesStatus
    })
  }

  onSearch() {
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
