import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import {
    AssetCondition,
    AssetInventory,
    AssetStatus
} from '../interfaces/assets.interfaces';

@Injectable({
  providedIn: 'root'
})
export class AssetInventoryControlService {
  private apiUrl = '/api/assets/inventory';

  constructor(private http: HttpClient) {}

  // Mock data
  private mockInventory: AssetInventory[] = [
    {
      id: '1',
      assetId: '1',
      assetName: 'Máquina de Rayos X Digital',
      location: 'Sala de Radiología A',
      department: 'Radiología',
      quantity: 1,
      condition: AssetCondition.EXCELLENT,
      status: AssetStatus.ACTIVE,
      lastInspectionDate: new Date('2025-08-15'),
      responsiblePerson: 'Dr. Carlos Mendoza',
      notes: 'Equipo en perfectas condiciones, último mantenimiento realizado.',
      updatedAt: new Date('2025-08-15')
    },
    {
      id: '2',
      assetId: '2',
      assetName: 'Silla de Ruedas Eléctrica',
      location: 'Área de Fisioterapia',
      department: 'Rehabilitación',
      quantity: 5,
      condition: AssetCondition.GOOD,
      status: AssetStatus.ACTIVE,
      lastInspectionDate: new Date('2025-09-01'),
      responsiblePerson: 'Lic. María González',
      notes: 'Una unidad requiere mantenimiento menor en la rueda.',
      updatedAt: new Date('2025-09-01')
    },
    {
      id: '3',
      assetId: '3',
      assetName: 'Monitor de Signos Vitales',
      location: 'UCI',
      department: 'Cuidados Intensivos',
      quantity: 1,
      condition: AssetCondition.FAIR,
      status: AssetStatus.MAINTENANCE,
      lastInspectionDate: new Date('2025-08-30'),
      responsiblePerson: 'Enf. Ana Rodríguez',
      notes: 'En mantenimiento por falla intermitente en sensor de oxígeno.',
      updatedAt: new Date('2025-09-02')
    },
    {
      id: '4',
      assetId: '4',
      assetName: 'Autoclave de Vapor',
      location: 'Central de Esterilización',
      department: 'Servicios Generales',
      quantity: 1,
      condition: AssetCondition.GOOD,
      status: AssetStatus.ACTIVE,
      lastInspectionDate: new Date('2025-08-25'),
      responsiblePerson: 'Téc. Roberto Silva',
      notes: 'Funcionamiento normal, próxima revisión programada.',
      updatedAt: new Date('2025-08-25')
    },
    {
      id: '5',
      assetId: '5',
      assetName: 'Desfibrilador Externo',
      location: 'Urgencias',
      department: 'Emergencias',
      quantity: 1,
      condition: AssetCondition.EXCELLENT,
      status: AssetStatus.ACTIVE,
      lastInspectionDate: new Date('2025-09-01'),
      responsiblePerson: 'Dr. Patricia López',
      notes: 'Equipo verificado y listo para uso de emergencia.',
      updatedAt: new Date('2025-09-01')
    },
    {
      id: '6',
      assetId: '6',
      assetName: 'Camas Hospitalarias',
      location: 'Sala de Hospitalización',
      department: 'Hospitalización',
      quantity: 20,
      condition: AssetCondition.GOOD,
      status: AssetStatus.ACTIVE,
      lastInspectionDate: new Date('2025-08-20'),
      responsiblePerson: 'Enf. Jefe Carmen Vega',
      notes: '18 camas en uso, 2 en mantenimiento menor.',
      updatedAt: new Date('2025-08-22')
    },
    {
      id: '7',
      assetId: '7',
      assetName: 'Computadoras de Escritorio',
      location: 'Administración',
      department: 'Sistemas',
      quantity: 15,
      condition: AssetCondition.FAIR,
      status: AssetStatus.ACTIVE,
      lastInspectionDate: new Date('2025-08-10'),
      responsiblePerson: 'Ing. Luis Ramírez',
      notes: '3 equipos requieren actualización de software.',
      updatedAt: new Date('2025-08-12')
    },
    {
      id: '8',
      assetId: '8',
      assetName: 'Equipo de Ultrasonido',
      location: 'Consulta Externa',
      department: 'Ginecología',
      quantity: 1,
      condition: AssetCondition.POOR,
      status: AssetStatus.RETIRED,
      lastInspectionDate: new Date('2025-07-15'),
      responsiblePerson: 'Dra. Elena Morales',
      notes: 'Equipo obsoleto, programado para reemplazo.',
      updatedAt: new Date('2025-07-15')
    }
  ];

  getInventory(): Observable<AssetInventory[]> {
    return of([...this.mockInventory]).pipe(delay(1000));
  }

  getInventoryByLocation(location: string): Observable<AssetInventory[]> {
    const filtered = this.mockInventory.filter(item => 
      item.location.toLowerCase().includes(location.toLowerCase())
    );
    return of(filtered).pipe(delay(800));
  }

