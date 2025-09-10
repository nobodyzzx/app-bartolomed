import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import {
    FinancialReport,
    GenerateReportParams,
    MedicalReport,
    ReportFilters,
    StockReport
} from '../interfaces/reports.interfaces';

@Injectable({
  providedIn: 'root'
})
export class ReportsService {
  private apiUrl = '/api/reports';

  constructor(private http: HttpClient) {}

  // Medical Reports
  getMedicalReports(filters?: ReportFilters): Observable<MedicalReport[]> {
    // Mock data - reemplazar con llamada HTTP real
    const mockReports: MedicalReport[] = [
      {
        id: '1',
        title: 'Reporte de Consultas Mensuales',
        date: '2024-01-01',
        type: 'Consultas',
        description: 'Análisis de consultas médicas del mes',
        patientCount: 150,
        status: 'published',
        consultationData: [
          { specialty: 'Medicina General', count: 80, averageDuration: 30 },
          { specialty: 'Pediatría', count: 45, averageDuration: 25 },
          { specialty: 'Cardiología', count: 25, averageDuration: 45 }
        ],
        period: {
          startDate: '2024-01-01',
          endDate: '2024-01-31'
        },
        createdBy: 'Dr. García',
        createdAt: new Date('2024-01-31')
      },
      {
        id: '2',
        title: 'Reporte de Diagnósticos Frecuentes',
        date: '2024-01-15',
        type: 'Diagnósticos',
        description: 'Diagnósticos más comunes del trimestre',
        patientCount: 300,
        status: 'published',
        diagnosisData: [
          { diagnosis: 'Hipertensión', count: 45, percentage: 15 },
          { diagnosis: 'Diabetes', count: 36, percentage: 12 },
          { diagnosis: 'Gripe', count: 60, percentage: 20 },
          { diagnosis: 'Gastritis', count: 27, percentage: 9 }
        ],
        period: {
          startDate: '2023-10-01',
          endDate: '2023-12-31'
        },
        createdBy: 'Dra. Martínez',
        createdAt: new Date('2024-01-15')
      }
    ];

    return of(mockReports).pipe(delay(1000));
  }

  generateMedicalReport(params: GenerateReportParams): Observable<MedicalReport> {
    const newReport: MedicalReport = {
      id: Math.random().toString(36).substr(2, 9),
      title: params.title,
      date: new Date().toISOString().split('T')[0],
      type: params.type as any,
      description: params.description,
      status: 'generated',
      createdBy: 'Usuario Actual',
      createdAt: new Date(),
      period: {
        startDate: params.filters.startDate || '',
        endDate: params.filters.endDate || ''
      }
    };

    return of(newReport).pipe(delay(2000));
  }

  // Financial Reports
  getFinancialReports(filters?: ReportFilters): Observable<FinancialReport[]> {
    const mockReports: FinancialReport[] = [
      {
        id: '1',
        title: 'Reporte Financiero Mensual',
        date: '2024-01-31',
        type: 'Balance',
        description: 'Balance financiero del mes de enero',
        totalAmount: 45000,
        currency: 'USD',
        revenue: 52000,
        expenses: 38000,
        profit: 14000,
        status: 'published',
        period: {
          startDate: '2024-01-01',
          endDate: '2024-01-31'
        },
        categories: [
          { category: 'Consultas', amount: 30000, percentage: 58 },
          { category: 'Medicamentos', amount: 15000, percentage: 29 },
          { category: 'Procedimientos', amount: 7000, percentage: 13 }
        ],
        createdBy: 'Contador',
        createdAt: new Date('2024-01-31')
      },
      {
        id: '2',
        title: 'Análisis de Ventas',
        date: '2024-01-15',
        type: 'Ventas',
        description: 'Análisis detallado de ventas por categoría',
        totalAmount: 28000,
        currency: 'USD',
        revenue: 28000,
        status: 'published',
        period: {
          startDate: '2024-01-01',
          endDate: '2024-01-15'
        },
        categories: [
          { category: 'Farmacia', amount: 18000, percentage: 64 },
          { category: 'Consultorios', amount: 10000, percentage: 36 }
        ],
        createdBy: 'Gerente de Ventas',
        createdAt: new Date('2024-01-15')
      }
    ];

    return of(mockReports).pipe(delay(1000));
  }

  generateFinancialReport(params: GenerateReportParams): Observable<FinancialReport> {
    const newReport: FinancialReport = {
      id: Math.random().toString(36).substr(2, 9),
      title: params.title,
      date: new Date().toISOString().split('T')[0],
      type: params.type as any,
      description: params.description,
      status: 'generated',
      currency: 'USD',
      createdBy: 'Usuario Actual',
      createdAt: new Date(),
      period: {
        startDate: params.filters.startDate || '',
        endDate: params.filters.endDate || ''
      }
    };

    return of(newReport).pipe(delay(2000));
  }

  // Stock Reports
  getStockReports(filters?: ReportFilters): Observable<StockReport[]> {
    const mockReports: StockReport[] = [
      {
        id: '1',
        title: 'Reporte de Inventario General',
        date: '2024-01-31',
        type: 'Inventario',
        description: 'Estado general del inventario',
        totalProducts: 450,
        lowStockItems: 15,
        expiringItems: 8,
        outOfStockItems: 3,
        stockValue: 125000,
        status: 'published',
        movements: [
          { productName: 'Paracetamol 500mg', movementType: 'entrada', quantity: 100, date: '2024-01-30' },
          { productName: 'Ibuprofeno 400mg', movementType: 'salida', quantity: 50, date: '2024-01-29' },
          { productName: 'Amoxicilina 500mg', movementType: 'ajuste', quantity: -5, date: '2024-01-28', reason: 'Vencimiento' }
        ],
        createdBy: 'Farmaceuta',
        createdAt: new Date('2024-01-31')
      },
      {
        id: '2',
        title: 'Productos por Vencer',
        date: '2024-01-25',
        type: 'Vencimientos',
        description: 'Productos que vencen en los próximos 30 días',
        totalProducts: 25,
        expiringItems: 25,
        stockValue: 8500,
        status: 'published',
        movements: [
          { productName: 'Jarabe para la tos', movementType: 'salida', quantity: 12, date: '2024-01-24', reason: 'Próximo a vencer' },
          { productName: 'Vitamina C', movementType: 'ajuste', quantity: -3, date: '2024-01-23', reason: 'Vencido' }
        ],
        createdBy: 'Supervisor de Farmacia',
        createdAt: new Date('2024-01-25')
      }
    ];

    return of(mockReports).pipe(delay(1000));
  }

  generateStockReport(params: GenerateReportParams): Observable<StockReport> {
    const newReport: StockReport = {
      id: Math.random().toString(36).substr(2, 9),
      title: params.title,
      date: new Date().toISOString().split('T')[0],
      type: params.type as any,
      description: params.description,
      status: 'generated',
      createdBy: 'Usuario Actual',
      createdAt: new Date()
    };

    return of(newReport).pipe(delay(2000));
  }

  // Métodos generales
  deleteReport(id: string): Observable<boolean> {
    return of(true).pipe(delay(500));
  }

  downloadReport(id: string, format: 'pdf' | 'excel' | 'csv'): Observable<Blob> {
    // Mock download - en producción retornaría el archivo real
    const mockBlob = new Blob(['Mock report content'], { type: 'application/pdf' });
    return of(mockBlob).pipe(delay(1500));
  }

  exportReport(reportId: string, format: 'pdf' | 'excel' | 'csv'): Observable<boolean> {
    return of(true).pipe(delay(2000));
  }
}
