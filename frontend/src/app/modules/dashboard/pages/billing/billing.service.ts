import { HttpClient, HttpParams } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { AlertService } from '@core/services/alert.service'
import { Observable, throwError } from 'rxjs'
import { catchError, tap } from 'rxjs/operators'
import { environment } from '../../../../environments/environments'
import { ErrorService } from '../../../../shared/components/services/error.service'

export interface InvoiceItemDto {
  description: string
  quantity: number
  unitPrice: number
  serviceCode?: string
  category?: string
}

export interface InvoiceDto {
  id?: string
  invoiceNumber: string
  status?: string
  issueDate: string
  dueDate: string
  taxRate?: number
  discountRate?: number
  discountAmount?: number
  notes?: string
  terms?: string
  isInsuranceClaim?: boolean
  insuranceProvider?: string
  insuranceClaimNumber?: string
  insuranceCoverage?: number
  patientId: string
  clinicId: string
  appointmentId?: string
  items: InvoiceItemDto[]
}

export interface PaymentDto {
  paymentNumber: string
  amount: number
  method: string
  status?: string
  paymentDate: string
  reference?: string
  transactionId?: string
  notes?: string
  invoiceId: string
}

export interface InvoiceResponse {
  id: string
  invoiceNumber: string
  status: string
  issueDate: string
  dueDate: string
  totalAmount: number
  taxRate?: number
  discountRate?: number
  discountAmount?: number
  notes?: string
  terms?: string
  patient?: { id: string; firstName: string; lastName: string }
  clinic?: { id: string; name: string }
  items: InvoiceItemDto[]
}

export interface PaymentResponse {
  id: string
  paymentNumber: string
  amount: number
  method: string
  status: string
  paymentDate: string
}

@Injectable({ providedIn: 'root' })
export class BillingService {
  private readonly base = environment.baseUrl

  constructor(
    private http: HttpClient,
    private errorService: ErrorService,
    private alert: AlertService,
  ) {}

  // Invoice methods
  listInvoices(page = 1, pageSize = 20, filter: any = {}): Observable<any> {
    let params = new HttpParams().set('page', String(page)).set('pageSize', String(pageSize))
    Object.keys(filter || {}).forEach(k => {
      if (filter[k] !== undefined && filter[k] !== null) params = params.set(k, String(filter[k]))
    })

    return this.http.get(`${this.base}/billing/invoices`, { params }).pipe(
      catchError(err => {
        this.errorService.handleError(err)
        return throwError(() => err)
      }),
    )
  }

  getInvoice(id: string): Observable<InvoiceResponse> {
    return this.http.get<InvoiceResponse>(`${this.base}/billing/invoices/${id}`).pipe(
      catchError(err => {
        this.errorService.handleError(err)
        return throwError(() => err)
      }),
    )
  }

  createInvoice(payload: InvoiceDto): Observable<InvoiceResponse> {
    return this.http.post<InvoiceResponse>(`${this.base}/billing/invoices`, payload).pipe(
      tap(() => this.alert.success('Éxito', 'Factura creada correctamente')),
      catchError(err => {
        this.errorService.handleError(err)
        return throwError(() => err)
      }),
    )
  }

  updateInvoice(id: string, payload: Partial<InvoiceDto>): Observable<any> {
    return this.http.patch(`${this.base}/billing/invoices/${id}`, payload).pipe(
      tap(() => this.alert.success('Éxito', 'Factura actualizada correctamente')),
      catchError(err => {
        this.errorService.handleError(err)
        return throwError(() => err)
      }),
    )
  }

  setInvoiceStatus(id: string, status: string): Observable<any> {
    return this.http.patch(`${this.base}/billing/invoices/${id}/status`, { status }).pipe(
      tap(() => this.alert.success('Éxito', 'Estado actualizado correctamente')),
      catchError(err => {
        this.errorService.handleError(err)
        return throwError(() => err)
      }),
    )
  }

  deleteInvoice(id: string): Observable<any> {
    return this.http.delete(`${this.base}/billing/invoices/${id}`).pipe(
      tap(() => this.alert.success('Éxito', 'Factura eliminada correctamente')),
      catchError(err => {
        this.errorService.handleError(err)
        return throwError(() => err)
      }),
    )
  }

  // Payment methods
  addPayment(payload: PaymentDto): Observable<PaymentResponse> {
    return this.http.post<PaymentResponse>(`${this.base}/billing/payments`, payload).pipe(
      tap(() => this.alert.success('Éxito', 'Pago registrado correctamente')),
      catchError(err => {
        this.errorService.handleError(err)
        return throwError(() => err)
      }),
    )
  }

  getPaymentsByInvoice(invoiceId: string): Observable<any> {
    return this.http.get(`${this.base}/billing/payments/invoice/${invoiceId}`).pipe(
      catchError(err => {
        this.errorService.handleError(err)
        return throwError(() => err)
      }),
    )
  }

  confirmPayment(id: string): Observable<any> {
    return this.http.patch(`${this.base}/billing/payments/${id}/confirm`, {}).pipe(
      tap(() => this.alert.success('Éxito', 'Pago confirmado correctamente')),
      catchError(err => {
        this.errorService.handleError(err)
        return throwError(() => err)
      }),
    )
  }

  cancelPayment(id: string): Observable<any> {
    return this.http.patch(`${this.base}/billing/payments/${id}/cancel`, {}).pipe(
      tap(() => this.alert.success('Éxito', 'Pago cancelado correctamente')),
      catchError(err => {
        this.errorService.handleError(err)
        return throwError(() => err)
      }),
    )
  }

  // Statistics
  getStatistics(clinicId?: string): Observable<any> {
    let params = new HttpParams()
    if (clinicId) params = params.set('clinicId', clinicId)

    return this.http.get(`${this.base}/billing/statistics`, { params }).pipe(
      catchError(err => {
        this.errorService.handleError(err)
        return throwError(() => err)
      }),
    )
  }

  // Utilities
  generateInvoiceNumber(): Observable<string> {
    return (
      this.http.get(`${this.base}/billing/generate/invoice-number`, {
        responseType: 'text' as 'json',
      }) as Observable<string>
    ).pipe(
      catchError(err => {
        this.errorService.handleError(err)
        return throwError(() => err)
      }),
    )
  }

  generatePaymentNumber(): Observable<string> {
    return (
      this.http.get(`${this.base}/billing/generate/payment-number`, {
        responseType: 'text' as 'json',
      }) as Observable<string>
    ).pipe(
      catchError(err => {
        this.errorService.handleError(err)
        return throwError(() => err)
      }),
    )
  }
}
