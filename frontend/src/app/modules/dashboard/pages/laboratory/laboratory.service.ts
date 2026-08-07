import { HttpClient, HttpParams } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { AlertService } from '@core/services/alert.service'
import { Observable, throwError } from 'rxjs'
import { catchError, tap } from 'rxjs/operators'
import { environment } from '../../../../environments/environments'
import { ErrorService } from '../../../../shared/components/services/error.service'

export interface LabOrderItemDto {
  testName: string
  category: string
  specimenType?: string
}

export interface LabOrderDto {
  id?: string
  orderNumber: string
  orderDate: string
  patientId: string
  doctorId: string
  clinicId: string
  clinicalNotes?: string
  isUrgent?: boolean
  items: LabOrderItemDto[]
}

export interface EnterLabResultDto {
  resultValue?: string
  resultUnit?: string
  referenceRange?: string
  isAbnormal?: boolean
  resultNotes?: string
  resultFileUrl?: string
}

@Injectable({ providedIn: 'root' })
export class LaboratoryService {
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

    return this.http.get(`${this.base}/lab-orders`, { params }).pipe(
      catchError(err => {
        this.errorService.handleError(err)
        return throwError(() => err)
      }),
    )
  }

  get(id: string) {
    return this.http.get(`${this.base}/lab-orders/${id}`).pipe(
      catchError(err => {
        this.errorService.handleError(err)
        return throwError(() => err)
      }),
    )
  }

  create(payload: LabOrderDto) {
    return this.http.post(`${this.base}/lab-orders`, payload).pipe(
      tap(() => this.alert.success('Éxito', 'Orden de laboratorio creada correctamente')),
      catchError(err => {
        this.errorService.handleError(err)
        return throwError(() => err)
      }),
    )
  }

  update(id: string, payload: Partial<LabOrderDto>) {
    return this.http.patch(`${this.base}/lab-orders/${id}`, payload).pipe(
      tap(() => this.alert.success('Éxito', 'Orden actualizada correctamente')),
      catchError(err => {
        this.errorService.handleError(err)
        return throwError(() => err)
      }),
    )
  }

  setStatus(id: string, status: string) {
    return this.http.patch(`${this.base}/lab-orders/${id}/status`, { status }).pipe(
      tap(() => this.alert.success('Éxito', 'Estado actualizado correctamente')),
      catchError(err => {
        this.errorService.handleError(err)
        return throwError(() => err)
      }),
    )
  }

  enterResult(id: string, itemId: string, dto: EnterLabResultDto) {
    return this.http.post(`${this.base}/lab-orders/${id}/items/${itemId}/result`, dto).pipe(
      tap(() => this.alert.success('Éxito', 'Resultado registrado correctamente')),
      catchError(err => {
        this.errorService.handleError(err)
        return throwError(() => err)
      }),
    )
  }

  remove(id: string) {
    return this.http.delete(`${this.base}/lab-orders/${id}`).pipe(
      tap(() => this.alert.success('Éxito', 'Orden eliminada correctamente')),
      catchError(err => {
        this.errorService.handleError(err)
        return throwError(() => err)
      }),
    )
  }
}
