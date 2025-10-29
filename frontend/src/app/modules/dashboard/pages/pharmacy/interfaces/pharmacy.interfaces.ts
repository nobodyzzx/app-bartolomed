export interface Product {
  id: number;
  name: string;
  brand: string;
  stock: number;
  price: number;
  expirationDate: string;
  category?: string;
  description?: string;
  minStock?: number;
  location?: string;
}

export interface Supplier {
  id: number;
  name: string;
  contact: string;
  phone?: string;
  email?: string;
  address?: string;
}

export interface Order {
  id?: string;
  supplierId: number;
  date: string;
  items: OrderItem[];
  status?: 'pending' | 'approved' | 'delivered' | 'cancelled';
  total?: number;
  supplierName?: string;
}

export interface OrderItem {
  productId: number;
  productName?: string;
  quantity: number;
  price?: number;
  subtotal?: number;
}

export interface Sale {
  id: string;
  patientName: string;
  date: string;
  total: number;
  items: SaleItem[];
  status?: 'completed' | 'pending' | 'cancelled';
  paymentMethod?: string;
}

export interface SaleItem {
  name: string;
  quantity: number;
  price?: number;
  subtotal?: number;
}

export interface Invoice {
  id: string;
  saleId: string;
  date: string;
  total: number;
  status: 'paid' | 'pending' | 'overdue' | 'cancelled';
  patientName?: string;
  dueDate?: string;
  paymentDate?: string;
}
