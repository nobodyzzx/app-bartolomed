import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import {
    AssetReport,
    GenerateReportDto,
    ReportStatus,
    ReportType
} from '../interfaces/assets.interfaces';

@Injectable({
  providedIn: 'root'
})
export class AssetReportsService {
  private apiUrl = '/api/assets/reports';

  constructor(private http: HttpClient) {}

  // Mock data
  private mockReports: AssetReport[] = [
    {
      id: 'RPT-001',
      title: 'Informe de Activos por Ubicación',
      type: ReportType.LOCATION,
      description: 'Distribución de activos por ubicación física',
      date: new Date('2025-09-03'),
      generatedBy: 'Admin Sistema',
      status: ReportStatus.COMPLETED,
      filePath: '/reports/assets-by-location-2025-09-03.pdf',
      createdAt: new Date('2025-09-03')
    },
    {
      id: 'RPT-002',
      title: 'Inventario de Activos Obsoletos',
      type: ReportType.OBSOLETE,
      description: 'Lista de activos programados para reemplazo o baja',
      date: new Date('2025-08-30'),
      generatedBy: 'Ing. Luis Ramírez',
      status: ReportStatus.COMPLETED,
      filePath: '/reports/obsolete-assets-2025-08-30.pdf',
      createdAt: new Date('2025-08-30')
    },
    {
      id: 'RPT-003',
      title: 'Reporte de Mantenimientos del Mes',
      type: ReportType.MAINTENANCE,
      description: 'Resumen de mantenimientos realizados en agosto 2025',
      date: new Date('2025-08-31'),
      generatedBy: 'Téc. Roberto Silva',
      status: ReportStatus.COMPLETED,
      filePath: '/reports/maintenance-august-2025.pdf',
      createdAt: new Date('2025-08-31')
    },
    {
      id: 'RPT-004',
      title: 'Análisis de Depreciación de Activos',
      type: ReportType.DEPRECIATION,
      description: 'Cálculo de depreciación para activos del año fiscal',
      date: new Date('2025-09-01'),
      generatedBy: 'Contador General',
      status: ReportStatus.COMPLETED,
      filePath: '/reports/depreciation-analysis-2025.xlsx',
      createdAt: new Date('2025-09-01')
    },
    {
      id: 'RPT-005',
      title: 'Reporte Financiero de Activos',
      type: ReportType.FINANCIAL,
      description: 'Valoración actual de todos los activos registrados',
      date: new Date('2025-09-02'),
      generatedBy: 'Admin Sistema',
      status: ReportStatus.GENERATING,
      createdAt: new Date('2025-09-02')
    },
    {
      id: 'RPT-006',
      title: 'Estado General de Activos',
      type: ReportType.STATUS,
      description: 'Resumen del estado actual de todos los activos',
      date: new Date('2025-09-03'),
      generatedBy: 'Admin Sistema',
      status: ReportStatus.PENDING,
      createdAt: new Date('2025-09-03')
    }
  ];

  getReports(): Observable<AssetReport[]> {
    // Ordenar por fecha de creación (más recientes primero)
    const sortedReports = [...this.mockReports].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    return of(sortedReports).pipe(delay(1000));
  }

  getReportById(id: string): Observable<AssetReport | undefined> {
    const report = this.mockReports.find(r => r.id === id);
    return of(report).pipe(delay(500));
  }

  getReportsByType(type: ReportType): Observable<AssetReport[]> {
    const filtered = this.mockReports.filter(r => r.type === type);
    return of(filtered).pipe(delay(800));
  }

  getReportsByStatus(status: ReportStatus): Observable<AssetReport[]> {
    const filtered = this.mockReports.filter(r => r.status === status);
    return of(filtered).pipe(delay(800));
  }

