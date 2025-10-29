import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { Sale } from '../interfaces/pharmacy.interfaces';

@Injectable({
  providedIn: 'root'
})
export class SalesDispensingService {

  private sales: Sale[] = [
    { 
      id: 'VNT-001', 
      patientName: 'Juan Pérez', 
      date: '2025-09-02', 
      total: 15.65, 
      items: [
        { name: 'Paracetamol 500mg', quantity: 2, price: 2.50, subtotal: 5.00 }, 
        { name: 'Vitamina C 1g', quantity: 1, price: 7.00, subtotal: 7.00 },
        { name: 'Ibuprofeno 400mg', quantity: 1, price: 3.10, subtotal: 3.10 }
      ],
      status: 'completed',
      paymentMethod: 'Efectivo'
    },
    { 
      id: 'VNT-002', 
      patientName: 'María García', 
      date: '2025-09-03', 
      total: 5.75, 
      items: [
        { name: 'Amoxicilina 250mg', quantity: 1, price: 5.75, subtotal: 5.75 }
      ],
      status: 'completed',
      paymentMethod: 'Tarjeta'
    },
    { 
      id: 'VNT-003', 
      patientName: 'Carlos Rodriguez', 
      date: '2025-09-03', 
      total: 12.40, 
      items: [
        { name: 'Omeprazol 20mg', quantity: 2, price: 4.20, subtotal: 8.40 },
        { name: 'Paracetamol 500mg', quantity: 1, price: 2.50, subtotal: 2.50 }
      ],
      status: 'pending',
      paymentMethod: 'Transferencia'
    },
    { 
      id: 'VNT-004', 
      patientName: 'Ana López', 
      date: '2025-09-01', 
      total: 18.90, 
      items: [
        { name: 'Vitamina C 1g', quantity: 2, price: 7.00, subtotal: 14.00 },
        { name: 'Ibuprofeno 400mg', quantity: 1, price: 3.10, subtotal: 3.10 }
      ],
      status: 'completed',
      paymentMethod: 'Efectivo'
    }
  ];

  getSales(): Observable<Sale[]> {
    return of(this.sales);
  }

  getSale(id: string): Observable<Sale | undefined> {
    const sale = this.sales.find(s => s.id === id);
    return of(sale);
  }

  createSale(sale: Omit<Sale, 'id'>): Observable<Sale> {
    const newSale: Sale = {
      ...sale,
      id: this.generateSaleId(),
      status: 'pending'
    };
    
    // Calcular total
    newSale.total = newSale.items.reduce((sum, item) => sum + (item.subtotal || 0), 0);
    
    this.sales.push(newSale);
    return of(newSale);
  }

  updateSaleStatus(id: string, status: Sale['status']): Observable<Sale | null> {
    const sale = this.sales.find(s => s.id === id);
    if (sale) {
      sale.status = status;
      return of(sale);
    }
    return of(null);
  }

  getSalesByDate(startDate: string, endDate: string): Observable<Sale[]> {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    const salesInRange = this.sales.filter(sale => {
      const saleDate = new Date(sale.date);
      return saleDate >= start && saleDate <= end;
    });
    
    return of(salesInRange);
  }

  getSalesByPatient(patientName: string): Observable<Sale[]> {
    const patientSales = this.sales.filter(sale => 
      sale.patientName.toLowerCase().includes(patientName.toLowerCase())
    );
    return of(patientSales);
  }

  getDailySalesTotal(date: string): Observable<number> {
    const dailySales = this.sales.filter(sale => sale.date === date && sale.status === 'completed');
    const total = dailySales.reduce((sum, sale) => sum + sale.total, 0);
    return of(total);
  }

  getMonthlySalesTotal(year: number, month: number): Observable<number> {
    const monthlySales = this.sales.filter(sale => {
      const saleDate = new Date(sale.date);
      return saleDate.getFullYear() === year && 
             saleDate.getMonth() === month - 1 && 
             sale.status === 'completed';
    });
    const total = monthlySales.reduce((sum, sale) => sum + sale.total, 0);
    return of(total);
  }

  private generateSaleId(): string {
    const saleNumber = this.sales.length + 1;
    return `VNT-${saleNumber.toString().padStart(3, '0')}`;
  }
}
