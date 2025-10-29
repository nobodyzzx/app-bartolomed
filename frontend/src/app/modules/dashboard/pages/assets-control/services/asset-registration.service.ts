import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import {
    AssetFilters,
    AssetStatus,
    BaseAsset,
    CreateAssetDto
} from '../interfaces/assets.interfaces';

@Injectable({
  providedIn: 'root'
})
export class AssetRegistrationService {
  private apiUrl = '/api/assets';

  constructor(private http: HttpClient) {}

  // Mock data
  private mockAssets: BaseAsset[] = [
    {
      id: '1',
      name: 'Máquina de Rayos X Digital',
      type: 'Equipo Médico',
      manufacturer: 'Siemens',
      model: 'MULTIX Fusion',
      serialNumber: 'SX-2024-001',
      purchaseDate: new Date('2023-01-15'),
      purchasePrice: 85000,
      warrantyExpiration: new Date('2026-01-15'),
      status: AssetStatus.ACTIVE,
      location: 'Sala de Radiología A',
      description: 'Equipo de rayos X digital de alta resolución',
      createdAt: new Date('2023-01-15')
    },
    {
      id: '2',
      name: 'Silla de Ruedas Eléctrica',
      type: 'Mobiliario Médico',
      manufacturer: 'Invacare',
      model: 'TDX SP2',
      serialNumber: 'IV-2024-015',
      purchaseDate: new Date('2024-05-20'),
      purchasePrice: 3500,
      warrantyExpiration: new Date('2026-05-20'),
      status: AssetStatus.ACTIVE,
      location: 'Área de Fisioterapia',
      description: 'Silla de ruedas eléctrica con control joystick',
      createdAt: new Date('2024-05-20')
    },
    {
      id: '3',
      name: 'Monitor de Signos Vitales',
      type: 'Equipo de Monitoreo',
      manufacturer: 'Philips',
      model: 'IntelliVue MX450',
      serialNumber: 'PH-2024-032',
      purchaseDate: new Date('2024-03-10'),
      purchasePrice: 12000,
      warrantyExpiration: new Date('2027-03-10'),
      status: AssetStatus.MAINTENANCE,
      location: 'UCI',
      description: 'Monitor multiparamétrico para cuidados intensivos',
      createdAt: new Date('2024-03-10')
    },
    {
      id: '4',
      name: 'Autoclave de Vapor',
      type: 'Equipo de Esterilización',
      manufacturer: 'Tuttnauer',
      model: '3870EA',
      serialNumber: 'TT-2023-087',
      purchaseDate: new Date('2023-08-15'),
      purchasePrice: 8500,
      warrantyExpiration: new Date('2025-08-15'),
      status: AssetStatus.ACTIVE,
      location: 'Central de Esterilización',
      description: 'Autoclave automático para instrumental médico',
      createdAt: new Date('2023-08-15')
    },
    {
      id: '5',
      name: 'Desfibrilador Externo',
      type: 'Equipo de Emergencia',
      manufacturer: 'ZOLL',
      model: 'AED Plus',
      serialNumber: 'ZL-2024-019',
      purchaseDate: new Date('2024-02-28'),
      purchasePrice: 2800,
      warrantyExpiration: new Date('2029-02-28'),
      status: AssetStatus.ACTIVE,
      location: 'Urgencias',
      description: 'Desfibrilador externo automático con CPR feedback',
      createdAt: new Date('2024-02-28')
    }
  ];

  getAssets(filters?: AssetFilters): Observable<BaseAsset[]> {
    let filteredAssets = [...this.mockAssets];

    if (filters) {
      if (filters.status) {
        filteredAssets = filteredAssets.filter(asset => asset.status === filters.status);
      }
      if (filters.type) {
        filteredAssets = filteredAssets.filter(asset => 
          asset.type.toLowerCase().includes(filters.type!.toLowerCase())
        );
      }
      if (filters.location) {
        filteredAssets = filteredAssets.filter(asset => 
          asset.location?.toLowerCase().includes(filters.location!.toLowerCase())
        );
      }
      if (filters.manufacturer) {
        filteredAssets = filteredAssets.filter(asset => 
          asset.manufacturer.toLowerCase().includes(filters.manufacturer!.toLowerCase())
        );
      }
    }

    return of(filteredAssets).pipe(delay(1000));
  }

  getAssetById(id: string): Observable<BaseAsset | undefined> {
    const asset = this.mockAssets.find(a => a.id === id);
    return of(asset).pipe(delay(500));
  }

  createAsset(assetData: CreateAssetDto): Observable<BaseAsset> {
    const newAsset: BaseAsset = {
      id: Math.random().toString(36).substr(2, 9),
      ...assetData,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.mockAssets.unshift(newAsset);
    return of(newAsset).pipe(delay(1500));
  }

  updateAsset(id: string, assetData: Partial<BaseAsset>): Observable<BaseAsset> {
    const index = this.mockAssets.findIndex(a => a.id === id);
    if (index !== -1) {
      this.mockAssets[index] = {
        ...this.mockAssets[index],
        ...assetData,
        updatedAt: new Date()
      };
      return of(this.mockAssets[index]).pipe(delay(1000));
    }
    throw new Error('Asset not found');
  }

  deleteAsset(id: string): Observable<boolean> {
    const index = this.mockAssets.findIndex(a => a.id === id);
    if (index !== -1) {
      this.mockAssets.splice(index, 1);
      return of(true).pipe(delay(1000));
    }
    return of(false).pipe(delay(1000));
  }

  getAssetTypes(): Observable<string[]> {
    const types = [...new Set(this.mockAssets.map(asset => asset.type))];
    return of(types).pipe(delay(300));
  }

  getManufacturers(): Observable<string[]> {
    const manufacturers = [...new Set(this.mockAssets.map(asset => asset.manufacturer))];
    return of(manufacturers).pipe(delay(300));
  }

  getLocations(): Observable<string[]> {
    const locations = [...new Set(this.mockAssets.map(asset => asset.location).filter(Boolean))] as string[];
    return of(locations).pipe(delay(300));
  }

  // Validaciones
  validateSerialNumber(serialNumber: string, excludeId?: string): Observable<boolean> {
    const exists = this.mockAssets.some(asset => 
      asset.serialNumber === serialNumber && asset.id !== excludeId
    );
    return of(!exists).pipe(delay(500));
  }

  // Estadísticas
  getAssetStats(): Observable<any> {
    const stats = {
      total: this.mockAssets.length,
      active: this.mockAssets.filter(a => a.status === AssetStatus.ACTIVE).length,
      maintenance: this.mockAssets.filter(a => a.status === AssetStatus.MAINTENANCE).length,
      retired: this.mockAssets.filter(a => a.status === AssetStatus.RETIRED).length,
      totalValue: this.mockAssets.reduce((sum, asset) => sum + (asset.purchasePrice || 0), 0)
    };
    return of(stats).pipe(delay(800));
  }
}
