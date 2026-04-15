import { HttpClient } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { AlertService } from '@core/services/alert.service'
import { Observable, throwError } from 'rxjs'
import { catchError, tap } from 'rxjs/operators'
import { environment } from '../../../../../environments/environments'
import { ErrorService } from '../../../../../shared/components/services/error.service'

export enum AppointmentStatus {
  SCHEDULED = 'scheduled',
  CONFIRMED = 'confirmed',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  NO_SHOW = 'no_show',
  RESCHEDULED = 'rescheduled',
}

export enum AppointmentType {
  CONSULTATION = 'consultation',
  FOLLOW_UP = 'follow_up',
  EMERGENCY = 'emergency',
  SURGERY = 'surgery',
  LABORATORY = 'laboratory',
  IMAGING = 'imaging',
  VACCINATION = 'vaccination',
  THERAPY = 'therapy',
  OTHER = 'other',
}

export enum AppointmentPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
}

export interface Patient {
  id: string
  firstName: string
  lastName: string
  email?: string
  phone?: string
}

export interface Doctor {
  id: string
  firstName: string
  lastName: string
  email?: string
  specialization?: string
}

export interface Clinic {
  id: string
  name: string
}

export interface Appointment {
  id: string
  appointmentDate: Date | string
  duration: number
  type: AppointmentType
  status: AppointmentStatus
  priority: AppointmentPriority
  reason: string
  notes?: string
  symptoms?: string
  previousTreatments?: string
  currentMedications?: string
  cancellationReason?: string
  confirmedAt?: Date | string
  cancelledAt?: Date | string
  completedAt?: Date | string
  isEmergency: boolean
  isRecurring: boolean
  recurringPattern?: string
  patient: Patient
  doctor: Doctor
  clinic: Clinic
  createdAt: Date | string
  updatedAt: Date | string
}

export interface CreateAppointmentDto {
  patientId: string
  doctorId: string
  clinicId: string
  appointmentDate: string
  duration: number
  type: AppointmentType
  priority: AppointmentPriority
  reason: string
  notes?: string
  symptoms?: string
  previousTreatments?: string
  currentMedications?: string
  isEmergency?: boolean
}

export interface UpdateAppointmentDto {
  appointmentDate?: string
  duration?: number
  type?: AppointmentType
  priority?: AppointmentPriority
  reason?: string
  notes?: string
  symptoms?: string
  previousTreatments?: string
  currentMedications?: string
}

export interface AppointmentFilters {
  clinicId?: string
  doctorId?: string
  patientId?: string
  status?: AppointmentStatus
  startDate?: string
  endDate?: string
}

export interface AppointmentStatistics {
  total: number
  byStatus: { [key: string]: number }
  byType: { [key: string]: number }
  byPriority: { [key: string]: number }
}

@Injectable({
  providedIn: 'root',
})
export class AppointmentsService {
  private readonly baseUrl = `${environment.baseUrl}/appointments`

  constructor(
    private http: HttpClient,
    private alertService: AlertService,
    private errorService: ErrorService,
  ) {}

  getAppointments(filters?: AppointmentFilters): Observable<Appointment[]> {
    return this.http.get<Appointment[]>(this.baseUrl, { params: { ...filters } as any }).pipe(
      catchError(error => {
        this.errorService.handleError(error)
        return throwError(() => error)
      }),
    )
  }

  getAppointment(id: string): Observable<Appointment> {
    return this.http.get<Appointment>(`${this.baseUrl}/${id}`).pipe(
      catchError(error => {
        this.errorService.handleError(error)
        return throwError(() => error)
      }),
    )
  }

  createAppointment(dto: CreateAppointmentDto): Observable<Appointment> {
    return this.http.post<Appointment>(this.baseUrl, dto).pipe(
      tap(() => {
        this.alertService.fire({
          icon: 'success',
          title: 'Cita creada',
          text: 'La cita ha sido creada exitosamente',
        })
      }),
      catchError(error => {
        this.errorService.handleError(error)
        return throwError(() => error)
      }),
    )
  }

  updateAppointment(id: string, dto: UpdateAppointmentDto): Observable<Appointment> {
    return this.http.patch<Appointment>(`${this.baseUrl}/${id}`, dto).pipe(
      tap(() => {
        this.alertService.fire({
          icon: 'success',
          title: 'Cita actualizada',
          text: 'Los cambios han sido guardados',
        })
      }),
      catchError(error => {
        this.errorService.handleError(error)
        return throwError(() => error)
      }),
    )
  }

  confirmAppointment(id: string): Observable<Appointment> {
    return this.http.patch<Appointment>(`${this.baseUrl}/${id}/confirm`, {}).pipe(
      tap(() => {
        this.alertService.fire({
          icon: 'success',
          title: 'Cita confirmada',
          text: 'La cita ha sido confirmada',
        })
      }),
      catchError(error => {
        this.errorService.handleError(error)
        return throwError(() => error)
      }),
    )
  }

  completeAppointment(id: string): Observable<Appointment> {
    return this.http.patch<Appointment>(`${this.baseUrl}/${id}/complete`, {}).pipe(
      tap(() => {
        this.alertService.fire({
          icon: 'success',
          title: 'Cita completada',
          text: 'La cita ha sido marcada como completada',
        })
      }),
      catchError(error => {
        this.errorService.handleError(error)
        return throwError(() => error)
      }),
    )
  }

  cancelAppointment(id: string, reason: string): Observable<Appointment> {
    return this.http
      .patch<Appointment>(`${this.baseUrl}/${id}/cancel`, {
        cancellationReason: reason,
      })
      .pipe(
        tap(() => {
          this.alertService.fire({
            icon: 'success',
            title: 'Cita cancelada',
            text: 'La cita ha sido cancelada',
          })
        }),
        catchError(error => {
          this.errorService.handleError(error)
          return throwError(() => error)
        }),
      )
  }

  deleteAppointment(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`).pipe(
      tap(() => {
        this.alertService.fire({
          icon: 'success',
          title: 'Cita eliminada',
          text: 'La cita ha sido eliminada permanentemente',
        })
      }),
      catchError(error => {
        this.errorService.handleError(error)
        return throwError(() => error)
      }),
    )
  }

  getStatistics(filters?: {
    clinicId?: string
    doctorId?: string
    startDate?: string
    endDate?: string
  }): Observable<AppointmentStatistics> {
    return this.http
      .get<AppointmentStatistics>(`${this.baseUrl}/statistics`, {
        params: { ...filters } as any,
      })
      .pipe(
        catchError(error => {
          this.errorService.handleError(error)
          return throwError(() => error)
        }),
      )
  }

  getDoctorAvailability(doctorId: string, date: string, clinicId?: string): Observable<any> {
    const params: any = { date }
    if (clinicId) params.clinicId = clinicId
    return this.http.get(`${this.baseUrl}/availability/${doctorId}`, { params }).pipe(
      catchError(error => {
        this.errorService.handleError(error)
        return throwError(() => error)
      }),
    )
  }
}
