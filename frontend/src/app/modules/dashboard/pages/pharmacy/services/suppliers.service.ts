import { HttpClient } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { AlertService } from '@core/services/alert.service'
import { Observable, throwError } from 'rxjs'
import { catchError, tap } from 'rxjs/operators'
import { environment } from '../../../../../environments/environments'
import { ErrorService } from '../../../../../shared/components/services/error.service'
import { CreateSupplierDto, Supplier, UpdateSupplierDto } from '../interfaces/pharmacy.interfaces'

@Injectable({ providedIn: 'root' })
export class SuppliersService {
  private readonly baseUrl = `${environment.baseUrl}/pharmacy/suppliers`

  constructor(
    private http: HttpClient,
    private errorService: ErrorService,
    private alert: AlertService,
  ) {}

  getAll(): Observable<Supplier[]> {
    return this.http.get<Supplier[]>(this.baseUrl).pipe(
      catchError(error => {
        this.errorService.handleError(error)
        return throwError(() => error)
      }),
    )
  }

  getById(id: string): Observable<Supplier> {
    return this.http.get<Supplier>(`${this.baseUrl}/${id}`).pipe(
      catchError(error => {
        this.errorService.handleError(error)
        return throwError(() => error)
      }),
    )
  }

  create(dto: CreateSupplierDto): Observable<Supplier> {
    return this.http.post<Supplier>(this.baseUrl, dto).pipe(
      tap(() => this.alert.success('Éxito', 'Proveedor creado')),
      catchError(error => {
        this.errorService.handleError(error)
        return throwError(() => error)
      }),
    )
  }

  update(id: string, dto: UpdateSupplierDto): Observable<Supplier> {
    return this.http.patch<Supplier>(`${this.baseUrl}/${id}`, dto).pipe(
      tap(() => this.alert.success('Éxito', 'Proveedor actualizado')),
      catchError(error => {
        this.errorService.handleError(error)
        return throwError(() => error)
      }),
    )
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`).pipe(
      tap(() => this.alert.success('Éxito', 'Proveedor eliminado')),
      catchError(error => {
        this.errorService.handleError(error)
        return throwError(() => error)
      }),
    )
  }

  restore(id: string): Observable<Supplier> {
    return this.http.patch<Supplier>(`${this.baseUrl}/${id}/restore`, {}).pipe(
      tap(() => this.alert.success('Éxito', 'Proveedor restaurado')),
      catchError(error => {
        this.errorService.handleError(error)
        return throwError(() => error)
      }),
    )
  }
}
