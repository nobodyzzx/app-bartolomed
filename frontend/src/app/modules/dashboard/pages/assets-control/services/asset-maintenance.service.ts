import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import {
    AssetMaintenance,
    CreateMaintenanceDto,
    MaintenanceFilters,
    MaintenanceStatus,
    MaintenanceType,
    UpdateMaintenanceDto
} from '../interfaces/assets.interfaces';

@Injectable({
  providedIn: 'root'
})
export class AssetMaintenanceService {
  private apiUrl = '/api/assets/maintenance';

  constructor(private http: HttpClient) {}

  // Mock data
  private mockMaintenanceRecords: AssetMaintenance[] = [
    {
      id: '1',
      assetId: '1',
      assetName: 'Máquina de Rayos X Digital',
      maintenanceDate: new Date('2025-08-10'),
      nextMaintenanceDate: new Date('2026-02-10'),
      description: 'Revisión técnica semestral y calibración',
      type: MaintenanceType.PREVENTIVE,
      status: MaintenanceStatus.COMPLETED,
      cost: 1200,
      performedBy: 'TecnoMed Services',
      notes: 'Equipo en óptimas condiciones. Calibración exitosa.',
      attachments: ['reporte-calibracion.pdf'],
      createdAt: new Date('2025-08-01'),
      updatedAt: new Date('2025-08-10')
    },
    {
      id: '2',
      assetId: '2',
      assetName: 'Silla de Ruedas Eléctrica',
      maintenanceDate: new Date('2025-09-01'),
      nextMaintenanceDate: new Date('2025-12-01'),
      description: 'Reparación de rueda delantera y revisión de batería',
      type: MaintenanceType.CORRECTIVE,
      status: MaintenanceStatus.COMPLETED,
      cost: 150,
      performedBy: 'Juan Pérez - Técnico Interno',
      notes: 'Se reemplazó rueda delantera. Batería en buen estado.',
      createdAt: new Date('2025-08-28'),
      updatedAt: new Date('2025-09-01')
    },
    {
      id: '3',
      assetId: '3',
      assetName: 'Monitor de Signos Vitales',
      maintenanceDate: new Date('2025-09-15'),
      nextMaintenanceDate: new Date('2025-12-15'),
      description: 'Mantenimiento preventivo trimestral',
      type: MaintenanceType.PREVENTIVE,
      status: MaintenanceStatus.SCHEDULED,
      cost: 800,
      performedBy: 'Philips Service',
      notes: 'Mantenimiento programado según cronograma.',
      createdAt: new Date('2025-08-15'),
      updatedAt: new Date('2025-08-15')
    },
    {
      id: '4',
      assetId: '4',
      assetName: 'Autoclave de Vapor',
      maintenanceDate: new Date('2025-08-25'),
      nextMaintenanceDate: new Date('2025-11-25'),
      description: 'Inspección de válvulas y sistema de presión',
      type: MaintenanceType.INSPECTION,
      status: MaintenanceStatus.COMPLETED,
      cost: 300,
      performedBy: 'Tuttnauer Authorized Service',
      notes: 'Todas las válvulas funcionando correctamente.',
      createdAt: new Date('2025-08-20'),
      updatedAt: new Date('2025-08-25')
    },
    {
      id: '5',
      assetId: '5',
      assetName: 'Desfibrilador Externo',
      maintenanceDate: new Date('2025-09-05'),
      description: 'Calibración anual y test de funcionalidad',
      type: MaintenanceType.CALIBRATION,
      status: MaintenanceStatus.IN_PROGRESS,
      cost: 200,
      performedBy: 'ZOLL Technical Support',
      notes: 'En proceso de calibración y pruebas funcionales.',
      createdAt: new Date('2025-09-01'),
      updatedAt: new Date('2025-09-03')
    },
    {
      id: '6',
      assetId: '1',
      assetName: 'Máquina de Rayos X Digital',
      maintenanceDate: new Date('2025-10-01'),
      description: 'Emergencia - Falla en el sistema de imagen',
      type: MaintenanceType.EMERGENCY,
      status: MaintenanceStatus.SCHEDULED,
      performedBy: 'Siemens Emergency Service',
      notes: 'Urgente: Sistema de imagen presenta distorsión.',
      createdAt: new Date('2025-09-03'),
      updatedAt: new Date('2025-09-03')
    }
  ];

  getMaintenanceRecords(filters?: MaintenanceFilters): Observable<AssetMaintenance[]> {
    let filteredRecords = [...this.mockMaintenanceRecords];

    if (filters) {
      if (filters.assetId) {
        filteredRecords = filteredRecords.filter(record => record.assetId === filters.assetId);
      }
      if (filters.status) {
        filteredRecords = filteredRecords.filter(record => record.status === filters.status);
      }
      if (filters.type) {
        filteredRecords = filteredRecords.filter(record => record.type === filters.type);
      }
      if (filters.dateFrom) {
        filteredRecords = filteredRecords.filter(record => 
          new Date(record.maintenanceDate) >= filters.dateFrom!
        );
      }
      if (filters.dateTo) {
        filteredRecords = filteredRecords.filter(record => 
          new Date(record.maintenanceDate) <= filters.dateTo!
        );
      }
    }

    // Ordenar por fecha de mantenimiento (más recientes primero)
    filteredRecords.sort((a, b) => 
      new Date(b.maintenanceDate).getTime() - new Date(a.maintenanceDate).getTime()
    );

    return of(filteredRecords).pipe(delay(1000));
  }

