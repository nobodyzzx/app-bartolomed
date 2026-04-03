import { Location } from '@angular/common'
import { Component, DestroyRef, inject, OnInit, computed, signal } from '@angular/core'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { ActivatedRoute, Router } from '@angular/router'
import { AlertService } from '@core/services/alert.service'
import { Sale, SaleStatus } from '../../interfaces/pharmacy.interfaces'
import { SalesDispensingService } from '../../services/sales-dispensing.service'

@Component({
  selector: 'app-sale-details',
  templateUrl: './sale-details.component.html',
  styleUrls: ['./sale-details.component.css'],
})
export class SaleDetailsComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef)

  loading = signal(false)
  sale = signal<Sale | null>(null)

  isPending = computed(() => this.sale()?.status === SaleStatus.PENDING)

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private salesService: SalesDispensingService,
    private alert: AlertService,
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id')
    if (!id) {
      this.alert.error('Error', 'ID de venta no proporcionado')
      this.goBack()
      return
    }
    this.loadSale(id)
  }

  loadSale(id: string): void {
    this.loading.set(true)
    this.salesService.getSaleById(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: sale => {
        this.sale.set(sale)
        this.loading.set(false)
      },
      error: () => {
        this.loading.set(false)
        this.alert.error('Error', 'No se pudo cargar la venta')
      },
    })
  }

  async completeSale(): Promise<void> {
    const s = this.sale()
    if (!s) return

    if (s.status !== SaleStatus.PENDING) {
      this.alert.warning('Advertencia', 'Solo se pueden completar ventas pendientes')
      return
    }

    const result = await this.alert.fire({
      icon: 'question',
      title: '¿Completar venta?',
      text: 'Se reducirá el inventario automáticamente',
      showCancelButton: true,
      confirmButtonText: 'Sí, completar',
      cancelButtonText: 'Cancelar',
    })

    if (result.isConfirmed) {
      this.loading.set(true)
      this.salesService.updateSaleStatus(s.id, SaleStatus.COMPLETED).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: updated => {
          this.sale.set(updated)
          this.loading.set(false)
          this.alert.success('Éxito', 'Venta completada correctamente')
        },
        error: () => {
          this.loading.set(false)
        },
      })
    }
  }

  async cancelSale(): Promise<void> {
    const s = this.sale()
    if (!s) return

    if (s.status !== SaleStatus.PENDING) {
      this.alert.warning('Advertencia', 'Solo se pueden cancelar ventas pendientes')
      return
    }

    const result = await this.alert.fire({
      icon: 'warning',
      title: '¿Cancelar venta?',
      text: 'Esta acción no se puede deshacer',
      showCancelButton: true,
      confirmButtonText: 'Sí, cancelar',
      cancelButtonText: 'No',
    })

    if (result.isConfirmed) {
      const { value: notes } = await this.alert.fire({
        title: 'Motivo de cancelación',
        input: 'textarea',
        inputPlaceholder: 'Ingrese el motivo...',
        showCancelButton: true,
        confirmButtonText: 'Confirmar',
        cancelButtonText: 'Volver',
      })

      if (notes) {
        this.loading.set(true)
        this.salesService.updateSaleStatus(s.id, SaleStatus.CANCELLED, notes).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
          next: updated => {
            this.sale.set(updated)
            this.loading.set(false)
            this.alert.success('Éxito', 'Venta cancelada')
          },
          error: () => {
            this.loading.set(false)
          },
        })
      }
    }
  }

  printReceipt(): void {
    // Estrategia simple: imprimir toda la página; para plantillas avanzadas, aislar sección con CSS @media print
    window.print()
  }

  goBack(): void {
    this.location.back()
  }
}
