import { Location } from '@angular/common'
import { Component, computed, effect, OnInit, signal, ViewChild } from '@angular/core'
import { MatPaginator } from '@angular/material/paginator'
import { MatSort } from '@angular/material/sort'
import { MatTableDataSource } from '@angular/material/table'
import { Router } from '@angular/router'
import { AlertService } from '@core/services/alert.service'
import { PurchaseOrder, PurchaseOrderStatus, Supplier } from '../interfaces/pharmacy.interfaces'
import { PurchaseOrdersService } from '../services/purchase-orders.service'
import { SuppliersService } from '../services/suppliers.service'

@Component({
  selector: 'app-purchase-orders',
  templateUrl: './purchase-orders.component.html',
  styleUrls: ['./purchase-orders.component.css'],
})
export class PurchaseOrdersComponent implements OnInit {
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

  loading = signal(false)
  orders = signal<PurchaseOrder[]>([])
  suppliers = signal<Supplier[]>([])

  // Filtros
  search = signal('')
  statusFilter = signal<PurchaseOrderStatus | 'all'>('all')
  supplierFilter = signal<string | 'all'>('all')

  // Órdenes filtradas
  filtered = computed(() => {
    const term = this.search().toLowerCase().trim()
    const status = this.statusFilter()
    const supplier = this.supplierFilter()

    return this.orders().filter(order => {
      // Filtro de texto
      const supplierName = this.supplierDisplayName(order).toLowerCase()
      const matchesText =
        !term || order.orderNumber.toLowerCase().includes(term) || supplierName.includes(term)

      // Filtro de estado
      const matchesStatus = status === 'all' || order.status === status

      // Filtro de proveedor
      const matchesSupplier = supplier === 'all' || order.supplierId === supplier

      return matchesText && matchesStatus && matchesSupplier
    })
  })

  // Estadísticas
  stats = computed(() => {
    const all = this.orders()
    return {
      total: all.length,
      draft: all.filter(o => o.status === PurchaseOrderStatus.DRAFT).length,
      pending: all.filter(o => o.status === PurchaseOrderStatus.PENDING).length,
      approved: all.filter(o => o.status === PurchaseOrderStatus.APPROVED).length,
      received: all.filter(o => o.status === PurchaseOrderStatus.RECEIVED).length,
      totalValue: all.reduce((sum, o) => sum + (o.totalAmount || 0), 0),
    }
  })

  readonly orderStatuses = Object.values(PurchaseOrderStatus)

  constructor(
    private ordersService: PurchaseOrdersService,
    private suppliersService: SuppliersService,
    private alert: AlertService,
    private router: Router,
    private location: Location,
  ) {
    // Efecto para actualizar dataSource cuando cambien los filtros
    effect(() => {
      this.dataSource.data = this.filtered()
    })
  }

  ngOnInit(): void {
    this.loadOrders()
    this.loadSuppliers()
  }

  ngAfterViewInit(): void {
    this.dataSource.paginator = this.paginator
    this.dataSource.sort = this.sort

    // Asegurar ordenamiento correcto por campos derivados
    this.dataSource.sortingDataAccessor = (item: PurchaseOrder, property: string) => {
      switch (property) {
        case 'orderNumber':
          return item.orderNumber || ''
        case 'supplier':
          return this.supplierDisplayName(item).toLowerCase()
        case 'orderDate':
          return item.orderDate ? new Date(item.orderDate).getTime() : 0
        case 'status':
          return item.status || ''
        case 'totalAmount':
          return Number(item.totalAmount) || 0
        default:
          return (item as any)[property]
      }
    }
  }

  goBack(): void {
    this.location.back()
  }

  loadOrders(): void {
    this.loading.set(true)
    this.ordersService.getAll().subscribe({
      next: list => {
        // Limpiar valores NaN en todas las órdenes
        const cleanOrders = list.map(order => ({
          ...order,
          subtotal: Number(order.subtotal) || 0,
          taxRate: Number(order.taxRate) || 0,
          taxAmount: Number(order.taxAmount) || 0,
          discountAmount: Number(order.discountAmount) || 0,
          shippingCost: Number(order.shippingCost) || 0,
          totalAmount: Number(order.totalAmount) || 0,
        }))
        this.orders.set(cleanOrders)
        this.loading.set(false)
      },
      error: () => this.loading.set(false),
    })
  }

  loadSuppliers(): void {
    this.suppliersService.getAll().subscribe({
      next: list => this.suppliers.set(list),
      error: () => {},
    })
  }

  newOrder(): void {
    this.router.navigate(['/dashboard/pharmacy/purchase-orders/new'])
  }