  getMaintenanceById(id: string): Observable<AssetMaintenance | undefined> {
    const record = this.mockMaintenanceRecords.find(r => r.id === id);
    return of(record).pipe(delay(500));
  }

  createMaintenance(maintenanceData: CreateMaintenanceDto): Observable<AssetMaintenance> {
    const newMaintenance: AssetMaintenance = {
      id: Math.random().toString(36).substr(2, 9),
      ...maintenanceData,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.mockMaintenanceRecords.unshift(newMaintenance);
    return of(newMaintenance).pipe(delay(1500));
  }

  updateMaintenance(id: string, maintenanceData: UpdateMaintenanceDto): Observable<AssetMaintenance> {
    const index = this.mockMaintenanceRecords.findIndex(r => r.id === id);
    if (index !== -1) {
      this.mockMaintenanceRecords[index] = {
        ...this.mockMaintenanceRecords[index],
        ...maintenanceData,
        updatedAt: new Date()
      };
      return of(this.mockMaintenanceRecords[index]).pipe(delay(1000));
    }
    throw new Error('Maintenance record not found');
  }

  deleteMaintenance(id: string): Observable<boolean> {
    const index = this.mockMaintenanceRecords.findIndex(r => r.id === id);
    if (index !== -1) {
      this.mockMaintenanceRecords.splice(index, 1);
      return of(true).pipe(delay(1000));
    }
    return of(false).pipe(delay(1000));
  }

  getUpcomingMaintenance(days: number = 30): Observable<AssetMaintenance[]> {
    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(today.getDate() + days);

    const upcoming = this.mockMaintenanceRecords.filter(record => {
      const maintenanceDate = new Date(record.maintenanceDate);
      return maintenanceDate >= today && 
             maintenanceDate <= futureDate && 
             record.status === MaintenanceStatus.SCHEDULED;
    });

    return of(upcoming).pipe(delay(800));
  }

  getOverdueMaintenance(): Observable<AssetMaintenance[]> {
    const today = new Date();
    
    const overdue = this.mockMaintenanceRecords.filter(record => {
      const maintenanceDate = new Date(record.maintenanceDate);
      return maintenanceDate < today && 
             (record.status === MaintenanceStatus.SCHEDULED || 
              record.status === MaintenanceStatus.IN_PROGRESS);
    });

    return of(overdue).pipe(delay(800));
  }

  getMaintenanceStats(): Observable<any> {
    const stats = {
      total: this.mockMaintenanceRecords.length,
      completed: this.mockMaintenanceRecords.filter(r => r.status === MaintenanceStatus.COMPLETED).length,
      scheduled: this.mockMaintenanceRecords.filter(r => r.status === MaintenanceStatus.SCHEDULED).length,
      inProgress: this.mockMaintenanceRecords.filter(r => r.status === MaintenanceStatus.IN_PROGRESS).length,
      overdue: this.mockMaintenanceRecords.filter(r => {
        const maintenanceDate = new Date(r.maintenanceDate);
        const today = new Date();
        return maintenanceDate < today && 
               (r.status === MaintenanceStatus.SCHEDULED || r.status === MaintenanceStatus.IN_PROGRESS);
      }).length,
      totalCost: this.mockMaintenanceRecords
        .filter(r => r.status === MaintenanceStatus.COMPLETED)
        .reduce((sum, record) => sum + (record.cost || 0), 0)
    };

    return of(stats).pipe(delay(800));
  }

  getMaintenanceByAsset(assetId: string): Observable<AssetMaintenance[]> {
    const records = this.mockMaintenanceRecords.filter(r => r.assetId === assetId);
    return of(records).pipe(delay(600));
  }

  schedulePreventiveMaintenance(assetId: string, intervalMonths: number): Observable<AssetMaintenance[]> {
    // Lógica para programar mantenimientos preventivos
    const scheduledMaintenances: AssetMaintenance[] = [];
    const today = new Date();
    
    for (let i = 1; i <= 4; i++) { // Programar para los próximos 4 intervalos
      const nextDate = new Date(today);
      nextDate.setMonth(today.getMonth() + (intervalMonths * i));
      
      const scheduled: AssetMaintenance = {
        id: Math.random().toString(36).substr(2, 9),
        assetId: assetId,
        maintenanceDate: nextDate,
        description: `Mantenimiento preventivo programado - Intervalo ${i}`,
        type: MaintenanceType.PREVENTIVE,
        status: MaintenanceStatus.SCHEDULED,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      scheduledMaintenances.push(scheduled);
      this.mockMaintenanceRecords.push(scheduled);
    }
    
    return of(scheduledMaintenances).pipe(delay(1200));
  }
}
