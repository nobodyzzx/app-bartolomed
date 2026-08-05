import { Component, DestroyRef, inject, OnInit } from '@angular/core'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { MatDialog } from '@angular/material/dialog'
import { Router } from '@angular/router'
import { AlertService } from '@core/services/alert.service'
import { AuthService } from '../../../auth/services/auth.service'
import { ServicePriceFormDialogComponent } from './service-price-form-dialog/service-price-form-dialog.component'
import {
  APPOINTMENT_TYPE_LABELS,
  CATEGORY_LABELS,
  ServiceCategory,
  ServicePrice,
  ServicePricePayload,
  ServicePricesService,
} from './service-prices.service'

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
  showInactive = false

  constructor(
    private servicePricesService: ServicePricesService,
    private authService: AuthService,
    private dialog: MatDialog,
    private alert: AlertService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.load()
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
        pageSize: 200,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          this.prices = res.items
          this.loading = false
        },
        error: () => {
          this.loading = false
        },
      })
  }

  pricesOf(category: ServiceCategory): ServicePrice[] {
    return this.prices.filter(p => p.category === category)
  }

  countOf(category: ServiceCategory): number {
    return this.pricesOf(category).length
  }

  create(): void {
    this.openForm()
  }

  edit(price: ServicePrice): void {
    this.openForm(price)
  }

  private openForm(price?: ServicePrice): void {
    const dialogRef = this.dialog.open(ServicePriceFormDialogComponent, {
      data: { price },
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
