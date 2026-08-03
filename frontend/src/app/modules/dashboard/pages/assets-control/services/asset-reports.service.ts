import { HttpClient } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { AlertService } from '@core/services/alert.service'
import { Observable, throwError } from 'rxjs'
import { catchError, tap } from 'rxjs/operators'
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

  constructor(
    private http: HttpClient,
    private alert: AlertService,
  ) {}

  // Antes había endpoints separados getReportsByType()/getReportsByStatus()
  // (/assets/reports/type/:x, /status/:x) que nunca existieron en el backend
  // — 404 real al hacer click en las tarjetas de filtro. GET /assets/reports
  // ya soporta status/type como query params.
  getReports(filters?: { status?: ReportStatus; type?: ReportType }): Observable<AssetReport[]> {
    const params: any = {}
    if (filters?.status) params.status = filters.status
    if (filters?.type) params.type = filters.type

    return this.http.get<AssetReport[]>(this.apiUrl, { params }).pipe(
      catchError(error => {
        this.alert.error('Error al cargar los reportes de activos')
        return throwError(() => error)
      }),
    )
  }

  getReportById(id: string): Observable<AssetReport> {
    return this.http.get<AssetReport>(`${this.apiUrl}/${id}`).pipe(
      catchError(error => {
        this.alert.error('Error al cargar el reporte')
        return throwError(() => error)
      }),
    )
  }

  generateReport(reportData: GenerateReportDto): Observable<AssetReport> {
    return this.http.post<AssetReport>(`${this.apiUrl}/generate`, reportData).pipe(
      tap(() =>
        this.alert.fire({
          icon: 'success',
          title: 'Reporte Generado',
          text: 'El reporte se ha generado correctamente',
          timer: 2000,
          showConfirmButton: false,
        }),
      ),
      catchError(error => {
        this.alert.error('Error al generar el reporte')
        return throwError(() => error)
      }),
    )
  }

  downloadReport(id: string): Observable<Blob> {
    return this.http
      .get(`${this.apiUrl}/${id}/download`, {
        responseType: 'blob',
      })
      .pipe(
        catchError(error => {
          this.alert.error('Error al descargar el reporte')
          return throwError(() => error)
        }),
      )
  }

  deleteReport(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(
      tap(() =>
        this.alert.fire({
          icon: 'success',
          title: 'Reporte Eliminado',
          text: 'El reporte se ha eliminado correctamente',
          timer: 2000,
          showConfirmButton: false,
        }),
      ),
      catchError(error => {
        this.alert.error('Error al eliminar el reporte')
        return throwError(() => error)
      }),
    )
  }

  getReportStats(): Observable<{
    total: number
    byType: Record<ReportType, number>
    byStatus: Record<ReportStatus, number>
    recentReports: number
  }> {
    return this.http
      .get<{
        total: number
        byType: Record<ReportType, number>
        byStatus: Record<ReportStatus, number>
        recentReports: number
      }>(`${this.apiUrl}/stats`)
      .pipe(
        catchError(error => {
          this.alert.error('Error al cargar estadísticas de reportes')
          return throwError(() => error)
        }),
      )
  }
}
