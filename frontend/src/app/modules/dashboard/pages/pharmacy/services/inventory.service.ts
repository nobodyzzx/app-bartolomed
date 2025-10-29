import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { Product } from '../interfaces/pharmacy.interfaces';

@Injectable({
  providedIn: 'root'
})
export class InventoryService {

  private products: Product[] = [
    { 
      id: 1, 
      name: 'Paracetamol 500mg', 
      brand: 'Genérico', 
      stock: 150, 
      price: 2.50, 
      expirationDate: '2025-10-30',
      category: 'Analgésico',
      description: 'Medicamento para alivio del dolor y fiebre',
      minStock: 50,
      location: 'Estante A-1'
    },
    { 
      id: 2, 
      name: 'Amoxicilina 250mg', 
      brand: 'Aurobindo', 
      stock: 80, 
      price: 5.75, 
      expirationDate: '2026-03-15',
      category: 'Antibiótico',
      description: 'Antibiótico de amplio espectro',
      minStock: 30,
      location: 'Estante B-2'
    },
    { 
      id: 3, 
      name: 'Ibuprofeno 400mg', 
      brand: 'Bayer', 
      stock: 220, 
      price: 3.10, 
      expirationDate: '2025-05-20',
      category: 'Antiinflamatorio',
      description: 'Antiinflamatorio no esteroideo',
      minStock: 40,
      location: 'Estante A-3'
    },
    { 
      id: 4, 
      name: 'Vitamina C 1g', 
      brand: 'Roche', 
      stock: 50, 
      price: 7.00, 
      expirationDate: '2024-12-01',
      category: 'Suplemento',
      description: 'Suplemento vitamínico',
      minStock: 25,
      location: 'Estante C-1'
    },
    { 
      id: 5, 
      name: 'Omeprazol 20mg', 
      brand: 'Losec', 
      stock: 95, 
      price: 4.20, 
      expirationDate: '2025-08-15',
      category: 'Gastroentérico',
      description: 'Inhibidor de la bomba de protones',
      minStock: 30,
      location: 'Estante B-1'
    }
  ];

  getProducts(): Observable<Product[]> {
    return of(this.products);
  }

  getProduct(id: number): Observable<Product | undefined> {
    const product = this.products.find(p => p.id === id);
    return of(product);
  }

  addProduct(product: Product): Observable<Product> {
    const newProduct = { ...product, id: this.generateId() };
    this.products.push(newProduct);
    return of(newProduct);
  }

  updateProduct(id: number, product: Partial<Product>): Observable<Product | null> {
    const index = this.products.findIndex(p => p.id === id);
    if (index > -1) {
      this.products[index] = { ...this.products[index], ...product };
      return of(this.products[index]);
    }
    return of(null);
  }

  deleteProduct(id: number): Observable<boolean> {
    const index = this.products.findIndex(p => p.id === id);
    if (index > -1) {
      this.products.splice(index, 1);
      return of(true);
    }
    return of(false);
  }

  getLowStockProducts(): Observable<Product[]> {
    const lowStock = this.products.filter(p => p.stock <= (p.minStock || 0));
    return of(lowStock);
  }

  getExpiringProducts(): Observable<Product[]> {
    const today = new Date();
    const thirtyDaysFromNow = new Date(today.getTime() + (30 * 24 * 60 * 60 * 1000));
    
    const expiring = this.products.filter(p => {
      const expirationDate = new Date(p.expirationDate);
      return expirationDate <= thirtyDaysFromNow;
    });
    
    return of(expiring);
  }

  private generateId(): number {
    return Math.max(...this.products.map(p => p.id), 0) + 1;
  }
}
