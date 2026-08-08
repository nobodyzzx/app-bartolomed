import { HttpClient, HttpParams } from '@angular/common/http'
import { inject, Injectable } from '@angular/core'
import { AlertService } from '@core/services/alert.service'
import { Observable, throwError } from 'rxjs'
import { catchError, tap } from 'rxjs/operators'
import { environment } from '../../../../environments/environments'
import { ErrorService } from '../../../../shared/components/services/error.service'
import { LAB_MODULE_CONFIG } from './lab-module.config'

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

/**
 * Solicitud externa: sin `doctorId` (no hay médico de la casa que la firme) y
 * con el solicitante como texto. El paciente puede venir por ficha
 * (`patientId`) o, si no tiene, solo por nombre (`patientName`).
 */
export interface ExternalLabOrderDto {
  orderNumber: string
  orderDate: string
  clinicId: string
  patientId?: string
  patientName?: string
  referringDoctorName: string
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

/**
 * Cliente HTTP de los dos módulos que comparten motor: laboratorio y estudios
 * especiales. La ruta sale de `LAB_MODULE_CONFIG`, así que **no se provee en
 * `root`** — cada módulo perezoso lo provee en su inyector con su propia
 * configuración. Quien lo use fuera de esos módulos (el historial clínico del
 * paciente) debe proveer también la configuración que quiere consultar.
 */
@Injectable()
export class LabOrdersService {
  private readonly config = inject(LAB_MODULE_CONFIG)
  private readonly base = `${environment.baseUrl}/${this.config.apiPath}`

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

    return this.http.get(this.base, { params }).pipe(
      catchError(err => {
        this.errorService.handleError(err)
        return throwError(() => err)
      }),
    )
  }

  get(id: string) {
    return this.http.get(`${this.base}/${id}`).pipe(
      catchError(err => {
        this.errorService.handleError(err)
        return throwError(() => err)
      }),
    )
  }

  create(payload: LabOrderDto) {
    return this.http.post(this.base, payload).pipe(
      tap(() => this.alert.success('Éxito', 'Orden creada correctamente')),
      catchError(err => {
        this.errorService.handleError(err)
        return throwError(() => err)
      }),
    )
  }

  /** Solicitud que llega de fuera: la registran el servicio y recepción. */
  createExternal(payload: ExternalLabOrderDto) {
    return this.http.post(`${this.base}/external`, payload).pipe(
      tap(() => this.alert.success('Éxito', 'Solicitud externa registrada correctamente')),
      catchError(err => {
        this.errorService.handleError(err)
        return throwError(() => err)
      }),
    )
  }

  /** Informe de resultados para entregar al paciente o adjuntar al expediente. */
  getResultsPdf(id: string): Observable<Blob> {
    return this.http.get(`${this.base}/${id}/results/pdf`, { responseType: 'blob' }).pipe(
      catchError(err => {
        this.errorService.handleError(err)
        return throwError(() => err)
      }),
    )
  }

  update(id: string, payload: Partial<LabOrderDto>) {
    return this.http.patch(`${this.base}/${id}`, payload).pipe(
      tap(() => this.alert.success('Éxito', 'Orden actualizada correctamente')),
      catchError(err => {
        this.errorService.handleError(err)
        return throwError(() => err)
      }),
    )
  }

  setStatus(id: string, status: string) {
    return this.http.patch(`${this.base}/${id}/status`, { status }).pipe(
      tap(() => this.alert.success('Éxito', 'Estado actualizado correctamente')),
      catchError(err => {
        this.errorService.handleError(err)
        return throwError(() => err)
      }),
    )
  }

  enterResult(id: string, itemId: string, dto: EnterLabResultDto) {
    return this.http.post(`${this.base}/${id}/items/${itemId}/result`, dto).pipe(
      tap(() => this.alert.success('Éxito', 'Resultado registrado correctamente')),
      catchError(err => {
        this.errorService.handleError(err)
        return throwError(() => err)
      }),
    )
  }

  remove(id: string) {
    return this.http.delete(`${this.base}/${id}`).pipe(
      tap(() => this.alert.success('Éxito', 'Orden eliminada correctamente')),
      catchError(err => {
        this.errorService.handleError(err)
        return throwError(() => err)
      }),
    )
  }
}
