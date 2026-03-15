import { HttpClient } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { Observable } from 'rxjs'
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

  constructor(private http: HttpClient) {}

  getMaintenanceRecords(filters?: MaintenanceFilters): Observable<AssetMaintenance[]> {
    const params: any = {}

    if (filters) {
      if (filters.assetId) params.assetId = filters.assetId
      if (filters.status) params.status = filters.status
      if (filters.type) params.type = filters.type
      if (filters.dateFrom) params.dateFrom = filters.dateFrom.toISOString()
      if (filters.dateTo) params.dateTo = filters.dateTo.toISOString()
    }

    return this.http.get<AssetMaintenance[]>(this.apiUrl, { params })
  }

  getMaintenanceById(id: string): Observable<AssetMaintenance> {
    return this.http.get<AssetMaintenance>(`${this.apiUrl}/${id}`)
  }

  createMaintenance(maintenanceData: CreateMaintenanceDto): Observable<AssetMaintenance> {
    return this.http.post<AssetMaintenance>(this.apiUrl, maintenanceData)
  }

  updateMaintenance(
    id: string,
    maintenanceData: UpdateMaintenanceDto,
  ): Observable<AssetMaintenance> {
    return this.http.patch<AssetMaintenance>(`${this.apiUrl}/${id}`, maintenanceData)
  }

  deleteMaintenance(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`)
  }

  getUpcomingMaintenance(days: number = 30): Observable<AssetMaintenance[]> {
    return this.http.get<AssetMaintenance[]>(`${this.apiUrl}/upcoming`, {
      params: { days: days.toString() },
    })
  }

  getOverdueMaintenance(): Observable<AssetMaintenance[]> {
    return this.http.get<AssetMaintenance[]>(`${this.apiUrl}/overdue`)
  }

  getMaintenanceStats(): Observable<{
    total: number
    completed: number
    scheduled: number
    inProgress: number
    overdue: number
    totalCost: number
  }> {
    return this.http.get<{
      total: number
      completed: number
      scheduled: number
      inProgress: number
      overdue: number
      totalCost: number
    }>(`${this.apiUrl}/stats`)
  }

  getMaintenanceByAsset(assetId: string): Observable<AssetMaintenance[]> {
    return this.http.get<AssetMaintenance[]>(`${this.apiUrl}/asset/${assetId}`)
  }

  getMaintenanceByStatus(status: MaintenanceStatus): Observable<AssetMaintenance[]> {
    return this.http.get<AssetMaintenance[]>(`${this.apiUrl}/status/${status}`)
  }

  getMaintenanceByType(type: MaintenanceType): Observable<AssetMaintenance[]> {
    return this.http.get<AssetMaintenance[]>(`${this.apiUrl}/type/${type}`)
  }

  schedulePreventiveMaintenance(
    assetId: string,
    intervalMonths: number,
  ): Observable<AssetMaintenance[]> {
    return this.http.post<AssetMaintenance[]>(`${this.apiUrl}/schedule-preventive`, {
      assetId,
      intervalMonths,
    })
  }
}
