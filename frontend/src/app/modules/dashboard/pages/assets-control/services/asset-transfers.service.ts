import { HttpClient, HttpParams } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { Observable, throwError } from 'rxjs'
import { catchError, tap } from 'rxjs/operators'
import { AlertService } from '../../../../../core/services/alert.service'
import { environment } from '../../../../../environments/environments'
import { ErrorService } from '../../../../../shared/components/services/error.service'
import {
  AssetTransfer,
  AssetTransferAuditLog,
  AssetTransferStatus,
  CreateAssetTransferDto,
} from '../interfaces/assets.interfaces'

@Injectable({ providedIn: 'root' })
export class AssetTransfersService {
  private readonly apiUrl = `${environment.baseUrl}/asset-transfers`

  constructor(
    private http: HttpClient,
    private errorService: ErrorService,
    private alertService: AlertService,
  ) {}

  private handleHttpError = (error: any): Observable<never> => {
    this.errorService.handleError(error)
    return throwError(() => error)
  }

  getTransfers(status?: AssetTransferStatus): Observable<AssetTransfer[]> {
    let params = new HttpParams()
    if (status) params = params.set('status', status)
    return this.http
      .get<AssetTransfer[]>(this.apiUrl, { params })
      .pipe(catchError(this.handleHttpError))
  }

  getTransfer(id: string): Observable<AssetTransfer> {
    return this.http
      .get<AssetTransfer>(`${this.apiUrl}/${id}`)
      .pipe(catchError(this.handleHttpError))
  }

  getPendingCount(): Observable<{ count: number }> {
    return this.http
      .get<{ count: number }>(`${this.apiUrl}/pending-count`)
      .pipe(catchError(this.handleHttpError))
  }

  getAuditLog(id: string): Observable<AssetTransferAuditLog[]> {
    return this.http
      .get<AssetTransferAuditLog[]>(`${this.apiUrl}/${id}/audit`)
      .pipe(catchError(this.handleHttpError))
  }

  create(dto: CreateAssetTransferDto): Observable<AssetTransfer> {
    return this.http.post<AssetTransfer>(this.apiUrl, dto).pipe(
      tap(() => this.alertService.success('Traslado solicitado', 'La solicitud fue enviada a la clínica origen')),
      catchError(this.handleHttpError),
    )
  }

  dispatch(id: string, notes?: string): Observable<AssetTransfer> {
    return this.http.patch<AssetTransfer>(`${this.apiUrl}/${id}/dispatch`, { notes }).pipe(
      tap(() => this.alertService.success('Despacho confirmado', 'Los activos están en tránsito')),
      catchError(this.handleHttpError),
    )
  }

  confirmReceipt(id: string, notes?: string): Observable<AssetTransfer> {
    return this.http.patch<AssetTransfer>(`${this.apiUrl}/${id}/confirm-receipt`, { notes }).pipe(
      tap(() => this.alertService.success('Recepción confirmada', 'Los activos fueron recibidos correctamente')),
      catchError(this.handleHttpError),
    )
  }

  reject(id: string, reason: string): Observable<AssetTransfer> {
    return this.http.patch<AssetTransfer>(`${this.apiUrl}/${id}/reject`, { reason }).pipe(
      tap(() => this.alertService.success('Traslado rechazado', 'La solicitud fue rechazada')),
      catchError(this.handleHttpError),
    )
  }

  returnTransfer(id: string, reason: string): Observable<AssetTransfer> {
    return this.http.patch<AssetTransfer>(`${this.apiUrl}/${id}/return`, { reason }).pipe(
      tap(() => this.alertService.success('Traslado devuelto', 'Los activos fueron devueltos a la clínica origen')),
      catchError(this.handleHttpError),
    )
  }
}
