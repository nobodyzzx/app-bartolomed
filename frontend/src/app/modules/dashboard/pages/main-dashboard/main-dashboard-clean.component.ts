import { Component, OnInit } from '@angular/core'
import { DashboardStats, RecentAppointment, RecentPatient, StockAlert } from './interfaces/dashboard-ui.interfaces'

@Component({
  selector: 'app-main-dashboard-clean',
  templateUrl: './main-dashboard-clean.component.html',
  styleUrls: ['./main-dashboard.component.css'],
})
export class MainDashboardComponent implements OnInit {
  stats: DashboardStats = {
    totalPatients: 0,
    totalAppointments: 0,
    totalDoctors: 0,
    monthlyRevenue: 0,
    pendingAppointments: 0,
    lowStockItems: 0,
  }

  recentAppointments: RecentAppointment[] = []
  stockAlerts: StockAlert[] = []
  recentPatients: RecentPatient[] = []

  displayedColumns: string[] = ['patient', 'doctor', 'time', 'type', 'status', 'actions']
  stockColumns: string[] = ['medication', 'current', 'minimum', 'category', 'actions']
  patientColumns: string[] = ['name', 'age', 'lastVisit', 'nextAppointment', 'status', 'actions']

  constructor() {}

  ngOnInit(): void {
    this.loadDashboardData()
  }

  loadDashboardData(): void {
    // Simulamos datos para el dashboard
    this.stats = {
      totalPatients: 1247,
      totalAppointments: 89,
      totalDoctors: 23,
      monthlyRevenue: 125670,
      pendingAppointments: 4,
      lowStockItems: 3,
    }

    const today = new Date().toISOString()
    this.recentAppointments = [
      { id: 1, patientName: 'María García',   doctorName: 'Dr. José Martínez',  time: '09:00', date: today, status: 'confirmed', type: 'Consulta General' },
      { id: 2, patientName: 'Carlos López',   doctorName: 'Dra. Ana Rodríguez', time: '10:30', date: today, status: 'pending',   type: 'Cardiología' },
      { id: 3, patientName: 'Laura Fernández', doctorName: 'Dr. Luis Gómez',    time: '11:15', date: today, status: 'confirmed', type: 'Dermatología' },
      { id: 4, patientName: 'Roberto Silva',  doctorName: 'Dra. Carmen Díaz',   time: '14:00', date: today, status: 'pending',   type: 'Neurología' },
    ]

    this.stockAlerts = [
      {
        id: 1,
        medication: 'Paracetamol 500mg',
        currentStock: 12,
        minimumStock: 50,
        category: 'Analgésicos',
      },
      {
        id: 2,
        medication: 'Amoxicilina 250mg',
        currentStock: 8,
        minimumStock: 30,
        category: 'Antibióticos',
      },
      {
        id: 3,
        medication: 'Ibuprofeno 400mg',
        currentStock: 15,
        minimumStock: 40,
        category: 'Antiinflamatorios',
      },
    ]

    this.recentPatients = [
      {
        id: 1,
        name: 'Ana Morales',
        age: 34,
        lastVisit: '2024-01-15',
        nextAppointment: '2024-01-25',
        status: 'active',
      },
      {
        id: 2,
        name: 'Pedro Ruiz',
        age: 67,
        lastVisit: '2024-01-14',
        nextAppointment: '2024-01-28',
        status: 'active',
      },
      {
        id: 3,
        name: 'Sofia Herrera',
        age: 28,
        lastVisit: '2024-01-13',
        status: 'active',
      },
      {
        id: 4,
        name: 'Miguel Torres',
        age: 45,
        lastVisit: '2024-01-10',
        nextAppointment: '2024-01-30',
        status: 'active',
      },
    ]
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'confirmed':
        return 'primary'
      case 'pending':
        return 'warn'
      case 'cancelled':
        return 'accent'
      case 'active':
        return 'primary'
      case 'inactive':
        return 'warn'
      default:
        return 'basic'
    }
  }

  getStatusText(status: string): string {
    switch (status) {
      case 'confirmed':
        return 'Confirmada'
      case 'pending':
        return 'Pendiente'
      case 'cancelled':
        return 'Cancelada'
      case 'active':
        return 'Activo'
      case 'inactive':
        return 'Inactivo'
      default:
        return status
    }
  }

  viewAppointmentDetails(_appointment: RecentAppointment): void {}

  editAppointment(_appointment: RecentAppointment): void {}

  restockMedication(_alert: StockAlert): void {}

  viewPatientDetails(_patient: RecentPatient): void {}

  scheduleAppointment(_patient: RecentPatient): void {}
}
