import { Location } from '@angular/common'
import { Component, OnInit, ViewChild } from '@angular/core'
import { MatPaginator } from '@angular/material/paginator'
import { MatSort } from '@angular/material/sort'
import { MatTableDataSource } from '@angular/material/table'
import { Router } from '@angular/router'
import { AlertService } from '@core/services/alert.service'
import { AssetStatus, BaseAsset } from '../interfaces/assets.interfaces'
import { AssetRegistrationService } from '../services/asset-registration.service'

@Component({
  selector: 'app-asset-inventory-control',
  templateUrl: './asset-inventory-control.component.html',
  styleUrls: ['./asset-inventory-control.component.css'],
})
export class AssetInventoryControlComponent implements OnInit {
  displayedColumns: string[] = [
    'assetTag',
    'name',
    'type',
    'status',
    'location',
    'currentValue',
    'actions',
  ]
  dataSource: MatTableDataSource<BaseAsset>
  isLoading = false
  searchTerm: string = ''

  @ViewChild(MatPaginator) paginator!: MatPaginator
  @ViewChild(MatSort) sort!: MatSort

  assets: BaseAsset[] = []

  constructor(
    private assetService: AssetRegistrationService,
    private router: Router,
    private location: Location,
    private alert: AlertService,
  ) {
    this.dataSource = new MatTableDataSource(this.assets)
  }

  ngOnInit(): void {
    this.loadAssets()
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator
    this.dataSource.sort = this.sort
  }

  loadAssets(): void {
    this.isLoading = true
    this.assetService.getAssets().subscribe({
      next: assets => {
        this.assets = assets
        this.dataSource.data = assets
        this.isLoading = false
      },
      error: error => {
        console.error('Error loading assets:', error)
        this.isLoading = false
      },
    })
  }

  applyFilter(event: Event): void {
    const filterValue = (event.target as HTMLInputElement).value
    this.dataSource.filter = filterValue.trim().toLowerCase()

    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage()
    }
  }

  addAsset(): void {
    this.router.navigate(['/dashboard/assets-control/inventory/new'])
  }

  goBack(): void {
    this.location.back()
  }

  editAsset(asset: BaseAsset): void {
    this.router.navigate(['/dashboard/assets-control/inventory/edit', asset.id])
  }

  viewAsset(asset: BaseAsset): void {
    this.router.navigate(['/dashboard/assets-control/inventory/view', asset.id])
  }

  async deleteAsset(asset: BaseAsset): Promise<void> {
    const result = await this.alert.fire({
      icon: 'warning',
      title: '¿Eliminar activo?',
      text: `¿Está seguro de eliminar "${asset.name}"? Esta acción no se puede deshacer.`,
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
    })

    if (result.isConfirmed) {
      this.isLoading = true
      this.assetService.deleteAsset(asset.id).subscribe({
        next: () => {
          this.assets = this.assets.filter(a => a.id !== asset.id)
          this.dataSource.data = this.assets
          this.alert.success('Eliminado', 'Activo eliminado correctamente')
          this.isLoading = false
        },
        error: error => {
          console.error('Error deleting asset:', error)
          this.isLoading = false
        },
      })
    }
  }

  getStatusColor(status: string): string {
    const statusMap: { [key: string]: string } = {
      active: 'bg-green-100 text-green-800',
      inactive: 'bg-slate-100 text-slate-800',
      maintenance: 'bg-amber-100 text-amber-800',
      retired: 'bg-red-100 text-red-800',
    }
    return statusMap[status] || 'bg-slate-100 text-slate-800'
  }

  getTypeIcon(type: string): string {
    const typeMap: { [key: string]: string } = {
      medical_equipment: 'medical_services',
      furniture: 'chair',
      computer: 'computer',
      vehicle: 'directions_car',
      building: 'business',
      other: 'inventory_2',
    }
    return typeMap[type] || 'inventory_2'
  }

  exportToCSV(): void {
    const headers = ['Tag', 'Nombre', 'Tipo', 'Estado', 'Ubicación', 'Valor Actual']
    const csvData = this.assets.map(asset => [
      (asset as any).assetTag || '',
      asset.name,
      asset.type,
      asset.status,
      asset.location || '',
      (asset as any).currentValue?.toString() || '0',
    ])

    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `activos_${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  getActiveCount(): number {
    return this.assets.filter(a => a.status === AssetStatus.ACTIVE).length
  }

  getMaintenanceCount(): number {
    return this.assets.filter(a => a.status === AssetStatus.MAINTENANCE).length
  }

  getTotalValue(): number {
    return this.assets.reduce((sum, asset) => sum + ((asset as any).currentValue || 0), 0)
  }
}
