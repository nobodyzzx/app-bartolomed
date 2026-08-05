import { HttpClient } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { AlertService } from '@core/services/alert.service'
import { Observable, throwError } from 'rxjs'
import { catchError, tap } from 'rxjs/operators'
import { environment } from '../../../../environments/environments'
import { ErrorService } from '../../../../shared/components/services/error.service'

export enum ChargeOrigin {
  CONSULTATION = 'consultation',
  LABORATORY = 'laboratory',
  PHARMACY = 'pharmacy',
  OTHER = 'other',
}

/**
 * Cómo se imprime el descuento en el recibo. **No cambia ningún importe**:
 * en ambos modos se guarda y se reporta exactamente lo mismo.
 */
export enum DiscountDisplay {
  /** Precios de lista y una fila "Descuento" al pie. */
  ITEMIZED = 'itemized',
  /** El unitario impreso ya viene neto; no se menciona el descuento. */
  ABSORBED = 'absorbed',
}

export interface Charge {
  id: string
  description: string
  origin: ChargeOrigin
  quantity: number
  listPrice: number
  unitPrice: number
  discountAmount: number
  total: number
  patientName: string | null
  createdAt: string
}

export interface PatientAccount {
  items: Charge[]
  total: number
  amount: number
}

export interface CheckoutPayload {
  chargeIds: string[]
  lineDiscounts?: { chargeId: string; amount: number; reason: string }[]
  globalDiscount?: { amount: number; reason: string }
  discountDisplay?: DiscountDisplay
  payment?: { method: string; amount: number; reference?: string }
  notes?: string
}

export interface CheckoutResult {
  id: string
  invoiceNumber: string
  subtotal: number
  discountAmount: number
  totalAmount: number
  paidAmount: number
  remainingAmount: number
  status: string
}

export const ORIGIN_LABELS: Record<ChargeOrigin, string> = {
  [ChargeOrigin.CONSULTATION]: 'Consulta',
  [ChargeOrigin.LABORATORY]: 'Laboratorio',
  [ChargeOrigin.PHARMACY]: 'Farmacia',
  [ChargeOrigin.OTHER]: 'Otro',
}

export const PAYMENT_METHODS = [
  { value: 'cash', label: 'Efectivo' },
  { value: 'debit_card', label: 'Tarjeta de débito' },
  { value: 'credit_card', label: 'Tarjeta de crédito' },
  { value: 'bank_transfer', label: 'Transferencia' },
  { value: 'insurance', label: 'Seguro' },
  { value: 'other', label: 'Otro' },
]

@Injectable({ providedIn: 'root' })
export class CheckoutService {
  private readonly base = environment.baseUrl

  constructor(
    private http: HttpClient,
    private errorService: ErrorService,
    private alert: AlertService,
  ) {}

  /** Cuenta abierta del paciente: sus cargos pendientes de cobro. */
  getAccount(patientId: string): Observable<PatientAccount> {
    return this.http.get<PatientAccount>(`${this.base}/charges/patient/${patientId}/pending`).pipe(
      catchError(err => {
        this.errorService.handleError(err)
        return throwError(() => err)
      }),
    )
  }

  checkout(payload: CheckoutPayload): Observable<CheckoutResult> {
    return this.http.post<CheckoutResult>(`${this.base}/billing/checkout`, payload).pipe(
      tap(() => this.alert.success('Cobro registrado', 'La factura se emitió correctamente')),
      catchError(err => {
        this.errorService.handleError(err)
        return throwError(() => err)
      }),
    )
  }

  downloadReceipt(invoiceId: string, display: DiscountDisplay): Observable<Blob> {
    return this.http
      .get(`${this.base}/billing/invoices/${invoiceId}/receipt`, {
        params: { display },
        responseType: 'blob',
      })
      .pipe(
        catchError(err => {
          this.errorService.handleError(err)
          return throwError(() => err)
        }),
      )
  }
}
