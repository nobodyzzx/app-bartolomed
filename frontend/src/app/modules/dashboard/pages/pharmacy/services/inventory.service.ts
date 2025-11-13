import { HttpClient, HttpParams } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { AlertService } from '@core/services/alert.service'
import { Observable, throwError } from 'rxjs'
import { catchError, map, tap } from 'rxjs/operators'
import { environment } from '../../../../../environments/environments'
import { ErrorService } from '../../../../../shared/components/services/error.service'
import {
  CreateMedicationDto,
  CreateMedicationStockDto,
  Medication,
  MedicationStock,
  UpdateMedicationStockDto,
} from '../interfaces/pharmacy.interfaces'

@Injectable({
  providedIn: 'root',
})
export class InventoryService {
  private readonly baseUrl = `${environment.baseUrl}/pharmacy/inventory`

  constructor(
    private http: HttpClient,
    private errorService: ErrorService,
    private alertService: AlertService,
  ) {}
  /**
   * INVENTARIO (STOCK)
   */
  // Alias para compatibilidad con NewSaleComponent
  getAllStock(clinicId: string): Observable<MedicationStock[]> {
    return this.getProducts(clinicId)
  }

  getProducts(clinicId: string): Observable<MedicationStock[]> {
    const params = new HttpParams().set('clinicId', clinicId)
    return this.http.get<MedicationStock[]>(`${this.baseUrl}/stock`, { params }).pipe(
      catchError(error => {
        this.errorService.handleError(error)
        return throwError(() => error)
      }),
    )
  }

  getLowStockProducts(clinicId: string): Observable<MedicationStock[]> {
    const params = new HttpParams().set('clinicId', clinicId)
    return this.http.get<MedicationStock[]>(`${this.baseUrl}/stock/low-stock`, { params }).pipe(
      catchError(error => {
        this.errorService.handleError(error)
        return throwError(() => error)
      }),
    )
  }

  getExpiringProducts(clinicId: string, days: number = 30): Observable<MedicationStock[]> {
    const params = new HttpParams().set('clinicId', clinicId).set('days', days.toString())
    return this.http.get<MedicationStock[]>(`${this.baseUrl}/stock/expiring`, { params }).pipe(
      catchError(error => {
        this.errorService.handleError(error)
        return throwError(() => error)
      }),
    )
  }

  getProductById(id: string): Observable<MedicationStock> {
    return this.http.get<MedicationStock>(`${this.baseUrl}/stock/${id}`).pipe(
      catchError(error => {
        this.errorService.handleError(error)
        return throwError(() => error)
      }),
    )
  }

  addProduct(dto: CreateMedicationStockDto): Observable<MedicationStock> {
    return this.http.post<MedicationStock>(`${this.baseUrl}/stock`, dto).pipe(
      tap(() => this.alertService.success('Éxito', 'Stock agregado correctamente')),
      catchError(error => {
        this.errorService.handleError(error)
        return throwError(() => error)
      }),
    )
  }

  updateProduct(id: string, dto: UpdateMedicationStockDto): Observable<MedicationStock> {
    return this.http.patch<MedicationStock>(`${this.baseUrl}/stock/${id}`, dto).pipe(
      tap(() => this.alertService.success('Éxito', 'Stock actualizado correctamente')),
      catchError(error => {
        this.errorService.handleError(error)
        return throwError(() => error)
      }),
    )
  }

  deleteProduct(id: string): Observable<boolean> {
    return this.http.delete<void>(`${this.baseUrl}/stock/${id}`).pipe(
      tap(() => this.alertService.success('Éxito', 'Stock eliminado correctamente')),
      map(() => true),
      catchError(error => {
        this.errorService.handleError(error)
        return throwError(() => false)
      }),
    )
  }

  getMedicationById(id: string): Observable<Medication> {
    return this.http.get<Medication>(`${this.baseUrl}/medications/${id}`).pipe(
      catchError(error => {
        this.errorService.handleError(error)
        return throwError(() => error)
      }),
    )
  }

  getAllMedications(): Observable<Medication[]> {
    return this.http.get<Medication[]>(`${this.baseUrl}/medications`).pipe(
      catchError(error => {
        this.errorService.handleError(error)
        return throwError(() => error)
      }),
    )
  }

  createMedication(dto: CreateMedicationDto): Observable<Medication> {
    return this.http.post<Medication>(`${this.baseUrl}/medications`, dto).pipe(
      tap(() => this.alertService.success('Éxito', 'Medicamento creado')),
      catchError(error => {
        this.errorService.handleError(error)
        return throwError(() => error)
      }),
    )
  }

  updateMedication(id: string, dto: Partial<CreateMedicationDto>): Observable<Medication> {
    return this.http.patch<Medication>(`${this.baseUrl}/medications/${id}`, dto).pipe(
      tap(() => this.alertService.success('Éxito', 'Medicamento actualizado')),
      catchError(error => {
        this.errorService.handleError(error)
        return throwError(() => error)
      }),
    )
  }

  deleteMedication(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/medications/${id}`).pipe(
      tap(() => this.alertService.success('Éxito', 'Medicamento eliminado')),
      catchError(error => {
        this.errorService.handleError(error)
        return throwError(() => error)
      }),
    )
  }
  /**
   * TRANSFERENCIAS ENTRE CLÍNICAS
   */
  transferStock(dto: {
    sourceStockId: string
    toClinicId: string
    quantity: number
    location?: string
    note?: string
  }): Observable<{ source: any; destination: any; transferred: number }> {
    return this.http
      .post<{
        source: any
        destination: any
        transferred: number
      }>(`${this.baseUrl}/stock/transfer`, dto)
      .pipe(
        tap(() => this.alertService.success('Éxito', 'Transferencia realizada')),
        catchError(error => {
          this.errorService.handleError(error)
          return throwError(() => error)
        }),
      )
  }
  // (código de mocks eliminado)
}
