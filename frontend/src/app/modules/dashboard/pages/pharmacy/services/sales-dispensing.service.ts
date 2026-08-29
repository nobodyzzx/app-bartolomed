import { HttpClient, HttpParams } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { AlertService } from '@core/services/alert.service'
import { Observable } from 'rxjs'
import { catchError, tap } from 'rxjs/operators'
import { environment } from '../../../../../environments/environments'
import { ErrorService } from '../../../../../shared/components/services/error.service'
import { CreateSaleDto, PaginatedResult, Sale, SaleStatus } from '../interfaces/pharmacy.interfaces'

export interface SalesSummary {
  totalSales: number
  completedSales: number
  pendingSales: number
  cancelledSales: number
  totalRevenue: number
  dateRange?: { startDate: string; endDate: string }
}

@Injectable({
  providedIn: 'root',
})
export class SalesDispensingService {
  private apiUrl = `${environment.baseUrl}/pharmacy-sales`

  constructor(
    private http: HttpClient,
    private errorService: ErrorService,
    private alertService: AlertService,
  ) {}

  /**
   * `search`, `paymentMethod`, el rango de fechas y el orden van al backend:
   * resolverlos en el cliente solo alcanzaba las filas de la página cargada,
   * así que buscar algo de la página 3 no encontraba nada y ordenar reordenaba
   * un recorte haciéndolo pasar por la lista entera.
   */
  getSales(
    options: {
      page?: number
      limit?: number
      status?: SaleStatus
      search?: string
      paymentMethod?: string
      startDate?: string
      endDate?: string
      /** Debe ser una de las columnas que el backend acepta en su lista blanca. */
      sortBy?: string
      sortDir?: 'ASC' | 'DESC'
    } = {},
  ): Observable<PaginatedResult<Sale>> {
    const params = new HttpParams({
      fromObject: Object.entries(options).reduce<Record<string, string>>((acc, [k, v]) => {
        if (v !== undefined && v !== null && `${v}`.trim() !== '') acc[k] = `${v}`
        return acc
      }, {}),
    })
    const query = params.toString()
    const url = query ? `${this.apiUrl}?${query}` : this.apiUrl
    return this.http.get<PaginatedResult<Sale>>(url).pipe(
      catchError(error => {
        this.errorService.handleError(error)
        throw error
      }),
    )
  }

  getCompletedSalesFiltered(options: {
    paymentMethod?: string
    startDate?: Date
    endDate?: Date
    page?: number
    limit?: number
  }): Observable<PaginatedResult<Sale>> {
    const params: string[] = ['status=completed']
    if (options.paymentMethod) params.push(`paymentMethod=${options.paymentMethod}`)
    if (options.startDate) params.push(`startDate=${options.startDate.toISOString()}`)
    if (options.endDate) params.push(`endDate=${options.endDate.toISOString()}`)
    if (options.page) params.push(`page=${options.page}`)
    if (options.limit) params.push(`limit=${options.limit}`)
    const url = `${this.apiUrl}?${params.join('&')}`
    return this.http.get<PaginatedResult<Sale>>(url).pipe(
      catchError(error => {
        this.errorService.handleError(error)
        throw error
      }),
    )
  }

  getSalesSummary(startDate?: Date, endDate?: Date): Observable<SalesSummary> {
    const params: string[] = []
    if (startDate) params.push(`startDate=${startDate.toISOString()}`)
    if (endDate) params.push(`endDate=${endDate.toISOString()}`)
    const url = `${this.apiUrl}/summary${params.length ? '?' + params.join('&') : ''}`
    return this.http.get<SalesSummary>(url).pipe(
      catchError(error => {
        this.errorService.handleError(error)
        throw error
      }),
    )
  }

  getSaleById(id: string): Observable<Sale> {
    return this.http.get<Sale>(`${this.apiUrl}/${id}`).pipe(
      catchError(error => {
        this.errorService.handleError(error)
        throw error
      }),
    )
  }

  /**
   * Antes esta pantalla imprimía su propia página (window.print(), con menús
   * y botones incluidos) en vez de un comprobante real — esto trae el PDF
   * que genera el backend, mismo mecanismo que el recibo del punto de cobro.
   */
  downloadReceipt(id: string): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/${id}/receipt`, { responseType: 'blob' }).pipe(
      catchError(error => {
        this.errorService.handleError(error)
        throw error
      }),
    )
  }

  createSale(dto: CreateSaleDto): Observable<Sale> {
    return this.http.post<Sale>(this.apiUrl, dto).pipe(
      tap(() => this.alertService.success('Éxito', 'Venta registrada correctamente')),
      catchError(error => {
        this.errorService.handleError(error)
        throw error
      }),
    )
  }

  updateSaleStatus(id: string, status: SaleStatus, notes?: string): Observable<Sale> {
    return this.http.patch<Sale>(`${this.apiUrl}/${id}/status`, { status, notes }).pipe(
      tap(() => this.alertService.success('Éxito', 'Estado actualizado')),
      catchError(error => {
        this.errorService.handleError(error)
        throw error
      }),
    )
  }

  deleteSale(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(
      tap(() => this.alertService.success('Éxito', 'Venta eliminada')),
      catchError(error => {
        this.errorService.handleError(error)
        throw error
      }),
    )
  }
}
