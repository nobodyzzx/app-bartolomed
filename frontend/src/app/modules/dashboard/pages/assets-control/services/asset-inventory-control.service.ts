import { HttpClient } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { Observable } from 'rxjs'
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

  constructor(private http: HttpClient) {}

  getInventory(): Observable<AssetInventory[]> {
    return this.http.get<AssetInventory[]>(this.apiUrl)
  }

  getInventoryByLocation(location: string): Observable<AssetInventory[]> {
    return this.http.get<AssetInventory[]>(`${this.apiUrl}/location/${location}`)
  }

  getInventoryByDepartment(department: string): Observable<AssetInventory[]> {
    return this.http.get<AssetInventory[]>(`${this.apiUrl}/department/${department}`)
  }

  getInventoryByStatus(status: AssetStatus): Observable<AssetInventory[]> {
    return this.http.get<AssetInventory[]>(`${this.apiUrl}/status/${status}`)
  }

  getInventoryByCondition(condition: AssetCondition): Observable<AssetInventory[]> {
    return this.http.get<AssetInventory[]>(`${this.apiUrl}/condition/${condition}`)
  }

  updateInventory(id: string, data: UpdateInventoryDto): Observable<AssetInventory> {
    return this.http.patch<AssetInventory>(`${this.apiUrl}/${id}`, data)
  }

  performInspection(id: string): Observable<AssetInventory> {
    return this.http.post<AssetInventory>(`${this.apiUrl}/${id}/inspect`, {})
  }

  transferAsset(id: string, newLocation: string, newResponsible: string): Observable<AssetInventory> {
    return this.http.post<AssetInventory>(`${this.apiUrl}/${id}/transfer`, { newLocation, newResponsible })
  }

  adjustQuantity(id: string, quantity: number): Observable<AssetInventory> {
    return this.http.patch<AssetInventory>(`${this.apiUrl}/${id}/quantity`, { quantity })
  }

  getInventoryStats(): Observable<{
    total: number
    byStatus: Record<AssetStatus, number>
    byCondition: Record<AssetCondition, number>
    byLocation: Record<string, number>
    pendingInspections: number
  }> {
    return this.http.get<{
      total: number
      byStatus: Record<AssetStatus, number>
      byCondition: Record<AssetCondition, number>
      byLocation: Record<string, number>
      pendingInspections: number
    }>(`${this.apiUrl}/stats`)
  }

  getLowStockAssets(threshold: number = 2): Observable<AssetInventory[]> {
    return this.http.get<AssetInventory[]>(`${this.apiUrl}/low-stock`, {
      params: { threshold: threshold.toString() },
    })
  }

  getPendingInspections(): Observable<AssetInventory[]> {
    return this.http.get<AssetInventory[]>(`${this.apiUrl}/pending-inspections`)
  }
}
