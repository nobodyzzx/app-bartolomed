import { HttpClient } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { Observable } from 'rxjs'
import { environment } from '../../../../../environments/environments'
import {
  AssetReport,
  GenerateReportDto,
  ReportStatus,
  ReportType,
} from '../interfaces/assets.interfaces'

@Injectable({
  providedIn: 'root',
})
export class AssetReportsService {
  private apiUrl = `${environment.baseUrl}/assets/reports`

  constructor(private http: HttpClient) {}

  getReports(): Observable<AssetReport[]> {
    return this.http.get<AssetReport[]>(this.apiUrl)
  }

  getReportById(id: string): Observable<AssetReport> {
    return this.http.get<AssetReport>(`${this.apiUrl}/${id}`)
  }

  getReportsByType(type: ReportType): Observable<AssetReport[]> {
    return this.http.get<AssetReport[]>(`${this.apiUrl}/type/${type}`)
  }

  getReportsByStatus(status: ReportStatus): Observable<AssetReport[]> {
    return this.http.get<AssetReport[]>(`${this.apiUrl}/status/${status}`)
  }

  generateReport(reportData: GenerateReportDto): Observable<AssetReport> {
    return this.http.post<AssetReport>(`${this.apiUrl}/generate`, reportData)
  }

  downloadReport(id: string): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/${id}/download`, {
      responseType: 'blob',
    })
  }

  deleteReport(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`)
  }

  getReportStats(): Observable<{
    total: number
    byType: Record<ReportType, number>
    byStatus: Record<ReportStatus, number>
    recentReports: number
  }> {
    return this.http.get<{
      total: number
      byType: Record<ReportType, number>
      byStatus: Record<ReportStatus, number>
      recentReports: number
    }>(`${this.apiUrl}/stats`)
  }

  scheduleReport(reportData: GenerateReportDto & { schedule: string }): Observable<AssetReport> {
    return this.http.post<AssetReport>(`${this.apiUrl}/schedule`, reportData)
  }
}
