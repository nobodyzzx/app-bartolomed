import { Component, OnInit } from '@angular/core'
import { MatTableDataSource } from '@angular/material/table'
import { ActivatedRoute } from '@angular/router'

interface DashboardStats {
  totalPatients: number
  totalAppointments: number
  totalDoctors: number
  monthlyRevenue: number
}

interface RecentAppointment {
  id: number
  patientName: string
  doctorName: string
  time: string
  status: 'confirmed' | 'pending' | 'cancelled'
  type: string
}

interface StockAlert {
  id: number
  medication: string
  currentStock: number
  minimumStock: number
  category: string
}

interface RecentPatient {
  id: number
  name: string
  age: number
  lastVisit: string
  nextAppointment?: string
  status: 'active' | 'inactive'
}

@Component({
  selector: 'app-main-dashboard',
  templateUrl: './main-dashboard.component.html',
  styleUrls: ['./main-dashboard.component.css'],
})
export class MainDashboardComponent implements OnInit {
  stats: DashboardStats = {
    totalPatients: 0,
    totalAppointments: 0,
    totalDoctors: 0,
    monthlyRevenue: 0,
  }

  recentAppointments = new MatTableDataSource<RecentAppointment>([])
  stockAlerts: StockAlert[] = []
  recentPatients = new MatTableDataSource<RecentPatient>([])

  displayedColumns: string[] = ['patient', 'doctor', 'time', 'type', 'status', 'actions']
  stockColumns: string[] = ['medication', 'current', 'minimum', 'category', 'actions']
  patientColumns: string[] = ['name', 'age', 'lastVisit', 'nextAppointment', 'status', 'actions']

  permissionError: string | null = null

  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    // Verificar si hay error de permisos en los query params
    this.route.queryParams.subscribe(params => {
      if (params['error'] === 'insufficient_permissions') {
        const required = params['required']?.split(',') || []
        this.permissionError = `No tienes permisos para acceder a ese módulo. Permisos requeridos: ${required.join(', ')}`

        // Limpiar la URL después de 5 segundos
        setTimeout(() => {
          this.permissionError = null
        }, 8000)
      }
    })

    this.loadDashboardData()
  }

  loadDashboardData(): void {
    // Simulamos datos para el dashboard
    this.stats = {
      totalPatients: 1247,
      totalAppointments: 89,
      totalDoctors: 23,
      monthlyRevenue: 125670,
    }

    this.recentAppointments.data = [
      {
        id: 1,
        patientName: 'María García',
        doctorName: 'Dr. Rodríguez',
        time: '09:00',
        status: 'confirmed',
        type: 'Consulta General',
      },
      {
        id: 2,
        patientName: 'Juan Pérez',
        doctorName: 'Dr. López',
        time: '10:30',
        status: 'pending',
        type: 'Cardiología',
      },
      {
        id: 3,
        patientName: 'Ana Martín',
        doctorName: 'Dr. González',
        time: '11:15',
        status: 'confirmed',
        type: 'Dermatología',
      },
      {
        id: 4,
        patientName: 'Carlos Ruiz',
        doctorName: 'Dr. Hernández',
        time: '12:00',
        status: 'cancelled',
        type: 'Neurología',
      },
      {
        id: 5,
        patientName: 'Laura Sánchez',
        doctorName: 'Dr. Torres',
        time: '14:30',
        status: 'confirmed',
        type: 'Pediatría',
      },
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

    this.recentPatients.data = [
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

  viewAppointmentDetails(appointment: RecentAppointment): void {
    console.log('Ver detalles de cita:', appointment)
    // Aquí iría la navegación a los detalles de la cita
  }

  editAppointment(appointment: RecentAppointment): void {
    console.log('Editar cita:', appointment)
    // Aquí iría la navegación a editar la cita
  }

  restockMedication(alert: StockAlert): void {
    console.log('Reabastecer medicamento:', alert)
    // Aquí iría la lógica para reabastecer
  }

  viewPatientDetails(patient: RecentPatient): void {
    console.log('Ver detalles del paciente:', patient)
    // Aquí iría la navegación a los detalles del paciente
  }

  scheduleAppointment(patient: RecentPatient): void {
    console.log('Programar cita para:', patient)
    // Aquí iría la navegación a programar cita
  }
}
