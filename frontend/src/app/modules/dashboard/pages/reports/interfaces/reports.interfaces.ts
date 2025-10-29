export interface BaseReport {
  id: string;
  title: string;
  date: string;
  type: string;
  description?: string;
  createdBy?: string;
  status?: 'draft' | 'generated' | 'published' | 'archived';
  createdAt?: Date;
  updatedAt?: Date;
}

export interface MedicalReport extends BaseReport {
  type: 'Consultas' | 'Diagnósticos' | 'Tratamientos' | 'Epidemiológico';
  patientCount?: number;
  diagnosisData?: DiagnosisData[];
  consultationData?: ConsultationData[];
  period?: {
    startDate: string;
    endDate: string;
  };
}

export interface FinancialReport extends BaseReport {
  type: 'Financiero' | 'Ventas' | 'Gastos' | 'Ingresos' | 'Balance';
  totalAmount?: number;
  currency?: string;
  revenue?: number;
  expenses?: number;
  profit?: number;
  period?: {
    startDate: string;
    endDate: string;
  };
  categories?: FinancialCategory[];
}

export interface StockReport extends BaseReport {
  type: 'Inventario' | 'Vencimientos' | 'Movimientos' | 'Bajo Stock';
  totalProducts?: number;
  lowStockItems?: number;
  expiringItems?: number;
  outOfStockItems?: number;
  stockValue?: number;
  movements?: StockMovement[];
}

// Interfaces auxiliares
export interface DiagnosisData {
  diagnosis: string;
  count: number;
  percentage: number;
}

export interface ConsultationData {
  specialty: string;
  count: number;
  averageDuration: number;
}

export interface FinancialCategory {
  category: string;
  amount: number;
  percentage: number;
}

export interface StockMovement {
  productName: string;
  movementType: 'entrada' | 'salida' | 'ajuste';
  quantity: number;
  date: string;
  reason?: string;
}

// Filtros para reportes
export interface ReportFilters {
  startDate?: string;
  endDate?: string;
  type?: string;
  status?: string;
  createdBy?: string;
}

// Parámetros para generar reportes
export interface GenerateReportParams {
  type: string;
  title: string;
  description?: string;
  filters: ReportFilters;
  format?: 'pdf' | 'excel' | 'csv';
}
