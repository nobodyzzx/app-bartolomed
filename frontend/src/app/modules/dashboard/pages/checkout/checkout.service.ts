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

/**
 * Cargo agregado a mano desde el punto de cobro. El concepto y el precio salen
 * siempre del tarifario (`servicePriceId`), nunca se escriben: así todo ingreso
 * queda trazable a una tarifa y nadie inventa precios en caja.
 */
export interface NewChargePayload {
  /** Ausente para un cobro sin paciente registrado (walk-in). */
  patientId?: string
  patientName: string
  origin: ChargeOrigin
  servicePriceId: string
  description: string
  quantity: number
  listPrice: number
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

/**
 * Las únicas dos formas de pago que la clínica maneja. Es la lista que usan
 * TANTO el punto de cobro como farmacia: antes cada uno tenía la suya y se
 * desincronizaron — el punto de cobro ofrecía tarjeta, transferencia y seguro,
 * que no se usan, y en cambio no ofrecía QR, que sí.
 *
 * Los valores en desuso siguen existiendo en la base de datos porque hay pagos
 * históricos con ellos (ver el enum `PaymentMethod` del backend); simplemente
 * ya no se pueden elegir.
 */
export const PAYMENT_METHODS = [
  { value: 'cash', label: 'Efectivo', icon: 'payments' },
  { value: 'qr', label: 'QR', icon: 'qr_code' },
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

  /**
   * Agrega un cargo suelto a la cuenta del paciente, tomado del tarifario.
   *
   * Cubre lo que no nace de una consulta ni de una orden de laboratorio: alguien
   * que llega solo a que le tomen la presión, una curación, una inyección. No es
   * una factura manual —esas se quitaron a propósito, porque sin cargos detrás
   * no aparecen en el control de ingresos— sino un cargo más, que sigue el mismo
   * camino que los demás: cuenta del paciente, descuento con motivo, cobro,
   * factura y reporte.
   */
  addCharge(payload: NewChargePayload): Observable<Charge> {
    return this.http.post<Charge>(`${this.base}/charges`, payload).pipe(
      tap(() => this.alert.success('Cargo agregado', 'Se sumó a la cuenta del paciente')),
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
