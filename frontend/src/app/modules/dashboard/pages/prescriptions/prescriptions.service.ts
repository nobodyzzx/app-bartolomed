import { HttpClient, HttpParams } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { AlertService } from '@core/services/alert.service'
import { Observable, throwError } from 'rxjs'
import { catchError, map } from 'rxjs/operators'
import { environment } from '../../../../environments/environments'
import { ErrorService } from '../../../../shared/components/services/error.service'

export interface PrescriptionItemDto {
  medicationName: string
  strength: string
  dosageForm: string
  quantity: string
  dosage: string
  frequency: string
  route?: string
  duration?: number
  instructions?: string
}

export interface PrescriptionDto {
  id?: string
  prescriptionNumber: string
  prescriptionDate: string
  expiryDate: string
  patientId: string
  doctorId: string
  clinicId: string
  items: PrescriptionItemDto[]
  notes?: string
}

@Injectable({ providedIn: 'root' })
export class PrescriptionsService {
  private readonly base = environment.baseUrl

  constructor(
    private http: HttpClient,
    private errorService: ErrorService,
    private alert: AlertService,
  ) {}

  list(page = 1, pageSize = 20, filter: any = {}): Observable<any> {
    let params = new HttpParams().set('page', String(page)).set('pageSize', String(pageSize))
    Object.keys(filter || {}).forEach(k => {
      if (filter[k] !== undefined && filter[k] !== null) params = params.set(k, String(filter[k]))
    })

    return this.http.get(`${this.base}/prescriptions`, { params }).pipe(
      catchError(err => {
        this.errorService.handleError(err)
        return throwError(() => err)
      }),
    )
  }

  get(id: string) {
    return this.http.get(`${this.base}/prescriptions/${id}`).pipe(
      catchError(err => {
        this.errorService.handleError(err)
        return throwError(() => err)
      }),
    )
  }

  create(payload: PrescriptionDto) {
    return this.http.post(`${this.base}/prescriptions`, payload).pipe(
      map(res => res),
      catchError(err => {
        this.errorService.handleError(err)
        return throwError(() => err)
      }),
    )
  }

  update(id: string, payload: Partial<PrescriptionDto>) {
    return this.http.patch(`${this.base}/prescriptions/${id}`, payload).pipe(
      catchError(err => {
        this.errorService.handleError(err)
        return throwError(() => err)
      }),
    )
  }

  setStatus(id: string, status: string) {
    return this.http.patch(`${this.base}/prescriptions/${id}/status`, { status }).pipe(
      catchError(err => {
        this.errorService.handleError(err)
        return throwError(() => err)
      }),
    )
  }

  refill(id: string) {
    return this.http.post(`${this.base}/prescriptions/${id}/refill`, {}).pipe(
      catchError(err => {
        this.errorService.handleError(err)
        return throwError(() => err)
      }),
    )
  }

  getPdf(id: string): Observable<Blob> {
    return this.http.get(`${this.base}/prescriptions/${id}/pdf`, { responseType: 'blob' }).pipe(
      catchError(err => {
        this.errorService.handleError(err)
        return throwError(() => err)
      }),
    )
  }
}
