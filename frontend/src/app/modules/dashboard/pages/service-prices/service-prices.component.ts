import { Component, DestroyRef, inject, OnInit } from '@angular/core'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs'
import { MatDialog } from '@angular/material/dialog'
import { Router } from '@angular/router'
import { AlertService } from '@core/services/alert.service'
import { AuthService } from '../../../auth/services/auth.service'
import { ApplyMarginDialogComponent } from './apply-margin-dialog/apply-margin-dialog.component'
import { ServicePriceFormDialogComponent } from './service-price-form-dialog/service-price-form-dialog.component'
import {
  APPOINTMENT_TYPE_LABELS,
  CATEGORY_LABELS,
  ServiceCategory,
  ServicePrice,
  ServicePricePayload,
  ServicePricesService,
} from './service-prices.service'

/** Columnas por las que se puede ordenar el tarifario. */
type SortKey = 'code' | 'name' | 'appointmentType' | 'costPrice' | 'margin' | 'price' | 'isActive'

@Component({
  selector: 'app-service-prices',
  templateUrl: './service-prices.component.html',
  standalone: false,
})
export class ServicePricesComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef)

  readonly ServiceCategory = ServiceCategory
  readonly categories = Object.values(ServiceCategory)
  readonly categoryLabels = CATEGORY_LABELS
  readonly appointmentTypeLabels = APPOINTMENT_TYPE_LABELS

  prices: ServicePrice[] = []
  loading = false

  categoryFilter: ServiceCategory | '' = ''
  search = ''

  /**
   * La búsqueda pega al servidor, así que se espera a que se deje de teclear.
   * Antes había que pulsar Enter, y era el único buscador de la aplicación que
   * lo pedía: escribir y no ver nada parece un fallo, no una instrucción.
   * 300 ms es lo que usan los demás listados.
   */
  private readonly searchInput$ = new Subject<string>()

  /** Columna por la que se ordena dentro de cada categoría. */
  sortKey: SortKey = 'name'
  sortDir: 'asc' | 'desc' = 'asc'
  /**
   * Encendido por defecto: esta es la pantalla desde la que se administra el
   * tarifario, y un servicio que no se ve es un servicio que no se puede
   * activar ni poner en precio. Con el filtro apagado, los estudios especiales
   * —dados de alta inactivos y a Bs 0 a la espera de tarifa— no aparecían por
   * ningún lado y la tarjeta de resumen decía "0", así que parecían no existir.
   */
  showInactive = true

  constructor(
    private servicePricesService: ServicePricesService,
    private authService: AuthService,
    private dialog: MatDialog,
    private alert: AlertService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.load()
    this.searchInput$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(value => {
        this.search = (value ?? '').trim()
        this.load()
      })
  }

  onSearchInput(value: string): void {
    this.searchInput$.next(value)
  }

  /**
   * Ordena por una columna; volver a pulsarla invierte el sentido.
   *
   * El orden se aplica dentro de cada categoría, que es como está agrupado el
   * tarifario: mezclar consultas con exámenes en una sola lista ordenada
   * rompería la lectura por bloques.
   */
  sortBy(key: SortKey): void {
    if (this.sortKey === key) {
      this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc'
    } else {
      this.sortKey = key
      this.sortDir = 'asc'
    }
    this.indexByCategory()
  }

  sortIcon(key: SortKey): string {
    if (this.sortKey !== key) return 'unfold_more'
    return this.sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward'
  }

  /**
   * Solo ADMIN/SUPER_ADMIN editan el tarifario — recepción lo consulta para
   * cobrar pero no cambia precios. Espeja el `SettingsManage` del backend.
   */
  canManage(): boolean {
    const roles = this.authService.currentUser()?.roles ?? []
    return roles.includes('admin') || roles.includes('super-admin')
  }

  load(): void {
    this.loading = true
    this.servicePricesService
      .list({
        category: this.categoryFilter || undefined,
        search: this.search.trim() || undefined,
        isActive: this.showInactive ? undefined : 'true',
        // Sin paginar en la práctica: el tarifario ronda las 165 filas entre
        // los 120 exámenes de laboratorio y el resto. Partirlo en páginas
        // escondería servicios en una pantalla cuyo trabajo es enseñarlos.
        pageSize: 500,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          this.prices = res.items
          this.indexByCategory()
          this.loading = false
        },
        error: () => {
          this.loading = false
        },
      })
  }

  /**
   * Filas por categoría, ya ordenadas. Se calcula una vez por carga o por
   * cambio de orden y no en cada ciclo de detección de cambios: la plantilla
   * llama a esto varias veces por categoría y otra vez por fila, y con 165
   * servicios filtrar y ordenar en cada pasada se nota.
   */
  private byCategory = new Map<ServiceCategory, ServicePrice[]>()

  pricesOf(category: ServiceCategory): ServicePrice[] {
    return this.byCategory.get(category) ?? []
  }

  countOf(category: ServiceCategory): number {
    return this.pricesOf(category).length
  }

  private indexByCategory(): void {
    const dir = this.sortDir === 'asc' ? 1 : -1
    const valor = (p: ServicePrice): string | number => {
      switch (this.sortKey) {
        case 'code': return p.code ?? ''
        case 'appointmentType': return p.appointmentType ? this.appointmentTypeLabels[p.appointmentType] : ''
        case 'costPrice': return Number(p.costPrice ?? -1)
        case 'margin': return this.marginPct(p) ?? Number.NEGATIVE_INFINITY
        case 'price': return Number(p.price)
        case 'isActive': return p.isActive ? 1 : 0
        default: return p.name ?? ''
      }
    }

    this.byCategory = new Map(
      this.categories.map(category => [
        category,
        this.prices
          .filter(p => p.category === category)
          .sort((a, b) => {
            const va = valor(a)
            const vb = valor(b)
            const cmp =
              typeof va === 'number' && typeof vb === 'number'
                ? va - vb
                : String(va).localeCompare(String(vb), 'es', { numeric: true })
            return cmp * dir
          }),
      ]),
    )
  }

  /**
   * Las columnas de costo y margen solo tienen sentido donde hay un tercero
   * cobrando: los estudios derivados al laboratorio externo. En consultas y
   * procedimientos la clínica no compra nada, así que la columna sobra.
   */
  hasCost(category: ServiceCategory): boolean {
    return this.pricesOf(category).some(p => p.costPrice !== null && p.costPrice !== undefined)
  }

  /**
   * Servicios dados de alta sin tarifa acordada. Se cargan a Bs 0 e inactivos
   * a propósito —es la salvaguarda para no cobrarlos gratis—, pero eso solo
   * funciona si quien administra el tarifario ve cuáles le faltan por poner.
   */
  get sinPrecio(): number {
    return this.prices.filter(p => Number(p.price) === 0).length
  }

  needsPrice(price: ServicePrice): boolean {
    return Number(price.price) === 0
  }

  /** Margen sobre el costo, en porcentaje. Null cuando no hay costo con el que comparar. */
  marginPct(price: ServicePrice): number | null {
    const costo = Number(price.costPrice ?? 0)
    if (!costo) return null
    return ((Number(price.price) - costo) / costo) * 100
  }

  create(): void {
    this.openForm()
  }

  edit(price: ServicePrice): void {
    this.openForm(price)
  }

  /** Margen en bloque: el diálogo enseña la vista previa y aplica si se confirma. */
  openMarginDialog(): void {
    this.dialog
      .open(ApplyMarginDialogComponent, {
        width: '760px',
        maxWidth: '95vw',
        panelClass: 'rounded-dialog',
      })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(result => {
        // Solo recarga si de verdad se aplicó: cerrar la vista previa no debe
        // costar una petición más.
        if (result?.applied) this.load()
      })
  }

  private openForm(price?: ServicePrice): void {
    const dialogRef = this.dialog.open(ServicePriceFormDialogComponent, {
      // Los códigos ya cargados alimentan la sugerencia del hint; quien genera
      // el definitivo es el backend, que los ve todos.
      data: { price, codes: this.prices.map(p => p.code) },
      width: '720px',
      maxWidth: '95vw',
      panelClass: 'rounded-dialog',
    })

    dialogRef
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((payload: ServicePricePayload | undefined) => {
        if (!payload) return

        const request$ = price
          ? this.servicePricesService.update(price.id, payload)
          : this.servicePricesService.create(payload)

        request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
          next: () => this.load(),
        })
      })
  }

  /**
   * Vuelve a poner en servicio algo dado de baja. Existe porque la baja es
   * reversible y llegar hasta ella abriendo el formulario completo, para tocar
   * un único interruptor, no es razonable.
   */
  reactivate(price: ServicePrice): void {
    this.servicePricesService
      .update(price.id, { isActive: true })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: () => this.load() })
  }

  async remove(price: ServicePrice): Promise<void> {
    const result = await this.alert.fire({
      icon: 'warning',
      title: '¿Dar de baja este servicio?',
      html: `<p><strong>${price.name}</strong> (${price.code}) dejará de estar disponible al cobrar.</p>
             <p class="text-sm text-slate-500">Los cobros ya emitidos conservan su precio y no se ven afectados.</p>`,
      showCancelButton: true,
      confirmButtonText: 'Dar de baja',
      cancelButtonText: 'Cancelar',
    })

    if (!result.isConfirmed) return

    this.servicePricesService
      .remove(price.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: () => this.load() })
  }

  goBack(): void {
    this.router.navigate(['/dashboard'])
  }
}