  generateReport(reportData: GenerateReportDto): Observable<AssetReport> {
    const newReport: AssetReport = {
      id: `RPT-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
      title: reportData.title,
      type: reportData.type,
      description: reportData.description,
      date: new Date(),
      generatedBy: 'Usuario Actual',
      status: ReportStatus.GENERATING,
      parameters: reportData.filters,
      createdAt: new Date()
    };

    this.mockReports.unshift(newReport);

    // Simular proceso de generación
    setTimeout(() => {
      const index = this.mockReports.findIndex(r => r.id === newReport.id);
      if (index !== -1) {
        this.mockReports[index].status = ReportStatus.COMPLETED;
        this.mockReports[index].filePath = `/reports/${reportData.title.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.${reportData.format || 'pdf'}`;
      }
    }, 3000);

    return of(newReport).pipe(delay(1500));
  }

  downloadReport(reportId: string): Observable<Blob> {
    const report = this.mockReports.find(r => r.id === reportId);
    if (!report || report.status !== ReportStatus.COMPLETED) {
      throw new Error('Report not found or not completed');
    }

    // Simular descarga de archivo
    const mockContent = `Reporte: ${report.title}\nFecha: ${report.date}\nGenerado por: ${report.generatedBy}\n\nContenido del reporte...`;
    const blob = new Blob([mockContent], { type: 'application/pdf' });
    return of(blob).pipe(delay(2000));
  }

  deleteReport(reportId: string): Observable<boolean> {
    const index = this.mockReports.findIndex(r => r.id === reportId);
    if (index !== -1) {
      this.mockReports.splice(index, 1);
      return of(true).pipe(delay(1000));
    }
    return of(false).pipe(delay(1000));
  }

  getReportTemplates(): Observable<any[]> {
    const templates = [
      {
        id: 'template-location',
        name: 'Activos por Ubicación',
        type: ReportType.LOCATION,
        description: 'Muestra la distribución de activos por ubicación física',
        parameters: ['location', 'department', 'status']
      },
      {
        id: 'template-status',
        name: 'Estado de Activos',
        type: ReportType.STATUS,
        description: 'Resumen del estado actual de todos los activos',
        parameters: ['status', 'condition', 'dateRange']
      },
      {
        id: 'template-maintenance',
        name: 'Historial de Mantenimientos',
        type: ReportType.MAINTENANCE,
        description: 'Registro completo de mantenimientos realizados',
        parameters: ['assetType', 'maintenanceType', 'dateRange', 'status']
      },
      {
        id: 'template-depreciation',
        name: 'Análisis de Depreciación',
        type: ReportType.DEPRECIATION,
        description: 'Cálculo de depreciación para valoración de activos',
        parameters: ['assetType', 'purchaseDateRange', 'depreciationMethod']
      },
      {
        id: 'template-obsolete',
        name: 'Activos Obsoletos',
        type: ReportType.OBSOLETE,
        description: 'Lista de activos que requieren reemplazo o baja',
        parameters: ['condition', 'age', 'maintenanceCost']
      },
      {
        id: 'template-financial',
        name: 'Valoración Financiera',
        type: ReportType.FINANCIAL,
        description: 'Valoración actual y análisis financiero de activos',
        parameters: ['assetType', 'location', 'dateRange']
      }
    ];

    return of(templates).pipe(delay(600));
  }

  getReportStats(): Observable<any> {
    const stats = {
      total: this.mockReports.length,
      completed: this.mockReports.filter(r => r.status === ReportStatus.COMPLETED).length,
      generating: this.mockReports.filter(r => r.status === ReportStatus.GENERATING).length,
      pending: this.mockReports.filter(r => r.status === ReportStatus.PENDING).length,
      failed: this.mockReports.filter(r => r.status === ReportStatus.FAILED).length,
      byType: {
        location: this.mockReports.filter(r => r.type === ReportType.LOCATION).length,
        status: this.mockReports.filter(r => r.type === ReportType.STATUS).length,
        maintenance: this.mockReports.filter(r => r.type === ReportType.MAINTENANCE).length,
        depreciation: this.mockReports.filter(r => r.type === ReportType.DEPRECIATION).length,
        obsolete: this.mockReports.filter(r => r.type === ReportType.OBSOLETE).length,
        financial: this.mockReports.filter(r => r.type === ReportType.FINANCIAL).length
      },
      recentReports: this.mockReports
        .filter(r => r.status === ReportStatus.COMPLETED)
        .slice(0, 5)
        .map(r => ({ id: r.id, title: r.title, date: r.date }))
    };

    return of(stats).pipe(delay(800));
  }

  scheduleReport(reportData: GenerateReportDto, schedule: any): Observable<AssetReport> {
    const scheduledReport: AssetReport = {
      id: `SCH-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
      title: `[Programado] ${reportData.title}`,
      type: reportData.type,
      description: reportData.description,
      date: new Date(schedule.nextRun),
      generatedBy: 'Sistema Automático',
      status: ReportStatus.PENDING,
      parameters: { ...reportData.filters, schedule },
      createdAt: new Date()
    };

    this.mockReports.push(scheduledReport);
    return of(scheduledReport).pipe(delay(1000));
  }

  exportReportData(reportId: string, format: 'excel' | 'csv' | 'pdf'): Observable<Blob> {
    const report = this.mockReports.find(r => r.id === reportId);
    if (!report) {
      throw new Error('Report not found');
    }

    let mimeType: string;
    let content: string;

    switch (format) {
      case 'excel':
        mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        content = 'Excel content would be here...';
        break;
      case 'csv':
        mimeType = 'text/csv';
        content = 'CSV content would be here...';
        break;
      case 'pdf':
      default:
        mimeType = 'application/pdf';
        content = 'PDF content would be here...';
        break;
    }

    const blob = new Blob([content], { type: mimeType });
    return of(blob).pipe(delay(2500));
  }
}
