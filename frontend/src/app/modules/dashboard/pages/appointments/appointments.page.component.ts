import { Component, DestroyRef, inject, OnInit } from '@angular/core'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { Router } from '@angular/router'
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
})
export class AppointmentsPageComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef)

  appointments: Appointment[] = []
  filteredAppointments: Appointment[] = []
  loading: boolean = false
  searchTerm: string = ''
  selectedStatus: string = 'all'

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
    private appointmentsService: AppointmentsService,
    private alert: AlertService,
  ) {}

  goBack(): void {
    this.router.navigate(['/dashboard'])
  }

  ngOnInit() {
    this.loadAppointments()
  }

  loadAppointments() {
    this.loading = true
    const today = new Date()
    const filters: AppointmentFilters = {
      startDate: today.toISOString(),
    }

    this.appointmentsService.getAppointments(filters).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: appointments => {
        this.appointments = appointments.sort((a, b) => {
          return new Date(a.appointmentDate).getTime() - new Date(b.appointmentDate).getTime()
        })
        this.applyFilters()
        this.loading = false
      },
      error: () => {
        this.loading = false
      },
    })
  }

  applyFilters() {
    this.filteredAppointments = this.appointments.filter(apt => {
      const matchesSearch =
        !this.searchTerm ||
        apt.patient.firstName.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        apt.patient.lastName.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        apt.doctor.firstName.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        apt.doctor.lastName.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        apt.reason.toLowerCase().includes(this.searchTerm.toLowerCase())

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
