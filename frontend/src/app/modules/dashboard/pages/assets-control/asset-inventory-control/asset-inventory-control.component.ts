import { Location } from '@angular/common'
import { Component, DestroyRef, inject, OnInit, ViewChild } from '@angular/core'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { MatPaginator } from '@angular/material/paginator'
import { MatSort } from '@angular/material/sort'
import { MatTableDataSource } from '@angular/material/table'
import { ActivatedRoute, Router } from '@angular/router'
import { AlertService } from '@core/services/alert.service'
import { MatDialog } from '@angular/material/dialog'
import { ordenarComoLasDemas } from '../../../../../shared/utils/table-sort.util'
import { matchesSearch } from '../../../../../shared/utils/text-search.util'
import { ListStateService } from '../../../../../shared/services/list-state.service'
import { AssetCondition, AssetStatus, BaseAsset } from '../interfaces/assets.interfaces'
import { MoveAssetDialogComponent } from '../move-asset-dialog/move-asset-dialog.component'
import { AssetRegistrationService } from '../services/asset-registration.service'

/** Qué subconjunto del inventario se está mirando. */
export type VistaInventario = 'todos' | 'enUso' | 'porConfirmar' | 'enDesuso'

@Component({
    selector: 'app-asset-inventory-control',
    templateUrl: './asset-inventory-control.component.html',
    styleUrls: ['./asset-inventory-control.component.css'],
    standalone: false
})
export class AssetInventoryControlComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef)
  private readonly listState = inject(ListStateService)
  private readonly route = inject(ActivatedRoute)

  /** Clave con la que se recuerda la vista de este listado. */
  private static readonly RUTA = '/dashboard/assets-control/inventory'

  // El inventario responde qué hay, cuánto y dónde. La columna de valor se
  // retiró: el inventario se lleva por existencias, no para contabilidad, y
  // mostraba "Bs 0,00" en las 235 filas.
  displayedColumns: string[] = ['assetTag', 'name', 'quantity', 'type', 'status', 'location', 'actions']
  dataSource: MatTableDataSource<BaseAsset>
  isLoading = false
  searchTerm = ''

  /**
   * Por `set` y no por propiedad: el paginador y el ordenador viven dentro de un
   * `@if` que solo aparece cuando ya hay filas, así que en `ngAfterViewInit`
   * todavía no existen. Asignándolos allí quedaban en `undefined` para siempre
   * —el paginador marcaba "0 de 0" y la tabla pintaba los 256 ítems de una
   * sentada, sin paginar ni poder ordenar por columna.
   */
  @ViewChild(MatPaginator)
  set paginator(paginator: MatPaginator | undefined) {
    if (paginator) this.dataSource.paginator = paginator
  }

  @ViewChild(MatSort)
  set sort(sort: MatSort | undefined) {
    if (sort) this.dataSource.sort = sort
  }

  /** Lo que está en el piso. Es el inventario: lo que hay, dónde y cuánto. */
  assets: BaseAsset[] = []

  /**
   * Lo retirado, vendido o perdido. Fuera de la tabla y fuera de los totales:
   * contar un timbre que nadie encuentra entre las existencias es lo que hace
   * que un inventario deje de servir. La hoja de conteo ya los excluía —esto
   * alinea la pantalla con lo que el módulo ya daba por cierto.
   *
   * Siguen alcanzables desde el enlace del buscador, porque un ítem perdido
   * puede aparecer y alguien tiene que poder devolverlo al inventario.
   */
  deBaja: BaseAsset[] = []
  verDeBaja = false

  /**
   * Las tres preguntas que responde el inventario, más "todo". Y no los estados
   * de la ficha: "en desuso" no es un estado sino un estado **o** una condición
   * mala, así que filtrar por `status` dejaba fuera justo lo que la tarjeta
   * contaba.
   */
  vista: VistaInventario = 'todos'

  /**
   * Un solo criterio por categoría, compartido por el número de la tarjeta y por
   * el filtro que aplica al pulsarla. Cuando eran dos cálculos distintos, la
   * tarjeta decía 2 y al pulsarla salía otra cosa.
   */
  private readonly criterios: Record<Exclude<VistaInventario, 'todos'>, (a: BaseAsset) => boolean> = {
    // "Operativo" excluye lo que la tarjeta de al lado da por inservible: una
    // camilla en condición crítica figuraba en las dos, y entre las tres
    // tarjetas salían más ítems de los que hay.
    enUso: a => a.status === AssetStatus.ACTIVE && !this.inservible(a),
    // También excluye lo inservible: si está gastado da igual que nunca se haya
    // registrado su entrega, lo que toca es reponerlo, no confirmarlo.
    porConfirmar: a => a.status === AssetStatus.INACTIVE && !this.inservible(a),
    enDesuso: a => this.inservible(a),
  }

  /**
   * Está pero no sirve. Son varias cosas distintas en la ficha —el estado
   * "dañado", el estado "en mantenimiento" y una condición mala— y para quien
   * recorre los ambientes son la misma: hoy no se puede usar.
   */
  private inservible(a: BaseAsset): boolean {
    return (
      a.status === AssetStatus.DAMAGED ||
      a.status === AssetStatus.MAINTENANCE ||
      a.condition === AssetCondition.POOR ||
      a.condition === AssetCondition.CRITICAL
    )
  }

  /** Ya no está en el piso: no es existencia, aunque la ficha siga viva. */
  private esDeBaja(a: BaseAsset): boolean {
    return (
      a.status === AssetStatus.RETIRED ||
      a.status === AssetStatus.SOLD ||
      a.status === AssetStatus.LOST
    )
  }

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
    private dialog: MatDialog,
  ) {
    this.dataSource = new MatTableDataSource<BaseAsset>([])
    ordenarComoLasDemas(this.dataSource)

    /**
     * Tipo y estado se ordenan por la etiqueta que se lee, no por el valor del
     * enum: la columna dice "Equipo Médico" y "En Mantenimiento", y ordenar por
     * `medical_equipment` y `maintenance` da un orden que no se corresponde con
     * nada de lo que hay en pantalla.
     */
    this.dataSource.sortingDataAccessor = (asset, columna) => {
      switch (columna) {
        case 'type': return this.getTypeLabel(asset.type)
        case 'status': return this.getStatusLabel(asset.status)
        case 'quantity': return Number(asset.quantity ?? 1)
        default: return (asset as unknown as Record<string, string>)[columna] ?? ''
      }
    }

    // matchesSearch ignora tildes además de mayúsculas: antes un
    // .toLowerCase().includes() a mano no encontraba "Bisturí" al buscar
    // "bisturi", el mismo síntoma que ya se había resuelto en farmacia.
    this.dataSource.filterPredicate = (asset: BaseAsset, filter: string) =>
      matchesSearch(filter, asset.name, asset.assetTag, asset.location, this.getTypeLabel(asset.type), asset.manufacturer)
  }

  ngOnInit(): void {
    // Volviendo de una ficha manda lo recordado: al abrir un activo Angular
    // destruye este componente, y sin esto la vuelta dejaba la lista entera y
    // en la página 1 aunque se viniera de la 12 con una tarjeta activa.
    const guardado = this.listState.recuperarSiVuelve(AssetInventoryControlComponent.RUTA)
    const params = this.route.snapshot.queryParamMap
    const vista = (guardado?.['vista'] ?? params.get('vista')) as VistaInventario | undefined
    if (vista && vista in { todos: 1, enUso: 1, porConfirmar: 1, enDesuso: 1 }) this.vista = vista
    this.searchTerm = String(guardado?.['q'] ?? params.get('q') ?? '')
    this.verDeBaja = String(guardado?.['baja'] ?? params.get('baja') ?? '') === '1'

    // Guardar lo restaurado, no solo leerlo: si nadie toca un filtro no habría
    // nada en memoria, y al volver de una ficha —a la que se llega por la ruta
    // pelada, sin parámetros— la pantalla aparecería sin filtro y en la página 1.
    this.recordarVista()

    this.loadAssets()
  }

  /** Deja la vista en la URL y la recuerda para cuando se vuelva de una ficha. */
  private recordarVista(): void {
    const estado = {
      vista: this.vista === 'todos' ? undefined : this.vista,
      q: this.searchTerm.trim() || undefined,
      baja: this.verDeBaja ? '1' : undefined,
      page: (this.dataSource.paginator?.pageIndex ?? 0) + 1,
    }
    this.listState.guardar(AssetInventoryControlComponent.RUTA, estado)
    this.listState.reflejarEnUrl(this.route, estado)
  }

  loadAssets(): void {
    this.isLoading = true
    // getAllAssets y no getAssets: este último trae solo la primera página (25),
    // y toda la pantalla —paginador, buscador y contadores— trabaja en cliente
    // sobre lo que reciba, así que el resto del inventario quedaba invisible.
    this.assetService.getAllAssets().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: result => {
        this.assets = result.filter(a => !this.esDeBaja(a))
        this.deBaja = result.filter(a => this.esDeBaja(a))
        if (this.deBaja.length === 0) this.verDeBaja = false
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
    this.recordarVista()
    this.applyFilters()
  }

  setVista(vista: VistaInventario): void {
    this.vista = vista
    this.recordarVista()
    // Las tarjetas cuentan existencias, así que pulsar una siempre devuelve al
    // inventario: no tendría sentido dejar la tabla en los dados de baja.
    this.verDeBaja = false
    this.applyFilters()
  }

  /** Enseña —o deja de enseñar— lo retirado, vendido y perdido. */
  toggleDeBaja(): void {
    this.verDeBaja = !this.verDeBaja
    if (this.verDeBaja) this.vista = 'todos'
    this.recordarVista()
    this.applyFilters()
  }

  /** Si la tabla muestra un recorte del inventario y no el inventario entero. */
  get hayFiltro(): boolean {
    return this.verDeBaja || this.vista !== 'todos' || this.searchTerm.trim() !== ''
  }

  contar(vista: VistaInventario): number {
    return vista === 'todos' ? this.assets.length : this.assets.filter(this.criterios[vista]).length
  }

  private applyFilters(): void {
    const filtered = this.verDeBaja
      ? this.deBaja
      : this.vista === 'todos'
        ? this.assets
        : this.assets.filter(this.criterios[this.vista])
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
          this.deBaja = this.deBaja.filter(a => a.id !== asset.id)
          if (this.deBaja.length === 0) this.verDeBaja = false
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
    // Lo que la pantalla está mostrando: el inventario, o los dados de baja si
    // es eso lo que se está mirando. Mezclarlos en un mismo archivo devolvería
    // el problema que esta pantalla acaba de quitarse de encima.
    const rows = (this.verDeBaja ? this.deBaja : this.assets).map(a => [
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
    const nombre = this.verDeBaja ? 'activos_de_baja' : 'activos'
    link.setAttribute('download', `${nombre}_${new Date().toISOString().split('T')[0]}.csv`)
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

  /** Traspaso a otro ambiente: un paso, con registro de quién y cuándo. */
  moveAsset(asset: BaseAsset): void {
    this.dialog
      .open(MoveAssetDialogComponent, { data: { asset }, width: '520px', autoFocus: false })
      .afterClosed()
      .subscribe(movido => {
        if (movido) this.loadAssets()
      })
  }

  /**
   * Unidades: el inventario cuenta existencias, y 235 ítems son 778 unidades.
   *
   * `Number(...)` y no `+` a secas: las columnas numéricas de Postgres viajan
   * como **string**, aunque la interfaz las declare `number`. Sumarlas con `+`
   * las concatenaba, y el resultado era una cadena larguísima que reventaba al
   * `DecimalPipe` del KPI con NG02100. Ese error tumbaba el render del template
   * entero, así que la tabla se quedaba en esqueletos y los contadores en cero:
   * la pantalla no mostraba nada. No saltó antes porque el inventario estaba
   * vacío y `reduce` devolvía el `0` inicial.
   */
  getTotalUnits(): number {
    return this.assets.reduce((n, a) => n + (Number(a.quantity) || 1), 0)
  }

}
