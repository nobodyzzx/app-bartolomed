import { HttpClient } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { AlertService } from '@core/services/alert.service'
import { Observable, throwError } from 'rxjs'
import { catchError, tap } from 'rxjs/operators'
import { environment } from '../../../../../environments/environments'
import {
  AssetCondition,
  AssetInventory,
  AssetStatus,
  UpdateInventoryDto,
} from '../interfaces/assets.interfaces'

@Injectable({ providedIn: 'root' })
export class AssetInventoryControlService {
  private apiUrl = `${environment.baseUrl}/assets/inventory`

  constructor(
    private http: HttpClient,
    private alert: AlertService,
  ) {}

  getInventory(): Observable<AssetInventory[]> {
    return this.http.get<AssetInventory[]>(this.apiUrl).pipe(
      catchError(error => {
        this.alert.error('Error al cargar el inventario')
        return throwError(() => error)
      }),
    )
  }

  getInventoryByLocation(location: string): Observable<AssetInventory[]> {
    return this.http.get<AssetInventory[]>(`${this.apiUrl}/location/${location}`).pipe(
      catchError(error => {
        this.alert.error('Error al filtrar inventario por ubicación')
        return throwError(() => error)
      }),
    )
  }

  getInventoryByDepartment(department: string): Observable<AssetInventory[]> {
    return this.http.get<AssetInventory[]>(`${this.apiUrl}/department/${department}`).pipe(
      catchError(error => {
        this.alert.error('Error al filtrar inventario por departamento')
        return throwError(() => error)
      }),
    )
  }

  getInventoryByStatus(status: AssetStatus): Observable<AssetInventory[]> {
    return this.http.get<AssetInventory[]>(`${this.apiUrl}/status/${status}`).pipe(
      catchError(error => {
        this.alert.error('Error al filtrar inventario por estado')
        return throwError(() => error)
      }),
    )
  }

  getInventoryByCondition(condition: AssetCondition): Observable<AssetInventory[]> {
    return this.http.get<AssetInventory[]>(`${this.apiUrl}/condition/${condition}`).pipe(
      catchError(error => {
        this.alert.error('Error al filtrar inventario por condición')
        return throwError(() => error)
      }),
    )
  }

  updateInventory(id: string, data: UpdateInventoryDto): Observable<AssetInventory> {
    return this.http.patch<AssetInventory>(`${this.apiUrl}/${id}`, data).pipe(
      tap(() => this.alert.success('Inventario actualizado')),
      catchError(error => {
        this.alert.error('Error al actualizar el inventario')
        return throwError(() => error)
      }),
    )
  }

  performInspection(id: string): Observable<AssetInventory> {
    return this.http.post<AssetInventory>(`${this.apiUrl}/${id}/inspect`, {}).pipe(
      tap(() => this.alert.success('Inspección registrada')),
      catchError(error => {
        this.alert.error('Error al registrar la inspección')
        return throwError(() => error)
      }),
    )
  }

  transferAsset(id: string, newLocation: string, newResponsible: string): Observable<AssetInventory> {
    return this.http.post<AssetInventory>(`${this.apiUrl}/${id}/transfer`, { newLocation, newResponsible }).pipe(
      tap(() => this.alert.success('Activo transferido')),
      catchError(error => {
        this.alert.error('Error al transferir el activo')
        return throwError(() => error)
      }),
    )
  }

  adjustQuantity(id: string, quantity: number): Observable<AssetInventory> {
    return this.http.patch<AssetInventory>(`${this.apiUrl}/${id}/quantity`, { quantity }).pipe(
      tap(() => this.alert.success('Cantidad ajustada')),
      catchError(error => {
        this.alert.error('Error al ajustar la cantidad')
        return throwError(() => error)
      }),
    )
  }

  getInventoryStats(): Observable<{
    total: number
    byStatus: Record<AssetStatus, number>
    byCondition: Record<AssetCondition, number>
    byLocation: Record<string, number>
    pendingInspections: number
  }> {
    return this.http
      .get<{
        total: number
        byStatus: Record<AssetStatus, number>
        byCondition: Record<AssetCondition, number>
        byLocation: Record<string, number>
        pendingInspections: number
      }>(`${this.apiUrl}/stats`)
      .pipe(
        catchError(error => {
          this.alert.error('Error al cargar estadísticas de inventario')
          return throwError(() => error)
        }),
      )
  }

  getLowStockAssets(threshold: number = 2): Observable<AssetInventory[]> {
    return this.http
      .get<AssetInventory[]>(`${this.apiUrl}/low-stock`, {
        params: { threshold: threshold.toString() },
      })
      .pipe(
        catchError(error => {
          this.alert.error('Error al cargar activos con bajo stock')
          return throwError(() => error)
        }),
      )
  }

  getPendingInspections(): Observable<AssetInventory[]> {
    return this.http.get<AssetInventory[]>(`${this.apiUrl}/pending-inspections`).pipe(
      catchError(error => {
        this.alert.error('Error al cargar inspecciones pendientes')
        return throwError(() => error)
      }),
    )
  }
}
