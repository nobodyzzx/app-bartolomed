import { Location } from '@angular/common'
import { Component, DestroyRef, inject, OnInit, ViewChild, computed, signal } from '@angular/core'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { MatPaginator } from '@angular/material/paginator'
import { MatSort } from '@angular/material/sort'
import { MatTableDataSource } from '@angular/material/table'
import { AlertService } from '@core/services/alert.service'
import { PurchaseOrder, PurchaseOrderStatus, Supplier } from '../interfaces/pharmacy.interfaces'
import { PurchaseOrdersService } from '../services/purchase-orders.service'
import { SuppliersService } from '../services/suppliers.service'

@Component({
  selector: 'app-order-generation',
  templateUrl: './order-generation.component.html',
  styleUrls: ['./order-generation.component.css'],
})
export class OrderGenerationComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef)

  @ViewChild(MatPaginator) paginator!: MatPaginator
  @ViewChild(MatSort) sort!: MatSort

  displayedColumns: string[] = [
    'orderNumber',
    'supplier',
    'orderDate',
    'status',
    'totalAmount',
    'actions',
  ]
  dataSource = new MatTableDataSource<PurchaseOrder>()

  orders: PurchaseOrder[] = []
  suppliers: Supplier[] = []

  // Filtros reactivos
  statusFilter = signal<PurchaseOrderStatus | 'all'>('all')
  supplierFilter = signal<string | 'all'>('all')
  textFilter = signal<string>('')

  filteredOrders = computed(() => {
    return this.orders.filter(o => {
      const statusOk = this.statusFilter() === 'all' || o.status === this.statusFilter()
      const supplierOk = this.supplierFilter() === 'all' || o.supplierId === this.supplierFilter()
      const text = this.textFilter().trim().toLowerCase()
      const textOk =
        !text ||
        o.orderNumber.toLowerCase().includes(text) ||
        o.supplier?.name?.toLowerCase().includes(text)
      return statusOk && supplierOk && textOk
    })
  })

  // Modal creación
  createOpen = signal(false)
  creating = signal(false)
  newSupplierId = signal('')
  newExpectedDate = signal<Date | null>(null)
  items = signal<{ productName: string; quantity: number; unitPrice: number }[]>([])
  total = computed(() =>
    this.items().reduce(
      (sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0),
      0,
    ),
  )

  stats = {
    totalOrders: 0,
    pendingOrders: 0,
    approvedOrders: 0,
    totalValue: 0,
  }

  constructor(
    private location: Location,
    private suppliersService: SuppliersService,
    private ordersService: PurchaseOrdersService,
    private alert: AlertService,
  ) {}

  goBack(): void {
    this.location.back()
  }

  ngOnInit(): void {
    this.loadOrders()
    this.loadSuppliers()
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator
    this.dataSource.sort = this.sort
  }

  loadOrders(): void {
    this.ordersService.getAll().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(orders => {
      this.orders = orders
      this.refreshDataSource()
      this.calculateStats()
    })
  }

  refreshDataSource(): void {
    this.dataSource.data = this.filteredOrders()
  }

  loadSuppliers(): void {
    this.suppliersService.getAll().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(suppliers => {
      this.suppliers = suppliers
    })
  }

  calculateStats(): void {
    this.stats.totalOrders = this.orders.length
    this.stats.pendingOrders = this.orders.filter(
      o => o.status === PurchaseOrderStatus.PENDING,
    ).length
    this.stats.approvedOrders = this.orders.filter(
      o => o.status === PurchaseOrderStatus.APPROVED,
    ).length
    this.stats.totalValue = this.orders.reduce((sum, order) => sum + (order.totalAmount || 0), 0)
  }

  applyTextFilter(value: string): void {
    this.textFilter.set(value)
    this.refreshDataSource()
    if (this.dataSource.paginator) this.dataSource.paginator.firstPage()
  }

  changeStatusFilter(status: PurchaseOrderStatus | 'all'): void {
    this.statusFilter.set(status)
    this.refreshDataSource()
    if (this.dataSource.paginator) this.dataSource.paginator.firstPage()
  }

  changeSupplierFilter(supplierId: string | 'all'): void {
    this.supplierFilter.set(supplierId)
    this.refreshDataSource()
    if (this.dataSource.paginator) this.dataSource.paginator.firstPage()
  }

  getStatusChipClass(status: PurchaseOrderStatus): string {
    switch (status) {
      case PurchaseOrderStatus.PENDING:
        return 'status-pending'
      case PurchaseOrderStatus.APPROVED:
        return 'status-approved'
      case PurchaseOrderStatus.SENT:
        return 'status-sent'
      case PurchaseOrderStatus.PARTIALLY_RECEIVED:
        return 'status-partial'
      case PurchaseOrderStatus.RECEIVED:
        return 'status-delivered'
      case PurchaseOrderStatus.CANCELLED:
        return 'status-cancelled'
      default:
        return ''
    }
  }

  getStatusLabel(status: PurchaseOrderStatus): string {
    switch (status) {
      case PurchaseOrderStatus.DRAFT:
        return 'Borrador'
      case PurchaseOrderStatus.PENDING:
        return 'Pendiente'
      case PurchaseOrderStatus.APPROVED:
        return 'Aprobado'
      case PurchaseOrderStatus.SENT:
        return 'Enviado'
      case PurchaseOrderStatus.PARTIALLY_RECEIVED:
        return 'Parcial'
      case PurchaseOrderStatus.RECEIVED:
        return 'Entregado'
      case PurchaseOrderStatus.CANCELLED:
        return 'Cancelado'
      default:
        return status
    }
  }

  viewOrder(order: PurchaseOrder): void {
    // TODO: Implementar vista de detalle de pedido
  }

  editOrder(order: PurchaseOrder): void {
    // TODO: Implementar edición de pedido
  }

  approveOrder(order: PurchaseOrder): void {
    this.ordersService
      .updateStatus(order.id!, { status: PurchaseOrderStatus.APPROVED })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadOrders())
  }

  cancelOrder(order: PurchaseOrder): void {
    this.ordersService
      .updateStatus(order.id!, { status: PurchaseOrderStatus.CANCELLED })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadOrders())
  }

  createNewOrder(): void {
    this.resetCreateForm()
    this.createOpen.set(true)
  }

  resetCreateForm(): void {
    this.newSupplierId.set('')
    this.newExpectedDate.set(null)
    this.items.set([{ productName: '', quantity: 1, unitPrice: 0 }])
    this.creating.set(false)
  }

  addItem(): void {
    this.items.update(arr => [...arr, { productName: '', quantity: 1, unitPrice: 0 }])
  }

  removeItem(index: number): void {
    const arr = this.items()
    if (arr.length <= 1) return // mantener al menos una fila
    this.items.set(arr.filter((_, i) => i !== index))
  }

  updateItem<K extends 'productName' | 'quantity' | 'unitPrice'>(
    index: number,
    key: K,
    value: K extends 'productName' ? string : number,
  ): void {
    const arr = [...this.items()]
    if (!arr[index]) return
    // normalizar numéricos
    if (key !== 'productName') {
      // @ts-expect-error narrow numeric
      value = Number(value)
    }
    // @ts-expect-error dynamic assign
    arr[index][key] = value
    this.items.set(arr)
  }

  submitCreate(): void {
    const supplierId = this.newSupplierId()
    const expected = this.newExpectedDate()

    if (!supplierId) {
      this.alert.error('Validación', 'Seleccione un proveedor')
      return
    }
    const items = this.items()
    if (!items.length) {
      this.alert.error('Validación', 'Agregue al menos un ítem')
      return
    }
    for (let i = 0; i < items.length; i++) {
      const it = items[i]
      if (!it.productName || it.productName.trim().length < 3) {
        this.alert.error('Validación', `Ítem #${i + 1}: nombre de producto inválido`)
        return
      }
      if (!Number.isFinite(it.quantity) || it.quantity <= 0) {
        this.alert.error('Validación', `Ítem #${i + 1}: cantidad inválida`)
        return
      }
      if (!Number.isFinite(it.unitPrice) || it.unitPrice < 0) {
        this.alert.error('Validación', `Ítem #${i + 1}: costo unitario inválido`)
        return
      }
    }

    this.creating.set(true)
    const dto = {
      supplierId,
      orderDate: new Date().toISOString(),
      expectedDeliveryDate: expected ? expected.toISOString() : undefined,
      items: items.map(it => ({
        productName: it.productName.trim(),
        quantity: Number(it.quantity),
        unitPrice: Number(it.unitPrice),
      })),
    }
    this.ordersService.create(dto).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.createOpen.set(false)
        this.resetCreateForm()
        this.loadOrders()
      },
      error: () => this.creating.set(false),
    })
  }
}