  viewOrder(order: PurchaseOrder): void {
    this.router.navigate(['/dashboard/pharmacy/purchase-orders', order.id])
  }

  editOrder(order: PurchaseOrder): void {
    this.router.navigate(['/dashboard/pharmacy/purchase-orders/edit', order.id])
  }

  async deleteOrder(order: PurchaseOrder): Promise<void> {
    const result = await this.alert.confirm({
      title: '¿Eliminar orden?',
      text: `¿Seguro que desea eliminar la orden ${order.orderNumber}?`,
      confirmButtonText: 'Eliminar',
      cancelButtonText: 'Cancelar',
    })

    if (!result.isConfirmed) return

    this.loading.set(true)
    this.ordersService.remove(order.id).subscribe({
      next: () => {
        this.alert.success('Eliminado', 'Orden eliminada correctamente')
        this.orders.set(this.orders().filter(o => o.id !== order.id))
        this.loading.set(false)
      },
      error: () => {
        this.alert.error('Error', 'No se pudo eliminar la orden')
        this.loading.set(false)
      },
    })
  }

  getStatusLabel(status: PurchaseOrderStatus): string {
    const labels: Record<PurchaseOrderStatus, string> = {
      [PurchaseOrderStatus.DRAFT]: 'Borrador',
      [PurchaseOrderStatus.PENDING]: 'Pendiente',
      [PurchaseOrderStatus.APPROVED]: 'Aprobada',
      [PurchaseOrderStatus.SENT]: 'Enviada',
      [PurchaseOrderStatus.PARTIALLY_RECEIVED]: 'Parcialmente recibida',
      [PurchaseOrderStatus.RECEIVED]: 'Recibida',
      [PurchaseOrderStatus.DELIVERED]: 'Entregada',
      [PurchaseOrderStatus.CANCELLED]: 'Cancelada',
    }
    return labels[status] || status
  }

  getStatusColor(status: PurchaseOrderStatus): string {
    const colors: Record<PurchaseOrderStatus, string> = {
      [PurchaseOrderStatus.DRAFT]: 'bg-gray-100 text-gray-800 border-gray-200',
      [PurchaseOrderStatus.PENDING]: 'bg-orange-100 text-orange-800 border-orange-200',
      [PurchaseOrderStatus.APPROVED]: 'bg-green-100 text-green-800 border-green-200',
      [PurchaseOrderStatus.SENT]: 'bg-blue-100 text-blue-800 border-blue-200',
      [PurchaseOrderStatus.PARTIALLY_RECEIVED]: 'bg-purple-100 text-purple-800 border-purple-200',
      [PurchaseOrderStatus.RECEIVED]: 'bg-cyan-100 text-cyan-800 border-cyan-200',
      [PurchaseOrderStatus.DELIVERED]: 'bg-teal-100 text-teal-800 border-teal-200',
      [PurchaseOrderStatus.CANCELLED]: 'bg-red-100 text-red-800 border-red-200',
    }
    return colors[status] || 'bg-slate-100 text-slate-800 border-slate-200'
  }

  getStatusDotColor(status: PurchaseOrderStatus): string {
    const colors: Record<PurchaseOrderStatus, string> = {
      [PurchaseOrderStatus.DRAFT]: 'bg-gray-500',
      [PurchaseOrderStatus.PENDING]: 'bg-orange-500',
      [PurchaseOrderStatus.APPROVED]: 'bg-green-500',
      [PurchaseOrderStatus.SENT]: 'bg-blue-500',
      [PurchaseOrderStatus.PARTIALLY_RECEIVED]: 'bg-purple-500',
      [PurchaseOrderStatus.RECEIVED]: 'bg-cyan-500',
      [PurchaseOrderStatus.DELIVERED]: 'bg-teal-500',
      [PurchaseOrderStatus.CANCELLED]: 'bg-red-500',
    }
    return colors[status] || 'bg-slate-500'
  }

  trackById(_: number, item: PurchaseOrder) {
    return item.id
  }

  // Devuelve el nombre a mostrar del proveedor, usando relación si existe o catálogo cargado como fallback
  supplierDisplayName(order: PurchaseOrder): string {
    const rel = order.supplier as any
    const nameFromRel = (rel?.tradeName || rel?.nombreComercial || rel?.name || '').toString()
    if (nameFromRel) return nameFromRel

    const s = this.suppliers().find(x => x.id === order.supplierId)
    if (!s) return 'Sin proveedor'
    return (s as any).tradeName || s.nombreComercial || s.name || 'Sin proveedor'
  }
}
