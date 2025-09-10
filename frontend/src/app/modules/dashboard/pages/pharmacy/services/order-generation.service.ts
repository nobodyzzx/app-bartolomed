import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { Order, Supplier } from '../interfaces/pharmacy.interfaces';

@Injectable({
  providedIn: 'root'
})
export class OrderGenerationService {

  private suppliers: Supplier[] = [
    { 
      id: 1, 
      name: 'Proveedor Farmacéutico del Centro', 
      contact: 'contacto@pfc.com',
      phone: '+591-4-4234567',
      email: 'pedidos@pfc.com',
      address: 'Av. América #123, Cochabamba'
    },
    { 
      id: 2, 
      name: 'Distribuidora Médica del Norte', 
      contact: 'pedidos@dmn.com',
      phone: '+591-2-2456789',
      email: 'ventas@dmn.com',
      address: 'Calle Comercio #456, La Paz'
    },
    { 
      id: 3, 
      name: 'Laboratorios Unidos S.A.', 
      contact: 'info@laboratoriosunidos.com',
      phone: '+591-3-3345678',
      email: 'ordenes@laboratoriosunidos.com',
      address: 'Zona Industrial, Santa Cruz'
    }
  ];

  private orders: Order[] = [
    { 
      id: 'ORD-001',
      supplierId: 1, 
      date: '2025-09-03', 
      items: [
        { productId: 1, productName: 'Paracetamol 500mg', quantity: 50, price: 2.00, subtotal: 100.00 }, 
        { productId: 3, productName: 'Ibuprofeno 400mg', quantity: 100, price: 2.50, subtotal: 250.00 }
      ],
      status: 'pending',
      total: 350.00,
      supplierName: 'Proveedor Farmacéutico del Centro'
    },
    { 
      id: 'ORD-002',
      supplierId: 2, 
      date: '2025-09-02', 
      items: [
        { productId: 2, productName: 'Amoxicilina 250mg', quantity: 75, price: 4.50, subtotal: 337.50 }
      ],
      status: 'approved',
      total: 337.50,
      supplierName: 'Distribuidora Médica del Norte'
    },
    { 
      id: 'ORD-003',
      supplierId: 3, 
      date: '2025-09-01', 
      items: [
        { productId: 4, productName: 'Vitamina C 1g', quantity: 30, price: 5.00, subtotal: 150.00 },
        { productId: 5, productName: 'Omeprazol 20mg', quantity: 60, price: 3.50, subtotal: 210.00 }
      ],
      status: 'delivered',
      total: 360.00,
      supplierName: 'Laboratorios Unidos S.A.'
    }
  ];

  getSuppliers(): Observable<Supplier[]> {
    return of(this.suppliers);
  }

  getSupplier(id: number): Observable<Supplier | undefined> {
    const supplier = this.suppliers.find(s => s.id === id);
    return of(supplier);
  }

  getOrders(): Observable<Order[]> {
    return of(this.orders);
  }

  getOrder(id: string): Observable<Order | undefined> {
    const order = this.orders.find(o => o.id === id);
    return of(order);
  }

  createOrder(order: Omit<Order, 'id'>): Observable<Order> {
    const newOrder: Order = {
      ...order,
      id: this.generateOrderId(),
      status: 'pending'
    };
    
    // Calcular total
    newOrder.total = newOrder.items.reduce((sum, item) => sum + (item.subtotal || 0), 0);
    
    // Agregar nombre del proveedor
    const supplier = this.suppliers.find(s => s.id === newOrder.supplierId);
    if (supplier) {
      newOrder.supplierName = supplier.name;
    }
    
    this.orders.push(newOrder);
    return of(newOrder);
  }

  updateOrderStatus(id: string, status: Order['status']): Observable<Order | null> {
    const order = this.orders.find(o => o.id === id);
    if (order) {
      order.status = status;
      return of(order);
    }
    return of(null);
  }

  addSupplier(supplier: Omit<Supplier, 'id'>): Observable<Supplier> {
    const newSupplier: Supplier = {
      ...supplier,
      id: this.generateSupplierId()
    };
    this.suppliers.push(newSupplier);
    return of(newSupplier);
  }

  updateSupplier(id: number, supplier: Partial<Supplier>): Observable<Supplier | null> {
    const index = this.suppliers.findIndex(s => s.id === id);
    if (index > -1) {
      this.suppliers[index] = { ...this.suppliers[index], ...supplier };
      return of(this.suppliers[index]);
    }
    return of(null);
  }

  private generateOrderId(): string {
    const orderNumber = this.orders.length + 1;
    return `ORD-${orderNumber.toString().padStart(3, '0')}`;
  }

  private generateSupplierId(): number {
    return Math.max(...this.suppliers.map(s => s.id), 0) + 1;
  }
}
