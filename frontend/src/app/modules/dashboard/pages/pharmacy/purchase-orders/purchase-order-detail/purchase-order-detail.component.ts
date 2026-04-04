import { Location } from '@angular/common'
import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { ActivatedRoute, Router } from '@angular/router'
import { AlertService } from '@core/services/alert.service'
import { PurchaseOrder, PurchaseOrderStatus, Supplier } from '../../interfaces/pharmacy.interfaces'
import { PurchaseOrdersService } from '../../services/purchase-orders.service'
import { SuppliersService } from '../../services/suppliers.service'

@Component({
    selector: 'app-purchase-order-detail',
    templateUrl: './purchase-order-detail.component.html',
    styleUrls: ['./purchase-order-detail.component.css'],
    standalone: false
})
export class PurchaseOrderDetailComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef)
  private route = inject(ActivatedRoute)
  private router = inject(Router)
  private location = inject(Location)
  private purchaseOrdersService = inject(PurchaseOrdersService)
  private suppliersService = inject(SuppliersService)
  private alertService = inject(AlertService)

  order = signal<PurchaseOrder | null>(null)
  loading = signal(true)
  PurchaseOrderStatus = PurchaseOrderStatus
  suppliers = signal<Supplier[]>([])

  // Computed properties
  canEdit = computed(() => {
    const status = this.order()?.status
    return status === PurchaseOrderStatus.DRAFT || status === PurchaseOrderStatus.PENDING
  })

  canDelete = computed(() => this.order()?.status === PurchaseOrderStatus.DRAFT)

  canReceive = computed(() => {
    const status = this.order()?.status
    return (
      status === PurchaseOrderStatus.SENT ||
      status === PurchaseOrderStatus.PARTIALLY_RECEIVED ||
      status === PurchaseOrderStatus.RECEIVED
    )
  })

  itemsCount = computed(() => this.order()?.items?.length || 0)

  totalItems = computed(
    () => this.order()?.items?.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0) || 0,
  )

  ngOnInit(): void {
    // Suscribirse a cambios por si se reutiliza el componente
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      const id = params.get('id')
      if (id) {
        this.loadSuppliers()
        this.loadOrder(id)
      } else {
        this.order.set(null)
      }
    })
  }

  loadOrder(id: string): void {
    this.loading.set(true)
    this.purchaseOrdersService.getById(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: raw => {
        const order = this.adaptOrder(raw)
        this.order.set(order)
        this.loading.set(false)
      },
      error: () => {
        this.alertService.error('Error', 'No se pudo cargar la orden de compra')
        this.loading.set(false)
        this.order.set(null)
      },
    })
  }

  goBack(): void {
    this.location.back()
  }

  editOrder(): void {
    if (this.order()) {
      this.router.navigate(['/dashboard/pharmacy/purchase-orders/edit', this.order()!.id])
    }
  }

  receiveOrder(): void {
    if (this.order()) {
      this.router.navigate(['/dashboard/pharmacy/purchase-orders/receive', this.order()!.id])
    }
  }

  async deleteOrder(): Promise<void> {
    const result = await this.alertService.confirm({
      title: '¿Eliminar orden?',
      text: 'Esta acción no se puede deshacer',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
    })

    if (result.isConfirmed && this.order()) {
      // TODO: Implementar método delete en el servicio
      this.alertService.warning(
        'Próximamente',
        'La eliminación de órdenes estará disponible pronto',
      )
    }
  }

  async changeStatus(newStatus: PurchaseOrderStatus): Promise<void> {
    const confirmText = this.getStatusConfirmText(newStatus)
    const result = await this.alertService.confirm({
      title: '¿Cambiar estado?',
      text: confirmText,
      confirmButtonText: 'Sí, cambiar',
      cancelButtonText: 'Cancelar',
    })

    if (result.isConfirmed && this.order()) {
      this.purchaseOrdersService.updateStatus(this.order()!.id, { status: newStatus }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: updated => {
          this.alertService.success(
            'Estado actualizado',
            `Orden marcada como ${this.getStatusLabel(newStatus)}`,
          )
          this.order.set(updated)
        },
        error: () => {
          this.alertService.error('Error', 'No se pudo actualizar el estado')
        },
      })
    }
  }

  printOrder(): void {
    window.print()
  }

  exportPDF(): void {
    this.alertService.warning('Próximamente', 'La exportación a PDF estará disponible pronto')
  }

  getStatusLabel(status: PurchaseOrderStatus): string {
    const labels: Record<PurchaseOrderStatus, string> = {
      [PurchaseOrderStatus.DRAFT]: 'Borrador',
      [PurchaseOrderStatus.PENDING]: 'Pendiente',
      [PurchaseOrderStatus.APPROVED]: 'Aprobada',
      [PurchaseOrderStatus.SENT]: 'Enviada',
      [PurchaseOrderStatus.PARTIALLY_RECEIVED]: 'Parcialmente Recibida',
      [PurchaseOrderStatus.RECEIVED]: 'Recibida',
      [PurchaseOrderStatus.DELIVERED]: 'Entregada',
      [PurchaseOrderStatus.CANCELLED]: 'Cancelada',
    }
    return labels[status] || status
  }

  getStatusColor(status: PurchaseOrderStatus): string {
    const colors: Record<PurchaseOrderStatus, string> = {
      [PurchaseOrderStatus.DRAFT]: 'bg-slate-100 text-slate-700',
      [PurchaseOrderStatus.PENDING]: 'bg-yellow-100 text-yellow-700',
      [PurchaseOrderStatus.APPROVED]: 'bg-blue-100 text-blue-700',
      [PurchaseOrderStatus.SENT]: 'bg-purple-100 text-purple-700',
      [PurchaseOrderStatus.PARTIALLY_RECEIVED]: 'bg-orange-100 text-orange-700',
      [PurchaseOrderStatus.RECEIVED]: 'bg-green-100 text-green-700',
      [PurchaseOrderStatus.DELIVERED]: 'bg-green-200 text-green-800',
      [PurchaseOrderStatus.CANCELLED]: 'bg-red-100 text-red-700',
    }
    return colors[status] || 'bg-slate-100 text-slate-700'
  }

  private getStatusConfirmText(status: PurchaseOrderStatus): string {
    const texts: Record<PurchaseOrderStatus, string> = {
      [PurchaseOrderStatus.DRAFT]: 'Se marcará la orden como borrador',
      [PurchaseOrderStatus.PENDING]: 'Se enviará la orden para aprobación',
      [PurchaseOrderStatus.APPROVED]: 'Se aprobará la orden de compra',
      [PurchaseOrderStatus.SENT]: 'Se marcará la orden como enviada al proveedor',
      [PurchaseOrderStatus.PARTIALLY_RECEIVED]: 'Se marcará como parcialmente recibida',
      [PurchaseOrderStatus.RECEIVED]: 'Se marcará como completamente recibida',
      [PurchaseOrderStatus.DELIVERED]: 'Se marcará como entregada',
      [PurchaseOrderStatus.CANCELLED]: 'Se cancelará la orden de compra',
    }
    return texts[status] || 'Se cambiará el estado de la orden'
  }

  // Devuelve los estados a los que se puede cambiar desde el estado actual
  getAvailableStatusChanges(): PurchaseOrderStatus[] {
    const current = this.order()?.status
    if (!current) return []
    const transitions: Record<PurchaseOrderStatus, PurchaseOrderStatus[]> = {
      [PurchaseOrderStatus.DRAFT]: [
        PurchaseOrderStatus.PENDING,
        PurchaseOrderStatus.APPROVED,
        PurchaseOrderStatus.CANCELLED,
      ],
      [PurchaseOrderStatus.PENDING]: [PurchaseOrderStatus.APPROVED, PurchaseOrderStatus.CANCELLED],
      [PurchaseOrderStatus.APPROVED]: [PurchaseOrderStatus.SENT, PurchaseOrderStatus.CANCELLED],
      [PurchaseOrderStatus.SENT]: [
        PurchaseOrderStatus.PARTIALLY_RECEIVED,
        PurchaseOrderStatus.RECEIVED,
      ],
      [PurchaseOrderStatus.PARTIALLY_RECEIVED]: [PurchaseOrderStatus.RECEIVED],
      [PurchaseOrderStatus.RECEIVED]: [PurchaseOrderStatus.DELIVERED],
      [PurchaseOrderStatus.DELIVERED]: [],
      [PurchaseOrderStatus.CANCELLED]: [],
    }
    return transitions[current] || []
  }

  // Placeholder: abre flujo de recepción (por ahora navega a la ruta de recepción)
  openReceiveModal(): void {
    this.receiveOrder()
  }

  supplierDisplayName(): string {
    const o = this.order()
    if (!o) return ''
    const rel: any = o.supplier
    const nameRel = (rel?.tradeName || rel?.nombreComercial || rel?.name || '').toString()
    if (nameRel) return nameRel
    const s = this.suppliers().find(x => x.id === o.supplierId)
    return ((s as any)?.tradeName || s?.nombreComercial || s?.name || 'Sin proveedor').toString()
  }

  private adaptOrder(order: PurchaseOrder): PurchaseOrder {
    return {
      ...order,
      subtotal: Number(order.subtotal) || 0,
      taxRate: Number(order.taxRate) || 0,
      taxAmount: Number(order.taxAmount) || 0,
      discountAmount: Number(order.discountAmount) || 0,
      shippingCost: Number(order.shippingCost) || 0,
      // soporte legacy: algunas respuestas antiguas podían usar 'total'
      totalAmount: Number(order.totalAmount) || (order as any).total || 0,
      items: (order.items || []).map(it => ({
        ...it,
        quantity: Number(it.quantity) || 0,
        unitPrice: Number(it.unitPrice) || 0,
        productName:
          it.productName ||
          it.medicationName ||
          (it as any).brand ||
          (it as any).productCode ||
          'Producto sin nombre',
        subtotal:
          Number((it as any).subtotal) ||
          Number((it as any).totalPrice) ||
          (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0),
        receivedQuantity: Number(it.receivedQuantity) || 0,
      })),
    }
  }

  private loadSuppliers(): void {
    this.suppliersService.getAll().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: list => this.suppliers.set(list),
      error: () => {},
    })
  }
}
