import { HttpClient } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { AlertService } from '@core/services/alert.service'
import { Observable } from 'rxjs'
import { catchError, tap } from 'rxjs/operators'
import { environment } from '../../../../../environments/environments'
import { ErrorService } from '../../../../../shared/components/services/error.service'
import { CreateSaleDto, Sale, SaleStatus } from '../interfaces/pharmacy.interfaces'

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

  getSales(): Observable<Sale[]> {
    return this.http.get<Sale[]>(this.apiUrl).pipe(
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
