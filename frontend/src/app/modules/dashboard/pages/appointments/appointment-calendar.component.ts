import { HttpClient } from '@angular/common/http'
import { Component, DestroyRef, inject, OnInit } from '@angular/core'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { Router } from '@angular/router'
import { AlertService } from '@core/services/alert.service'
import { throwError } from 'rxjs'
import { catchError, tap } from 'rxjs/operators'
import { environment } from '../../../../environments/environments'
import { Appointment, CalendarDay } from './interfaces/appointment-calendar.interfaces'

@Component({
    selector: 'app-appointment-calendar',
    templateUrl: './appointment-calendar.component.html',
    styleUrls: ['./appointment-calendar.component.css'],
    standalone: false
})
export class AppointmentCalendarComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef)

  currentDate: Date = new Date()
  calendarDays: CalendarDay[] = []
  appointments: Appointment[] = []
  loading: boolean = false
  selectedDate: Date | null = null

  readonly monthNames = [
    'Enero',
    'Febrero',
    'Marzo',
    'Abril',
    'Mayo',
    'Junio',
    'Julio',
    'Agosto',
    'Septiembre',
    'Octubre',
    'Noviembre',
    'Diciembre',
  ]

  readonly weekDays = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

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
    low: 'border-l-4 border-blue-400',
    normal: 'border-l-4 border-green-400',
    high: 'border-l-4 border-yellow-400',
    urgent: 'border-l-4 border-red-500',
  }

  constructor(
    private router: Router,
    private http: HttpClient,
    private alert: AlertService,
  ) {}

  ngOnInit() {
    this.loadAppointments()
  }

  loadAppointments() {
    this.loading = true
    const startDate = this.getMonthStart(this.currentDate)
    const endDate = this.getMonthEnd(this.currentDate)

    this.http
      .get<Appointment[]>(`${environment.baseUrl}/appointments`, {
        params: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
      })
      .pipe(
        tap(() => (this.loading = false)),
        catchError(error => {
          this.loading = false
          return throwError(() => error)
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((appointments: Appointment[]) => {
        this.appointments = appointments.map((apt: Appointment) => ({
          ...apt,
          appointmentDate: new Date(apt.appointmentDate),
        }))
        this.generateCalendar()
      })
  }

  generateCalendar() {
    const year = this.currentDate.getFullYear()
    const month = this.currentDate.getMonth()

    // Primer día del mes
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)

    // Días del mes anterior para completar la semana
    const startPadding = firstDay.getDay()
    const endPadding = 6 - lastDay.getDay()

    this.calendarDays = []

    // Días del mes anterior
    for (let i = startPadding - 1; i >= 0; i--) {
      const date = new Date(year, month, -i)
      this.calendarDays.push(this.createCalendarDay(date, false))
    }

    // Días del mes actual
    for (let day = 1; day <= lastDay.getDate(); day++) {
      const date = new Date(year, month, day)
      this.calendarDays.push(this.createCalendarDay(date, true))
    }

    // Días del mes siguiente
    for (let i = 1; i <= endPadding; i++) {
      const date = new Date(year, month + 1, i)
      this.calendarDays.push(this.createCalendarDay(date, false))
    }
  }

  createCalendarDay(date: Date, isCurrentMonth: boolean): CalendarDay {
    const today = new Date()
    const isToday =
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()

    const dayAppointments = this.appointments.filter(apt => {
      const aptDate = new Date(apt.appointmentDate)
      return (
        aptDate.getDate() === date.getDate() &&
        aptDate.getMonth() === date.getMonth() &&
        aptDate.getFullYear() === date.getFullYear()
      )
    })

    return {
      date,
      isCurrentMonth,
      isToday,
      appointments: dayAppointments,
      dayNumber: date.getDate(),
    }
  }

  previousMonth() {
    this.currentDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() - 1, 1)
    this.loadAppointments()
  }

  nextMonth() {
    this.currentDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() + 1, 1)
    this.loadAppointments()
  }

  goToToday() {
    this.currentDate = new Date()
    this.loadAppointments()
  }

  getMonthStart(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0)
  }

  getMonthEnd(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59)
  }

  get currentMonthYear(): string {
    return `${this.monthNames[this.currentDate.getMonth()]} ${this.currentDate.getFullYear()}`
  }

  onDayClick(day: CalendarDay) {
    if (day.appointments.length > 0) {
      this.selectedDate = day.date
    } else {
      this.createAppointmentForDate(day.date)
    }
  }

  createAppointmentForDate(date: Date) {
    const formattedDate = date.toISOString().split('T')[0]
    this.router.navigate(['/dashboard/appointments/new'], {
      queryParams: { date: formattedDate },
    })
  }

  viewAppointment(appointment: Appointment) {
    this.router.navigate(['/dashboard/appointments/edit', appointment.id])
  }

  async cancelAppointment(event: Event, appointment: Appointment) {
    event.stopPropagation()

    const result = await this.alert.fire({
      icon: 'question',
      title: '¿Cancelar cita?',
      text: `¿Deseas cancelar la cita con ${appointment.patient.firstName} ${appointment.patient.lastName}?`,
      showCancelButton: true,
      confirmButtonText: 'Sí, cancelar',
      cancelButtonText: 'No',
    })

    if (result.isConfirmed) {
      this.http
        .patch(`${environment.baseUrl}/appointments/${appointment.id}/cancel`, {
          cancellationReason: 'Cancelado desde calendario',
        })
        .pipe(
          tap(() => {
            this.alert.fire({
              icon: 'success',
              title: 'Cita cancelada',
              text: 'La cita ha sido cancelada correctamente',
            })
            this.loadAppointments()
          }),
          catchError(error => {
            return throwError(() => error)
          }),
          takeUntilDestroyed(this.destroyRef),
        )
        .subscribe()
    }
  }

  formatTime(date: Date): string {
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
    return this.priorityColors[priority] || 'border-l-4 border-gray-400'
  }

  goBack() {
    this.router.navigate(['/dashboard/appointments'])
  }

  createNewAppointment() {
    this.router.navigate(['/dashboard/appointments/new'])
  }
}
