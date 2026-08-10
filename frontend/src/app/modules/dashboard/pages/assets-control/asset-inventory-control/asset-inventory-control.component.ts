import { Location } from '@angular/common'
import { AfterViewInit, Component, DestroyRef, inject, OnInit, ViewChild } from '@angular/core'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { MatPaginator } from '@angular/material/paginator'
import { MatSort } from '@angular/material/sort'
import { MatTableDataSource } from '@angular/material/table'
import { Router } from '@angular/router'
import { AlertService } from '@core/services/alert.service'
import { AssetCondition, AssetStatus, BaseAsset } from '../interfaces/assets.interfaces'
import { AssetRegistrationService } from '../services/asset-registration.service'

@Component({
    selector: 'app-asset-inventory-control',
    templateUrl: './asset-inventory-control.component.html',
    styleUrls: ['./asset-inventory-control.component.css'],
    standalone: false
})
export class AssetInventoryControlComponent implements OnInit, AfterViewInit {
  private readonly destroyRef = inject(DestroyRef)

  // El inventario responde qué hay, cuánto y dónde. La columna de valor se
  // retiró: el inventario se lleva por existencias, no para contabilidad, y
  // mostraba "Bs 0,00" en las 235 filas.
  displayedColumns: string[] = ['assetTag', 'name', 'quantity', 'type', 'status', 'location', 'actions']
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
    [AssetStatus.SOLD]: 'bg-slate-200 text-slate-600',
    [AssetStatus.LOST]: 'bg-red-200 text-red-900',
    [AssetStatus.DAMAGED]: 'bg-orange-100 text-orange-800',
  }

  private readonly statusLabels: Record<string, string> = {
    [AssetStatus.ACTIVE]: 'Activo',
    [AssetStatus.INACTIVE]: 'Inactivo',
    [AssetStatus.MAINTENANCE]: 'En Mantenimiento',
    [AssetStatus.RETIRED]: 'Retirado',
    [AssetStatus.SOLD]: 'Vendido',
    [AssetStatus.LOST]: 'Perdido',
    [AssetStatus.DAMAGED]: 'Dañado',
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
        (asset.manufacturer ?? '').toLowerCase().includes(term)
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
    // getAllAssets y no getAssets: este último trae solo la primera página (25),
    // y toda la pantalla —paginador, buscador y contadores— trabaja en cliente
    // sobre lo que reciba, así que el resto del inventario quedaba invisible.
    this.assetService.getAllAssets().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: result => {
        this.assets = result
        this.applyFilters()
        this.isLoading = false
      },
      error: () => {
        this.isLoading = false
      },
    })
  }

  applyFilter(value: string): void {
    this.searchTerm = value
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
      this.assetService.deleteAsset(asset.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
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
    const headers = ['Código', 'Nombre', 'Cantidad', 'Tipo', 'Estado', 'Ambiente']
    const rows = this.assets.map(a => [
      a.assetTag ?? '',
      a.name,
      String(a.quantity ?? 1),
      this.getTypeLabel(a.type),
      this.getStatusLabel(a.status),
      a.location ?? '',
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

  getStatusLabel(status: string): string {
    return this.statusLabels[status] ?? status
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

  /**
   * `Number(...)` y no `+` a secas: las columnas `decimal` de Postgres viajan
   * como **string** ("0.00"), aunque la interfaz las declare `number`. Sumarlas
   * con `+` las concatenaba —"0.00"+"0.00" = "0.000.00"— y con 334 activos el
   * resultado era una cadena de 100 caracteres que hacía reventar al
   * `DecimalPipe` del KPI con NG02100. Ese error tumbaba el render del template
   * entero, así que la tabla se quedaba en esqueletos y los cuatro contadores en
   * cero: la pantalla no mostraba nada.
   *
   * No saltó antes porque el inventario estaba vacío y `reduce` devolvía el `0`
   * inicial; apareció con la primera carga real de activos.
   */
  /** Unidades: el inventario cuenta existencias, y 235 ítems son 778 unidades. */
  getTotalUnits(): number {
    return this.assets.reduce((n, a) => n + (Number(a.quantity) || 1), 0)
  }

  /** Lo que está pero no sirve, más lo que se fue a mantenimiento. */
  getUnusableCount(): number {
    return this.assets.filter(
      a => a.status === AssetStatus.DAMAGED || a.condition === AssetCondition.POOR || a.condition === AssetCondition.CRITICAL,
    ).length
  }

  getPendingCount(): number {
    return this.assets.filter(a => a.status === AssetStatus.INACTIVE).length
  }
}
