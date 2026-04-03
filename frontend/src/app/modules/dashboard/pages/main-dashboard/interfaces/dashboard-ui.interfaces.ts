export interface DashboardStats {
  totalPatients: number
  totalAppointments: number
  totalDoctors: number
  monthlyRevenue: number
  pendingAppointments: number
  lowStockItems: number
}

export interface RecentAppointment {
  id: number
  patientName: string
  doctorName: string
  time: string
  date: string
  status: 'confirmed' | 'pending' | 'cancelled' | 'completed'
  type: string
}

export interface StockAlert {
  id: number
  medication: string
  currentStock: number
  minimumStock: number
  category: string
  expiryDate?: string
}

export interface RecentPatient {
  id: number
  name: string
  age: number
  lastVisit: string
  nextAppointment?: string
  status: 'active' | 'inactive'
  phone?: string
}
