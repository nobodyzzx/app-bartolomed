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

  getReports(): Observable<AssetReport[]> {
    return this.http.get<AssetReport[]>(this.apiUrl).pipe(
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

  getReportsByType(type: ReportType): Observable<AssetReport[]> {
    return this.http.get<AssetReport[]>(`${this.apiUrl}/type/${type}`).pipe(
      catchError(error => {
        this.alert.error('Error al filtrar reportes por tipo')
        return throwError(() => error)
      }),
    )
  }

  getReportsByStatus(status: ReportStatus): Observable<AssetReport[]> {
    return this.http.get<AssetReport[]>(`${this.apiUrl}/status/${status}`).pipe(
      catchError(error => {
        this.alert.error('Error al filtrar reportes por estado')
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

  scheduleReport(reportData: GenerateReportDto & { schedule: string }): Observable<AssetReport> {
    return this.http.post<AssetReport>(`${this.apiUrl}/schedule`, reportData).pipe(
      tap(() => this.alert.success('Reporte programado')),
      catchError(error => {
        this.alert.error('Error al programar el reporte')
        return throwError(() => error)
      }),
    )
  }
}
