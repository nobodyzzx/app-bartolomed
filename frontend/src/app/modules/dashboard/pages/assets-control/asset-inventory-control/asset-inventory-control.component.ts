import { Location } from '@angular/common'
import { AfterViewInit, Component, OnInit, ViewChild } from '@angular/core'
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
export class AssetInventoryControlComponent implements OnInit, AfterViewInit {
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
  searchTerm = ''

  @ViewChild(MatPaginator) paginator!: MatPaginator
  @ViewChild(MatSort) sort!: MatSort

  readonly AssetStatus = AssetStatus
  assets: BaseAsset[] = []
  activeStatusFilter: string | null = null

  private readonly typeLabels: Record<string, string> = {
    medical_equipment: 'Equipo Médico',
    furniture: 'Mobiliario',
    computer: 'Computadora',
    vehicle: 'Vehículo',
    building: 'Inmueble',
    other: 'Otro',
  }

  private readonly typeIcons: Record<string, string> = {
    medical_equipment: 'medical_services',
    furniture: 'chair',
    computer: 'computer',
    vehicle: 'directions_car',
    building: 'business',
    other: 'inventory_2',
  }

  private readonly statusColors: Record<string, string> = {
    [AssetStatus.ACTIVE]: 'bg-green-100 text-green-800',
    [AssetStatus.INACTIVE]: 'bg-slate-100 text-slate-700',
    [AssetStatus.MAINTENANCE]: 'bg-amber-100 text-amber-800',
    [AssetStatus.RETIRED]: 'bg-red-100 text-red-800',
    [AssetStatus.DISPOSED]: 'bg-slate-200 text-slate-600',
  }

  constructor(
    private assetService: AssetRegistrationService,
    private router: Router,
    private location: Location,
    private alert: AlertService,
  ) {
    this.dataSource = new MatTableDataSource<BaseAsset>([])
    this.dataSource.filterPredicate = (asset: BaseAsset, filter: string) => {
      const term = filter.toLowerCase()
      return (
        asset.name.toLowerCase().includes(term) ||
        (asset.assetTag ?? '').toLowerCase().includes(term) ||
        (asset.location ?? '').toLowerCase().includes(term) ||
        this.getTypeLabel(asset.type).toLowerCase().includes(term) ||
        asset.manufacturer.toLowerCase().includes(term)
      )
    }
  }

  ngOnInit(): void {
    this.loadAssets()
  }

  ngAfterViewInit(): void {
    this.dataSource.paginator = this.paginator
    this.dataSource.sort = this.sort
  }

  loadAssets(): void {
    this.isLoading = true
    this.assetService.getAssets().subscribe({
      next: assets => {
        this.assets = assets
        this.applyFilters()
        this.isLoading = false
      },
      error: () => {
        this.isLoading = false
      },
    })
  }

  applyFilter(event: Event): void {
    this.searchTerm = (event.target as HTMLInputElement).value
    this.applyFilters()
  }

  setStatusFilter(status: string | null): void {
    this.activeStatusFilter = status
    this.applyFilters()
  }

  private applyFilters(): void {
    const filtered = this.activeStatusFilter
      ? this.assets.filter(a => a.status === this.activeStatusFilter)
      : this.assets
    this.dataSource.data = filtered
    this.dataSource.filter = this.searchTerm.trim().toLowerCase()
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
          this.applyFilters()
          this.alert.success('Eliminado', 'Activo eliminado correctamente')
          this.isLoading = false
        },
        error: () => {
          this.isLoading = false
        },
      })
    }
  }

  exportToCSV(): void {
    const headers = ['Tag', 'Nombre', 'Tipo', 'Estado', 'Ubicación', 'Valor Actual']
    const rows = this.assets.map(a => [
      a.assetTag ?? '',
      a.name,
      this.getTypeLabel(a.type),
      a.status,
      a.location ?? '',
      (a.currentValue ?? 0).toString(),
    ])
    const csv = [headers, ...rows].map(row => row.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.setAttribute('href', URL.createObjectURL(blob))
    link.setAttribute('download', `activos_${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  getStatusColor(status: string): string {
    return this.statusColors[status] ?? 'bg-slate-100 text-slate-700'
  }

  getTypeLabel(type: string): string {
    return this.typeLabels[type] ?? type
  }

  getTypeIcon(type: string): string {
    return this.typeIcons[type] ?? 'inventory_2'
  }

  getActiveCount(): number {
    return this.assets.filter(a => a.status === AssetStatus.ACTIVE).length
  }

  getMaintenanceCount(): number {
    return this.assets.filter(a => a.status === AssetStatus.MAINTENANCE).length
  }

  getRetiredCount(): number {
    return this.assets.filter(a => a.status === AssetStatus.RETIRED).length
  }

  getTotalValue(): number {
    return this.assets.reduce((sum, a) => sum + (a.currentValue ?? 0), 0)
  }
}
