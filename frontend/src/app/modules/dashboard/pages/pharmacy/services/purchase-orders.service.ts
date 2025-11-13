import { HttpClient, HttpParams } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { AlertService } from '@core/services/alert.service'
import { Observable, throwError } from 'rxjs'
import { catchError, tap } from 'rxjs/operators'
import { environment } from '../../../../../environments/environments'
import { ErrorService } from '../../../../../shared/components/services/error.service'
import {
  CreatePurchaseOrderDto,
  PurchaseOrder,
  PurchaseOrderStatus,
  UpdatePurchaseOrderStatusDto,
} from '../interfaces/pharmacy.interfaces'

@Injectable({ providedIn: 'root' })
export class PurchaseOrdersService {
  private readonly baseUrl = `${environment.baseUrl}/pharmacy/purchase-orders`

  constructor(
    private http: HttpClient,
    private errorService: ErrorService,
    private alert: AlertService,
  ) {}

  getAll(filters?: {
    status?: PurchaseOrderStatus
    supplierId?: string
  }): Observable<PurchaseOrder[]> {
    let params = new HttpParams()
    if (filters?.status) params = params.set('status', filters.status)
    if (filters?.supplierId) params = params.set('supplierId', filters.supplierId)
    return this.http.get<PurchaseOrder[]>(this.baseUrl, { params }).pipe(
      catchError(error => {
        this.errorService.handleError(error)
        return throwError(() => error)
      }),
    )
  }

  getById(id: string): Observable<PurchaseOrder> {
    return this.http.get<PurchaseOrder>(`${this.baseUrl}/${id}`).pipe(
      catchError(error => {
        this.errorService.handleError(error)
        return throwError(() => error)
      }),
    )
  }

  create(dto: CreatePurchaseOrderDto): Observable<PurchaseOrder> {
    return this.http.post<PurchaseOrder>(this.baseUrl, dto).pipe(
      tap(() => this.alert.success('Éxito', 'Orden de compra creada')),
      catchError(error => {
        this.errorService.handleError(error)
        return throwError(() => error)
      }),
    )
  }

  update(id: string, dto: Partial<CreatePurchaseOrderDto>): Observable<PurchaseOrder> {
    return this.http.patch<PurchaseOrder>(`${this.baseUrl}/${id}`, dto).pipe(
      tap(() => this.alert.success('Éxito', 'Orden de compra actualizada')),
      catchError(error => {
        this.errorService.handleError(error)
        return throwError(() => error)
      }),
    )
  }

  updateStatus(id: string, statusDto: UpdatePurchaseOrderStatusDto): Observable<PurchaseOrder> {
    return this.http.patch<PurchaseOrder>(`${this.baseUrl}/${id}/status`, statusDto).pipe(
      tap(() => this.alert.success('Éxito', 'Estado actualizado')),
      catchError(error => {
        this.errorService.handleError(error)
        return throwError(() => error)
      }),
    )
  }

  receive(
    id: string,
    payload: {
      items: {
        itemId: string
        receivingQuantity: number
        notes?: string
        batchNumber?: string
        expiryDate?: string
      }[]
      notes?: string
    },
  ): Observable<PurchaseOrder> {
    return this.http.post<PurchaseOrder>(`${this.baseUrl}/${id}/receive`, payload).pipe(
      tap(() => this.alert.success('Recepción', 'Productos recibidos')),
      catchError(error => {
        this.errorService.handleError(error)
        return throwError(() => error)
      }),
    )
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`).pipe(
      tap(() => this.alert.success('Éxito', 'Orden eliminada')),
      catchError(error => {
        this.errorService.handleError(error)
        return throwError(() => error)
      }),
    )
  }
}
