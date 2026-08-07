import { HttpClient, HttpParams } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { AlertService } from '@core/services/alert.service'
import { Observable, throwError } from 'rxjs'
import { catchError, tap } from 'rxjs/operators'
import { environment } from '../../../../environments/environments'
import { ErrorService } from '../../../../shared/components/services/error.service'

export enum ServiceCategory {
  CONSULTATION = 'consultation',
  LABORATORY = 'laboratory',
  PROCEDURE = 'procedure',
  OTHER = 'other',
}

/** Espejo de `AppointmentType` del backend: liga la tarifa al tipo de cita. */
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

export interface ServicePrice {
  id: string
  code: string
  name: string
  description: string | null
  category: ServiceCategory
  appointmentType: AppointmentType | null
  price: number
  isActive: boolean
  clinicId: string
  createdAt: string
  updatedAt: string
}

/** Lo justo para elegir un servicio del tarifario y referenciarlo. */
export interface ServicePriceCatalogItem {
  id: string
  code: string
  name: string
  category: ServiceCategory
  price: number
}

export interface ServicePricePayload {
  code: string
  name: string
  description?: string
  category: ServiceCategory
  appointmentType?: AppointmentType | null
  price: number
  isActive?: boolean
}

export interface ServicePriceListFilter {
  category?: ServiceCategory
  search?: string
  isActive?: string
  page?: number
  pageSize?: number
}

export interface ServicePriceListResponse {
  items: ServicePrice[]
  total: number
  page: number
  pageSize: number
}

export const CATEGORY_LABELS: Record<ServiceCategory, string> = {
  [ServiceCategory.CONSULTATION]: 'Consulta',
  [ServiceCategory.LABORATORY]: 'Laboratorio',
  [ServiceCategory.PROCEDURE]: 'Procedimiento',
  [ServiceCategory.OTHER]: 'Otro',
}

export const APPOINTMENT_TYPE_LABELS: Record<AppointmentType, string> = {
  [AppointmentType.CONSULTATION]: 'Consulta',
  [AppointmentType.FOLLOW_UP]: 'Seguimiento',
  [AppointmentType.EMERGENCY]: 'Emergencia',
  [AppointmentType.SURGERY]: 'Cirugía',
  [AppointmentType.LABORATORY]: 'Laboratorio',
  [AppointmentType.IMAGING]: 'Imagenología',
  [AppointmentType.VACCINATION]: 'Vacunación',
  [AppointmentType.THERAPY]: 'Terapia',
  [AppointmentType.OTHER]: 'Otro',
}

@Injectable({ providedIn: 'root' })
export class ServicePricesService {
  private readonly base = `${environment.baseUrl}/service-prices`

  constructor(
    private http: HttpClient,
    private errorService: ErrorService,
    private alert: AlertService,
  ) {}

  list(filter: ServicePriceListFilter = {}): Observable<ServicePriceListResponse> {
    let params = new HttpParams()
    Object.entries(filter).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value))
      }
    })

    return this.http.get<ServicePriceListResponse>(this.base, { params }).pipe(
      catchError(err => {
        this.errorService.handleError(err)
        return throwError(() => err)
      }),
    )
  }

  /**
   * Catálogo para elegir un servicio al pedirlo (el estudio de una orden de
   * laboratorio, por ejemplo). Va aparte de `list()` porque aquel exige
   * `billing.read`, que un médico no tiene: este acepta además `lab.order`.
   */
  catalog(category?: ServicePriceCatalogItem['category']): Observable<ServicePriceCatalogItem[]> {
    let params = new HttpParams()
    if (category) params = params.set('category', category)

    return this.http
      .get<ServicePriceCatalogItem[]>(`${this.base}/catalog`, { params })
      .pipe(
        catchError(err => {
          this.errorService.handleError(err)
          return throwError(() => err)
        }),
      )
  }

  create(payload: ServicePricePayload): Observable<ServicePrice> {
    return this.http.post<ServicePrice>(this.base, payload).pipe(
      tap(() => this.alert.success('Éxito', 'Servicio agregado al tarifario')),
      catchError(err => {
        this.errorService.handleError(err)
        return throwError(() => err)
      }),
    )
  }

  update(id: string, payload: Partial<ServicePricePayload>): Observable<ServicePrice> {
    return this.http.patch<ServicePrice>(`${this.base}/${id}`, payload).pipe(
      tap(() => this.alert.success('Éxito', 'Servicio actualizado')),
      catchError(err => {
        this.errorService.handleError(err)
        return throwError(() => err)
      }),
    )
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`).pipe(
      tap(() => this.alert.success('Eliminado', 'Servicio dado de baja del tarifario')),
      catchError(err => {
        this.errorService.handleError(err)
        return throwError(() => err)
      }),
    )
  }
}
