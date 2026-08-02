import { HttpClient, HttpParams } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { Observable, throwError } from 'rxjs'
import { catchError, map, tap } from 'rxjs/operators'
import { AlertService } from '@core/services/alert.service'
import { environment } from '../../../../../environments/environments'
import { ErrorService } from '../../../../../shared/components/services/error.service'
import { Invoice, InvoiceStatus, PaginatedResult } from '../interfaces/pharmacy.interfaces'

const mapToInvoice = (raw: any): Invoice => ({
  id: raw.id,
  invoiceNumber: raw.invoiceNumber,
  saleId: raw.saleId,
  sale: raw.sale,
  issueDate: raw.invoiceDate,
  date: raw.invoiceDate,
  dueDate: raw.dueDate,
  paymentDate: raw.paymentDate,
  status: raw.status,
  subtotal: Number(raw.subtotal) || 0,
  taxAmount: Number(raw.tax) || 0,
  totalAmount: Number(raw.total) || 0,
  total: Number(raw.total) || 0,
  amountPaid: Number(raw.amountPaid) || 0,
  balanceDue: Number(raw.balance) || 0,
  patientName: raw.patientName,
  notes: raw.notes,
  clinicId: raw.sale?.clinicId ?? '',
  createdAt: raw.createdAt,
  updatedAt: raw.updatedAt,
})

@Injectable({
  providedIn: 'root',
})
export class InvoicingService {
  private readonly baseUrl = `${environment.baseUrl}/pharmacy-invoices`

  constructor(
    private http: HttpClient,
    private errorService: ErrorService,
    private alert: AlertService,
  ) {}

  getInvoices(filters?: { status?: InvoiceStatus; page?: number; limit?: number }): Observable<PaginatedResult<Invoice>> {
    let params = new HttpParams()
    if (filters?.status) params = params.set('status', filters.status)
    params = params.set('page', String(filters?.page ?? 1))
    params = params.set('limit', String(filters?.limit ?? 100))
    return this.http.get<PaginatedResult<any>>(this.baseUrl, { params }).pipe(
      map(result => ({ ...result, data: result.data.map(mapToInvoice) })),
      catchError(error => {
        this.errorService.handleError(error)
        return throwError(() => error)
      }),
    )
  }

  getInvoice(id: string): Observable<Invoice> {
    return this.http.get<any>(`${this.baseUrl}/${id}`).pipe(
      map(mapToInvoice),
      catchError(error => {
        this.errorService.handleError(error)
        return throwError(() => error)
      }),
    )
  }

  /** Busca la factura ya generada para una venta (relación 1:1 sale→invoice). */
  getInvoiceBySale(saleId: string): Observable<Invoice> {
    return this.http.get<any>(`${this.baseUrl}/by-sale/${saleId}`).pipe(map(mapToInvoice))
  }

  createInvoice(dto: {
    saleId: string
    patientName?: string
    patientAddress?: string
    patientPhone?: string
    patientEmail?: string
    taxId?: string
    invoiceDate: string
    dueDate: string
    notes?: string
  }): Observable<Invoice> {
    return this.http.post<any>(this.baseUrl, dto).pipe(
      map(mapToInvoice),
      tap(() => this.alert.success('Éxito', 'Factura generada')),
      catchError(error => {
        this.errorService.handleError(error)
        return throwError(() => error)
      }),
    )
  }

  updateInvoice(id: string, dto: Partial<Invoice>): Observable<Invoice> {
    return this.http.patch<any>(`${this.baseUrl}/${id}`, dto).pipe(
      map(mapToInvoice),
      tap(() => this.alert.success('Éxito', 'Factura actualizada')),
      catchError(error => {
        this.errorService.handleError(error)
        return throwError(() => error)
      }),
    )
  }

  updateInvoiceStatus(id: string, status: InvoiceStatus, paymentDate?: string): Observable<Invoice> {
    return this.http.patch<any>(`${this.baseUrl}/${id}/status`, { status, paymentDate }).pipe(
      map(mapToInvoice),
      tap(() => this.alert.success('Éxito', 'Estado de la factura actualizado')),
      catchError(error => {
        this.errorService.handleError(error)
        return throwError(() => error)
      }),
    )
  }

  getOverdueInvoices(): Observable<Invoice[]> {
    return this.http.get<any[]>(`${this.baseUrl}/overdue`).pipe(
      map(list => list.map(mapToInvoice)),
      catchError(error => {
        this.errorService.handleError(error)
        return throwError(() => error)
      }),
    )
  }

  getTotalRevenue(startDate?: string, endDate?: string): Observable<number> {
    let params = new HttpParams()
    if (startDate) params = params.set('startDate', startDate)
    if (endDate) params = params.set('endDate', endDate)
    return this.http.get<number>(`${this.baseUrl}/revenue`, { params }).pipe(
      catchError(error => {
        this.errorService.handleError(error)
        return throwError(() => error)
      }),
    )
  }

  getPendingAmount(): Observable<number> {
    return this.http.get<number>(`${this.baseUrl}/pending-amount`).pipe(
      catchError(error => {
        this.errorService.handleError(error)
        return throwError(() => error)
      }),
    )
  }

  removeInvoice(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`).pipe(
      tap(() => this.alert.success('Éxito', 'Factura eliminada')),
      catchError(error => {
        this.errorService.handleError(error)
        return throwError(() => error)
      }),
    )
  }
}
