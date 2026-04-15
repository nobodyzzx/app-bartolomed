import { Injectable } from '@angular/core'
import { Observable, of } from 'rxjs'
import { PurchaseOrder, PurchaseOrderStatus, Supplier, SupplierStatus, SupplierType } from '../interfaces/pharmacy.interfaces'

@Injectable({
  providedIn: 'root',
})
export class OrderGenerationService {
  private suppliers: Supplier[] = [
    {
      id: 'supplier-001',
      nombreComercial: 'Proveedor Farmacéutico del Centro',
      razonSocial: 'Proveedor Farmacéutico del Centro S.R.L.',
      idTributario: '1234567',
      tipoProveedor: SupplierType.MEDICAMENTOS,
      contactPerson: 'Juan Sánchez',
      email: 'contacto@pfc.com',
      phone: '+591-4-4234567',
      address: 'Av. América #123',
      city: 'Cochabamba',
      country: 'Bolivia',
      status: SupplierStatus.ACTIVE,
    },
    {
      id: 'supplier-002',
      nombreComercial: 'Distribuidora Médica del Norte',
      razonSocial: 'Distribuidora Médica del Norte S.A.',
      idTributario: '2345678',
      tipoProveedor: SupplierType.MEDICAMENTOS,
      contactPerson: 'María López',
      email: 'pedidos@dmn.com',
      phone: '+591-2-2456789',
      address: 'Calle Comercio #456',
      city: 'La Paz',
      country: 'Bolivia',
      status: SupplierStatus.ACTIVE,
    },
    {
      id: 'supplier-003',
      nombreComercial: 'Laboratorios Unidos S.A.',
      razonSocial: 'Laboratorios Unidos S.A.',
      idTributario: '3456789',
      tipoProveedor: SupplierType.MEDICAMENTOS,
      contactPerson: 'Carlos Rodriguez',
      email: 'info@laboratoriosunidos.com',
      phone: '+591-3-3345678',
      address: 'Zona Industrial',
      city: 'Santa Cruz',
      country: 'Bolivia',
      status: SupplierStatus.ACTIVE,
    },
  ]

  private orders: PurchaseOrder[] = [
    {
      id: 'ORD-001',
      orderNumber: 'ORD-001',
      supplierId: 'supplier-001',
      orderDate: '2025-09-03',
      expectedDeliveryDate: '2025-09-17',
      status: PurchaseOrderStatus.PENDING,
      subtotal: 350.0,
      taxAmount: 0,
      totalAmount: 350.0,
      items: [
        {
          productName: 'Paracetamol 500mg',
          productCode: 'PARA-500',
          quantity: 50,
          unitPrice: 2.0,
          subtotal: 100.0,
        },
        {
          productName: 'Ibuprofeno 400mg',
          productCode: 'IBU-400',
          quantity: 100,
          unitPrice: 2.5,
          subtotal: 250.0,
        },
      ],
    },
    {
      id: 'ORD-002',
      orderNumber: 'ORD-002',
      supplierId: 'supplier-002',
      orderDate: '2025-09-02',
      expectedDeliveryDate: '2025-09-16',
      status: PurchaseOrderStatus.APPROVED,
      subtotal: 337.5,
      taxAmount: 0,
      totalAmount: 337.5,
      items: [
        {
          productName: 'Amoxicilina 250mg',
          productCode: 'AMOX-250',
          quantity: 75,
          unitPrice: 4.5,
          subtotal: 337.5,
        },
      ],
    },
    {
      id: 'ORD-003',
      orderNumber: 'ORD-003',
      supplierId: 'supplier-003',
      orderDate: '2025-09-01',
      expectedDeliveryDate: '2025-09-15',
      actualDeliveryDate: '2025-09-14',
      status: PurchaseOrderStatus.RECEIVED,
      subtotal: 360.0,
      taxAmount: 0,
      totalAmount: 360.0,
      items: [
        {
          productName: 'Vitamina C 1g',
          productCode: 'VITC-1000',
          quantity: 30,
          unitPrice: 5.0,
          subtotal: 150.0,
        },
        {
          productName: 'Omeprazol 20mg',
          productCode: 'OMEP-20',
          quantity: 60,
          unitPrice: 3.5,
          subtotal: 210.0,
        },
      ],
    },
  ]

  getSuppliers(): Observable<Supplier[]> {
    return of(this.suppliers)
  }

  getSupplier(id: string): Observable<Supplier | undefined> {
    const supplier = this.suppliers.find(s => s.id === id)
    return of(supplier)
  }

  getOrders(): Observable<PurchaseOrder[]> {
    return of(this.orders)
  }

  getOrder(id: string): Observable<PurchaseOrder | undefined> {
    const order = this.orders.find(o => o.id === id)
    return of(order)
  }

  createOrder(order: Omit<PurchaseOrder, 'id' | 'orderNumber'>): Observable<PurchaseOrder> {
    const newOrder: PurchaseOrder = {
      ...order,
      id: this.generateOrderId(),
      orderNumber: this.generateOrderNumber(),
      status: PurchaseOrderStatus.PENDING,
    }

    // Calcular totalAmount si no está presente
    if (!newOrder.totalAmount) {
      const subtotal = newOrder.items.reduce((sum: number, item) => sum + (item.subtotal || 0), 0)
      newOrder.totalAmount =
        subtotal +
        (newOrder.taxAmount || 0) +
        (newOrder.shippingCost || 0) -
        (newOrder.discountAmount || 0)
    }

    // Cargar información del supplier
    const supplier = this.suppliers.find(s => s.id === newOrder.supplierId)
    if (supplier) {
      newOrder.supplier = supplier
    }

    this.orders.push(newOrder)
    return of(newOrder)
  }

  updateOrderStatus(id: string, status: PurchaseOrderStatus): Observable<PurchaseOrder | null> {
    const order = this.orders.find(o => o.id === id)
    if (order) {
      order.status = status
      return of(order)
    }
    return of(null)
  }

  addSupplier(supplier: Omit<Supplier, 'id'>): Observable<Supplier> {
    const newSupplier: Supplier = {
      ...supplier,
      id: this.generateSupplierId(),
    }
    this.suppliers.push(newSupplier)
    return of(newSupplier)
  }

  updateSupplier(id: string, supplier: Partial<Supplier>): Observable<Supplier | null> {
    const index = this.suppliers.findIndex(s => s.id === id)
    if (index > -1) {
      this.suppliers[index] = { ...this.suppliers[index], ...supplier }
      return of(this.suppliers[index])
    }
    return of(null)
  }

  private generateOrderId(): string {
    const orderNumber = this.orders.length + 1
    return `ORD-${orderNumber.toString().padStart(3, '0')}`
  }

  private generateOrderNumber(): string {
    const orderNumber = this.orders.length + 1
    return `ORD-${orderNumber.toString().padStart(3, '0')}`
  }

  private generateSupplierId(): string {
    const maxNum = this.suppliers
      .map(s => parseInt(s.id.split('-')[1] || '0'))
      .reduce((max, num) => Math.max(max, num), 0)
    return `supplier-${String(maxNum + 1).padStart(3, '0')}`
  }
}
