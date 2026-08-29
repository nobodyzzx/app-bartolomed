import { Location } from '@angular/common'
import { Component, DestroyRef, inject, OnInit, computed, signal } from '@angular/core'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { ActivatedRoute, Router } from '@angular/router'
import { AlertService } from '@core/services/alert.service'
import { openPdfInNewTab } from '../../../../../../shared/utils/pdf-viewer.util'
import { Sale, SaleStatus } from '../../interfaces/pharmacy.interfaces'
import { SalesDispensingService } from '../../services/sales-dispensing.service'

@Component({
    selector: 'app-sale-details',
    templateUrl: './sale-details.component.html',
    styleUrls: ['./sale-details.component.css'],
    standalone: false
})
export class SaleDetailsComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef)

  loading = signal(false)
  sale = signal<Sale | null>(null)

  /**
   * En la práctica toda venta nace COMPLETED (ver PharmacySalesService.create):
   * no hay un flujo real de "venta pendiente" que alguien complete después, así
   * que la única acción que existe de verdad es cancelar. Antes el botón
   * "Completar Venta" solo se mostraba si `isPending()`, condición que nunca se
   * daba — un botón que nadie podía ver — mientras que "Cancelar" también
   * exigía `isPending()`, así que una venta COMPLETED (el 100% de los casos)
   * no se podía cancelar desde esta pantalla.
   */
  canCancel = computed(() => this.sale()?.status !== SaleStatus.CANCELLED)

  /**
   * Ítems con descuento propio (independiente del descuento sobre el total).
   * Solo para el bloque de staff, marcado `no-print`: esta pantalla dobla de
   * recibo imprimible y el motivo del descuento no debe salir de cara al
   * paciente — ver el comentario en el template.
   */
  discountedItems = computed(() => (this.sale()?.items ?? []).filter(i => (i.discount ?? 0) > 0))

  hasDiscount = computed(() => {
    const s = this.sale()
    return !!s && ((s.discount ?? 0) > 0 || this.discountedItems().length > 0)
  })

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

  async cancelSale(): Promise<void> {
    const s = this.sale()
    if (!s) return

    if (s.status === SaleStatus.CANCELLED) {
      this.alert.warning('Advertencia', 'Esta venta ya está cancelada')
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
      // Bug real: esto usaba `this.alert.fire({ input: 'textarea', ... })`,
      // pero `fire()` ignora `input`/`inputPlaceholder` por completo —
      // `_openConfirmDialog()` nunca les pasa `inputLabel` a ConfirmDialogComponent,
      // así que el diálogo mostraba un simple sí/no SIN caja de texto y cerraba
      // con `true` (sin `.value`). `notes` quedaba siempre `undefined` y el
      // `if (notes)` de abajo nunca se cumplía: cancelar una venta desde acá
      // no hacía nada, con o sin el fix del estado. `prompt()` sí abre un
      // input de verdad (es lo que ya usa correctamente el punto de cobro
      // para anular una factura).
      //
      // El backend exige mínimo 5 caracteres para cancelar (mismo criterio
      // que anular una factura) — validado acá también para no hacer ir y
      // volver a alguien que escribió "ok" solo para que el 400 se lo rebote.
      const { value: notes } = await this.alert.prompt({
        title: 'Motivo de cancelación',
        inputLabel: 'Motivo',
        inputPlaceholder: 'Ingrese el motivo...',
        confirmButtonText: 'Confirmar',
        cancelButtonText: 'Volver',
        inputValidator: value =>
          (value ?? '').trim().length < 5 ? 'Explique por qué se cancela (mínimo 5 caracteres)' : null,
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

  /**
   * Antes esto era `window.print()` de esta misma pantalla (con menús,
   * botones y el bloque de descuento oculto por CSS al imprimir) — ahora
   * trae el recibo en PDF que genera el backend, igual que el punto de
   * cobro. La pantalla vuelve a ser solo el detalle interno de la venta.
   */
  downloadReceipt(): void {
    const s = this.sale()
    if (!s) return
    this.salesService.downloadReceipt(s.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: blob => openPdfInNewTab(blob, `${s.saleNumber}.pdf`),
    })
  }

  goBack(): void {
    this.location.back()
  }
}
