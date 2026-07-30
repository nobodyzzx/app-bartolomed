import { HttpClient } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { AlertService } from '@core/services/alert.service'
import { Observable, throwError } from 'rxjs'
import { catchError, tap } from 'rxjs/operators'
import { environment } from '../../../../../environments/environments'
import {
  AssetMaintenance,
  CreateMaintenanceDto,
  MaintenanceFilters,
  MaintenanceStatus,
  MaintenanceType,
  UpdateMaintenanceDto,
} from '../interfaces/assets.interfaces'

@Injectable({
  providedIn: 'root',
})
export class AssetMaintenanceService {
  private apiUrl = `${environment.baseUrl}/assets/maintenance`

  constructor(
    private http: HttpClient,
    private alert: AlertService,
  ) {}

  getMaintenanceRecords(filters?: MaintenanceFilters): Observable<AssetMaintenance[]> {
    const params: any = {}

    if (filters) {
      if (filters.assetId) params.assetId = filters.assetId
      if (filters.status) params.status = filters.status
      if (filters.type) params.type = filters.type
      if (filters.dateFrom) params.dateFrom = filters.dateFrom.toISOString()
      if (filters.dateTo) params.dateTo = filters.dateTo.toISOString()
    }

    return this.http
      .get<AssetMaintenance[]>(this.apiUrl, { params })
      .pipe(catchError(error => { this.alert.error('Error al cargar mantenimientos'); return throwError(() => error) }))
  }

  getMaintenanceById(id: string): Observable<AssetMaintenance> {
    return this.http
      .get<AssetMaintenance>(`${this.apiUrl}/${id}`)
      .pipe(catchError(error => { this.alert.error('Error al cargar el mantenimiento'); return throwError(() => error) }))
  }

  createMaintenance(maintenanceData: CreateMaintenanceDto): Observable<AssetMaintenance> {
    return this.http.post<AssetMaintenance>(this.apiUrl, maintenanceData).pipe(
      tap(() =>
        this.alert.fire({
          icon: 'success',
          title: 'Mantenimiento Programado',
          text: 'El mantenimiento se ha programado correctamente',
          timer: 2000,
          showConfirmButton: false,
        }),
      ),
      catchError(error => {
        this.alert.error('Error al crear mantenimiento')
        return throwError(() => error)
      }),
    )
  }

  updateMaintenance(
    id: string,
    maintenanceData: UpdateMaintenanceDto,
  ): Observable<AssetMaintenance> {
    return this.http.patch<AssetMaintenance>(`${this.apiUrl}/${id}`, maintenanceData).pipe(
      tap(() =>
        this.alert.fire({
          icon: 'success',
          title: 'Estado Actualizado',
          text: 'El estado del mantenimiento se ha actualizado',
          timer: 1500,
          showConfirmButton: false,
        }),
      ),
      catchError(error => {
        this.alert.error('Error al actualizar mantenimiento')
        return throwError(() => error)
      }),
    )
  }

  deleteMaintenance(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(
      tap(() =>
        this.alert.fire({
          icon: 'success',
          title: 'Mantenimiento Eliminado',
          text: 'El registro se ha eliminado correctamente',
          timer: 2000,
          showConfirmButton: false,
        }),
      ),
      catchError(error => {
        this.alert.error('Error al eliminar mantenimiento')
        return throwError(() => error)
      }),
    )
  }

  getUpcomingMaintenance(days: number = 30): Observable<AssetMaintenance[]> {
    return this.http
      .get<AssetMaintenance[]>(`${this.apiUrl}/upcoming`, {
        params: { days: days.toString() },
      })
      .pipe(catchError(error => { this.alert.error('Error al cargar mantenimientos próximos'); return throwError(() => error) }))
  }

  getOverdueMaintenance(): Observable<AssetMaintenance[]> {
    return this.http
      .get<AssetMaintenance[]>(`${this.apiUrl}/overdue`)
      .pipe(catchError(error => { this.alert.error('Error al cargar mantenimientos vencidos'); return throwError(() => error) }))
  }

  getMaintenanceStats(): Observable<{
    total: number
    completed: number
    scheduled: number
    inProgress: number
    overdue: number
    totalCost: number
  }> {
    return this.http
      .get<{
        total: number
        completed: number
        scheduled: number
        inProgress: number
        overdue: number
        totalCost: number
      }>(`${this.apiUrl}/stats`)
      .pipe(catchError(error => { this.alert.error('Error al cargar estadísticas de mantenimiento'); return throwError(() => error) }))
  }

  getMaintenanceByAsset(assetId: string): Observable<AssetMaintenance[]> {
    return this.http
      .get<AssetMaintenance[]>(`${this.apiUrl}/asset/${assetId}`)
      .pipe(catchError(error => { this.alert.error('Error al cargar mantenimientos del activo'); return throwError(() => error) }))
  }

  getMaintenanceByStatus(status: MaintenanceStatus): Observable<AssetMaintenance[]> {
    return this.http
      .get<AssetMaintenance[]>(`${this.apiUrl}/status/${status}`)
      .pipe(catchError(error => { this.alert.error('Error al filtrar por estado'); return throwError(() => error) }))
  }

  getMaintenanceByType(type: MaintenanceType): Observable<AssetMaintenance[]> {
    return this.http
      .get<AssetMaintenance[]>(`${this.apiUrl}/type/${type}`)
      .pipe(catchError(error => { this.alert.error('Error al filtrar por tipo'); return throwError(() => error) }))
  }

  schedulePreventiveMaintenance(
    assetId: string,
    intervalMonths: number,
  ): Observable<AssetMaintenance[]> {
    return this.http
      .post<AssetMaintenance[]>(`${this.apiUrl}/schedule-preventive`, {
        assetId,
        intervalMonths,
      })
      .pipe(
        tap(() => this.alert.success('Mantenimiento preventivo programado')),
        catchError(error => {
          this.alert.error('Error al programar mantenimiento preventivo')
          return throwError(() => error)
        }),
      )
  }
}
