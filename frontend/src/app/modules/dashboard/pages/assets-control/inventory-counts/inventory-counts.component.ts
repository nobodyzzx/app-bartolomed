import { Location } from '@angular/common'
import { Component, DestroyRef, OnInit, inject } from '@angular/core'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { AlertService } from '@core/services/alert.service'
import {
  InventoryCount,
  InventoryCountItem,
  InventoryCountStatus,
} from '../interfaces/assets.interfaces'
import { AssetRegistrationService } from '../services/asset-registration.service'
import { InventoryCountsService } from '../services/inventory-counts.service'

/**
 * Toma de inventario físico: se abre un conteo por ambiente, se carga lo hallado
 * y al cerrarlo el inventario queda ajustado con su acta de diferencias.
 *
 * Cierra el ciclo que hasta ahora terminaba en un cajón: la hoja se imprimía, se
 * contaba a mano y el resultado no volvía al sistema.
 */
@Component({
  selector: 'app-inventory-counts',
  templateUrl: './inventory-counts.component.html',
  standalone: false,
})
export class InventoryCountsComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef)
  private readonly service = inject(InventoryCountsService)
  private readonly assetService = inject(AssetRegistrationService)
  private readonly alert = inject(AlertService)
  private readonly location = inject(Location)

  readonly Status = InventoryCountStatus

  counts: InventoryCount[] = []
  locations: string[] = []
  selected: InventoryCount | null = null
  nuevaUbicacion = ''
  isLoading = false
  isSaving = false

  /** Lo tecleado por línea, para no pisar el conteo guardado hasta confirmar. */
  contado: Record<string, number | null> = {}
  observacion: Record<string, string> = {}

  ngOnInit(): void {
    this.load()
    this.assetService
      .getLocations()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: locs => (this.locations = [...locs].sort((a, b) => a.localeCompare(b, 'es'))),
        error: () => (this.locations = []),
      })
  }

  load(): void {
    this.isLoading = true
    this.service
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: counts => {
          this.counts = counts
          this.isLoading = false
          // Al entrar, se abre directamente el conteo en curso si lo hay: es lo
          // que la persona viene a continuar.
          const abierto = counts.find(c => c.status === InventoryCountStatus.OPEN)
          if (abierto && !this.selected) this.open(abierto)
        },
        error: () => (this.isLoading = false),
      })
  }

  start(): void {
    this.service.start(this.nuevaUbicacion || undefined).subscribe({
      next: count => {
        this.nuevaUbicacion = ''
        this.load()
        this.open(count)
      },
    })
  }

  open(count: InventoryCount): void {
    this.service.get(count.id).subscribe({
      next: full => {
        this.selected = full
        this.contado = {}
        this.observacion = {}
        for (const item of full.items ?? []) {
          this.contado[item.id] = item.countedQuantity
          this.observacion[item.id] = item.notes ?? ''
        }
      },
    })
  }

  /** Diferencia contra lo esperado, o null si la línea sigue sin contar. */
  diferencia(item: InventoryCountItem): number | null {
    const c = this.contado[item.id]
    if (c === null || c === undefined) return null
    return c - item.expectedQuantity
  }

  guardar(): void {
    if (!this.selected) return
    const items = (this.selected.items ?? [])
      .filter(i => {
        const c = this.contado[i.id]
        return c !== null && c !== undefined
      })
      .map(i => ({
        itemId: i.id,
        countedQuantity: Number(this.contado[i.id]),
        notes: this.observacion[i.id] || undefined,
      }))

    if (items.length === 0) {
      this.alert.warning('Sin cambios', 'Carga al menos una cantidad contada')
      return
    }

    this.isSaving = true
    this.service.saveCounted(this.selected.id, items).subscribe({
      next: () => {
        this.isSaving = false
        this.alert.success('Guardado', `${items.length} línea(s) registradas`)
        this.open(this.selected!)
      },
      error: () => (this.isSaving = false),
    })
  }

  async cerrar(ajustar: boolean): Promise<void> {
    if (!this.selected) return
    const s = this.selected.summary
    const { isConfirmed } = await this.alert.confirm({
      icon: 'question',
      title: ajustar ? '¿Cerrar y ajustar el inventario?' : '¿Cerrar sin ajustar?',
      text: ajustar
        ? `Las cantidades pasarán a lo contado: ${s?.faltantes ?? 0} faltante(s) y ${s?.sobrantes ?? 0} sobrante(s). Lo contado en cero quedará como extraviado.`
        : 'Queda el registro de la diferencia, pero el inventario no cambia.',
      confirmButtonText: ajustar ? 'Cerrar y ajustar' : 'Cerrar sin ajustar',
      cancelButtonText: 'Volver',
    })
    if (!isConfirmed) return

    this.service.close(this.selected.id, ajustar).subscribe({
      next: () => {
        this.selected = null
        this.load()
      },
    })
  }

  async cancelar(count: InventoryCount): Promise<void> {
    const { isConfirmed } = await this.alert.confirm({
      icon: 'warning',
      title: '¿Cancelar el conteo?',
      text: `Se descarta ${count.countNumber} y lo cargado hasta ahora.`,
      confirmButtonText: 'Cancelar conteo',
      cancelButtonText: 'Volver',
    })
    if (!isConfirmed) return
    this.service.cancel(count.id).subscribe({
      next: () => {
        if (this.selected?.id === count.id) this.selected = null
        this.load()
      },
    })
  }

  acta(count: InventoryCount): void {
    this.service.downloadAct(count).subscribe()
  }

  statusLabel(status: InventoryCountStatus): string {
    return { open: 'Abierto', closed: 'Cerrado', cancelled: 'Cancelado' }[status] ?? status
  }

  statusClass(status: InventoryCountStatus): string {
    return (
      {
        open: 'bg-blue-100 text-blue-800',
        closed: 'bg-green-100 text-green-800',
        cancelled: 'bg-slate-100 text-slate-600',
      }[status] ?? 'bg-slate-100 text-slate-600'
    )
  }

  goBack(): void {
    this.location.back()
  }
}