  getInventoryByDepartment(department: string): Observable<AssetInventory[]> {
    const filtered = this.mockInventory.filter(item => 
      item.department?.toLowerCase().includes(department.toLowerCase())
    );
    return of(filtered).pipe(delay(800));
  }

  getInventoryByStatus(status: AssetStatus): Observable<AssetInventory[]> {
    const filtered = this.mockInventory.filter(item => item.status === status);
    return of(filtered).pipe(delay(800));
  }

  getInventoryByCondition(condition: AssetCondition): Observable<AssetInventory[]> {
    const filtered = this.mockInventory.filter(item => item.condition === condition);
    return of(filtered).pipe(delay(800));
  }

  updateInventoryItem(id: string, updates: Partial<AssetInventory>): Observable<AssetInventory> {
    const index = this.mockInventory.findIndex(item => item.id === id);
    if (index !== -1) {
      this.mockInventory[index] = {
        ...this.mockInventory[index],
        ...updates,
        updatedAt: new Date()
      };
      return of(this.mockInventory[index]).pipe(delay(1000));
    }
    throw new Error('Inventory item not found');
  }

  updateAssetLocation(assetId: string, newLocation: string, notes?: string): Observable<AssetInventory> {
    const index = this.mockInventory.findIndex(item => item.assetId === assetId);
    if (index !== -1) {
      this.mockInventory[index] = {
        ...this.mockInventory[index],
        location: newLocation,
        notes: notes || this.mockInventory[index].notes,
        updatedAt: new Date()
      };
      return of(this.mockInventory[index]).pipe(delay(1000));
    }
    throw new Error('Asset not found in inventory');
  }

  performInspection(id: string, condition: AssetCondition, notes: string): Observable<AssetInventory> {
    const index = this.mockInventory.findIndex(item => item.id === id);
    if (index !== -1) {
      this.mockInventory[index] = {
        ...this.mockInventory[index],
        condition: condition,
        lastInspectionDate: new Date(),
        notes: notes,
        updatedAt: new Date()
      };
      return of(this.mockInventory[index]).pipe(delay(1200));
    }
    throw new Error('Inventory item not found');
  }

  getInventoryStats(): Observable<any> {
    const stats = {
      totalAssets: this.mockInventory.length,
      totalQuantity: this.mockInventory.reduce((sum, item) => sum + item.quantity, 0),
      byStatus: {
        active: this.mockInventory.filter(item => item.status === AssetStatus.ACTIVE).length,
        maintenance: this.mockInventory.filter(item => item.status === AssetStatus.MAINTENANCE).length,
        retired: this.mockInventory.filter(item => item.status === AssetStatus.RETIRED).length,
        inactive: this.mockInventory.filter(item => item.status === AssetStatus.INACTIVE).length
      },
      byCondition: {
        excellent: this.mockInventory.filter(item => item.condition === AssetCondition.EXCELLENT).length,
        good: this.mockInventory.filter(item => item.condition === AssetCondition.GOOD).length,
        fair: this.mockInventory.filter(item => item.condition === AssetCondition.FAIR).length,
        poor: this.mockInventory.filter(item => item.condition === AssetCondition.POOR).length,
        critical: this.mockInventory.filter(item => item.condition === AssetCondition.CRITICAL).length
      },
      byDepartment: this.getDepartmentStats(),
      lastInspections: this.getRecentInspections()
    };

    return of(stats).pipe(delay(1000));
  }

  private getDepartmentStats(): any {
    const departments: { [key: string]: number } = {};
    this.mockInventory.forEach(item => {
      if (item.department) {
        departments[item.department] = (departments[item.department] || 0) + item.quantity;
      }
    });
    return departments;
  }

  private getRecentInspections(): AssetInventory[] {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    return this.mockInventory
      .filter(item => item.lastInspectionDate && item.lastInspectionDate >= thirtyDaysAgo)
      .sort((a, b) => {
        if (!a.lastInspectionDate || !b.lastInspectionDate) return 0;
        return b.lastInspectionDate.getTime() - a.lastInspectionDate.getTime();
      })
      .slice(0, 5);
  }

  getItemsDueForInspection(days: number = 90): Observable<AssetInventory[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const dueForInspection = this.mockInventory.filter(item => {
      if (!item.lastInspectionDate) return true;
      return item.lastInspectionDate < cutoffDate;
    });

    return of(dueForInspection).pipe(delay(800));
  }

  getLocations(): Observable<string[]> {
    const locations = [...new Set(this.mockInventory.map(item => item.location))];
    return of(locations).pipe(delay(400));
  }

  getDepartments(): Observable<string[]> {
    const departments = [...new Set(this.mockInventory.map(item => item.department).filter(Boolean))] as string[];
    return of(departments).pipe(delay(400));
  }

  exportInventoryReport(format: 'excel' | 'csv' | 'pdf'): Observable<Blob> {
    // Mock export functionality
    const mockData = JSON.stringify(this.mockInventory, null, 2);
    const blob = new Blob([mockData], { type: 'application/json' });
    return of(blob).pipe(delay(2000));
  }
}
