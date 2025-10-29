import { Component, OnInit, ViewChild } from '@angular/core';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { Order, Supplier } from '../interfaces/pharmacy.interfaces';
import { OrderGenerationService } from '../services/order-generation.service';

@Component({
  selector: 'app-order-generation',
  templateUrl: './order-generation.component.html',
  styleUrls: ['./order-generation.component.css']
})
export class OrderGenerationComponent implements OnInit {
  
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  displayedColumns: string[] = ['id', 'supplier', 'date', 'status', 'total', 'actions'];
  dataSource = new MatTableDataSource<Order>();
  
  orders: Order[] = [];
  suppliers: Supplier[] = [];
  
  stats = {
    totalOrders: 0,
    pendingOrders: 0,
    approvedOrders: 0,
    totalValue: 0
  };

  constructor(private orderService: OrderGenerationService) { }

  ngOnInit(): void {
    this.loadOrders();
    this.loadSuppliers();
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  loadOrders(): void {
    this.orderService.getOrders().subscribe(orders => {
      this.orders = orders;
      this.dataSource.data = orders;
      this.calculateStats();
    });
  }

  loadSuppliers(): void {
    this.orderService.getSuppliers().subscribe(suppliers => {
      this.suppliers = suppliers;
    });
  }

  calculateStats(): void {
    this.stats.totalOrders = this.orders.length;
    this.stats.pendingOrders = this.orders.filter(o => o.status === 'pending').length;
    this.stats.approvedOrders = this.orders.filter(o => o.status === 'approved').length;
    this.stats.totalValue = this.orders.reduce((sum, order) => sum + (order.total || 0), 0);
  }

  applyFilter(event: Event): void {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSource.filter = filterValue.trim().toLowerCase();

    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  getStatusChipClass(status: string): string {
    switch (status) {
      case 'pending': return 'status-pending';
      case 'approved': return 'status-approved';
      case 'delivered': return 'status-delivered';
      case 'cancelled': return 'status-cancelled';
      default: return '';
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'pending': return 'Pendiente';
      case 'approved': return 'Aprobado';
      case 'delivered': return 'Entregado';
      case 'cancelled': return 'Cancelado';
      default: return status;
    }
  }

  viewOrder(order: Order): void {
    // TODO: Implementar vista de detalle de pedido
    console.log('Ver pedido:', order);
  }

  editOrder(order: Order): void {
    // TODO: Implementar edición de pedido
    console.log('Editar pedido:', order);
  }

  approveOrder(order: Order): void {
    this.orderService.updateOrderStatus(order.id!, 'approved').subscribe(updatedOrder => {
      if (updatedOrder) {
        this.loadOrders();
      }
    });
  }

  cancelOrder(order: Order): void {
    this.orderService.updateOrderStatus(order.id!, 'cancelled').subscribe(updatedOrder => {
      if (updatedOrder) {
        this.loadOrders();
      }
    });
  }

  createNewOrder(): void {
    // TODO: Implementar creación de nuevo pedido
    console.log('Crear nuevo pedido');
  }
}
