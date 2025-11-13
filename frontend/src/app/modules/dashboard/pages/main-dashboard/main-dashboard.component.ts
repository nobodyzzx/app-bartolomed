import { Component, OnInit } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { AlertService } from '@core/services/alert.service'

interface DashboardStats {
  totalPatients: number
  totalAppointments: number
  totalDoctors: number
  monthlyRevenue: number
  pendingAppointments: number
  lowStockItems: number
}

interface RecentAppointment {
  id: number
  patientName: string
  doctorName: string
  time: string
  date: string
  status: 'confirmed' | 'pending' | 'cancelled' | 'completed'
  type: string
}

interface StockAlert {
  id: number
  medication: string
  currentStock: number
  minimumStock: number
  category: string
  expiryDate?: string
}

interface RecentPatient {
  id: number
  name: string
  age: number
  lastVisit: string
  nextAppointment?: string
  status: 'active' | 'inactive'
  phone?: string
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
    pendingAppointments: 0,
    lowStockItems: 0,
  }

  recentAppointments: RecentAppointment[] = []
  stockAlerts: StockAlert[] = []
  recentPatients: RecentPatient[] = []
  loading = false
  loadingStats = false
  loadingAppointments = false
  loadingStock = false
  loadingPatients = false

  permissionError: string | null = null

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private alert: AlertService,
  ) {}

  ngOnInit(): void {
    // Verificar si hay error de permisos en los query params
    this.route.queryParams.subscribe(params => {
      if (params['error'] === 'insufficient_permissions') {
        const required = params['required']?.split(',') || []
        this.permissionError = `No tienes permisos para acceder a ese módulo. Permisos requeridos: ${required.join(', ')}`

        // Limpiar la URL después de 8 segundos
        setTimeout(() => {
          this.permissionError = null
        }, 8000)
      }
    })

    this.loadDashboardData()
  }

  loadDashboardData(): void {
    this.loading = true
    this.loadStats()
    this.loadRecentAppointments()
    this.loadStockAlerts()
    this.loadRecentPatients()
  }

  loadStats(): void {
    this.loadingStats = true
    // TODO: Reemplazar con servicio real cuando esté disponible
    // Simulamos una llamada asíncrona
    setTimeout(() => {
      this.stats = {
        totalPatients: 1247,
        totalAppointments: 89,
        totalDoctors: 23,
        monthlyRevenue: 125670,
        pendingAppointments: 12,
        lowStockItems: 3,
      }
      this.loadingStats = false
      this.checkLoadingComplete()
    }, 800)
  }

  loadRecentAppointments(): void {
    this.loadingAppointments = true
    // TODO: Reemplazar con servicio real cuando esté disponible
    setTimeout(() => {
      this.recentAppointments = [
        {
          id: 1,
          patientName: 'María García López',
          doctorName: 'Dr. Rodríguez Pérez',
          time: '09:00',
          date: new Date().toISOString(),
          status: 'confirmed',
          type: 'Consulta General',
        },
        {
          id: 2,
          patientName: 'Juan Pérez Mamani',
          doctorName: 'Dr. López Quispe',
          time: '10:30',
          date: new Date().toISOString(),
          status: 'pending',
          type: 'Cardiología',
        },
        {
          id: 3,
          patientName: 'Ana Martínez Condori',
          doctorName: 'Dr. González Vargas',
          time: '11:15',
          date: new Date().toISOString(),
          status: 'confirmed',
          type: 'Dermatología',
        },
        {
          id: 4,
          patientName: 'Carlos Ruiz Flores',
          doctorName: 'Dr. Hernández Castro',
          time: '12:00',
          date: new Date().toISOString(),
          status: 'cancelled',
          type: 'Neurología',
        },
        {
          id: 5,
          patientName: 'Laura Sánchez Morales',
          doctorName: 'Dr. Torres Gutiérrez',
          time: '14:30',
          date: new Date().toISOString(),
          status: 'completed',
          type: 'Pediatría',
        },
      ]
      this.loadingAppointments = false
      this.checkLoadingComplete()
    }, 600)
  }

  loadStockAlerts(): void {
    this.loadingStock = true
    // TODO: Reemplazar con servicio real cuando esté disponible
    setTimeout(() => {
      this.stockAlerts = [
        {
          id: 1,
          medication: 'Paracetamol 500mg',
          currentStock: 12,
          minimumStock: 50,
          category: 'Analgésicos',
          expiryDate: '2025-03-15',
        },
        {
          id: 2,
          medication: 'Amoxicilina 250mg',
          currentStock: 8,
          minimumStock: 30,
          category: 'Antibióticos',
          expiryDate: '2025-06-20',
        },
        {
          id: 3,
          medication: 'Ibuprofeno 400mg',
          currentStock: 15,
          minimumStock: 40,
          category: 'Antiinflamatorios',
          expiryDate: '2025-05-10',
        },
      ]
      this.loadingStock = false
      this.checkLoadingComplete()
    }, 700)
  }

  loadRecentPatients(): void {
    this.loadingPatients = true
    // TODO: Reemplazar con servicio real cuando esté disponible
    setTimeout(() => {
      this.recentPatients = [
        {
          id: 1,
          name: 'Ana Morales Quispe',
          age: 34,
          lastVisit: '2025-01-15',
          nextAppointment: '2025-01-25',
          status: 'active',
          phone: '71234567',
        },
        {
          id: 2,
          name: 'Pedro Ruiz Mamani',
          age: 67,
          lastVisit: '2025-01-14',
          nextAppointment: '2025-01-28',
          status: 'active',
          phone: '72345678',
        },
        {
          id: 3,
          name: 'Sofia Herrera Condori',
          age: 28,
          lastVisit: '2025-01-13',
          status: 'active',
          phone: '73456789',
        },
        {
          id: 4,
          name: 'Miguel Torres López',
          age: 45,
          lastVisit: '2025-01-10',
          nextAppointment: '2025-01-30',
          status: 'active',
          phone: '74567890',
        },
      ]
      this.loadingPatients = false
      this.checkLoadingComplete()
    }, 500)
  }

  checkLoadingComplete(): void {
    if (
      !this.loadingStats &&
      !this.loadingAppointments &&
      !this.loadingStock &&
      !this.loadingPatients
    ) {
      this.loading = false
    }
  }

  async refreshDashboard(): Promise<void> {
    this.loading = true
    await this.alert.fire({
      icon: 'info',
      title: 'Actualizando datos',
      text: 'Cargando información del dashboard...',
      timer: 1000,
      showConfirmButton: false,
    })
    this.loadDashboardData()
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-BO', {
      style: 'currency',
      currency: 'BOB',
      minimumFractionDigits: 0,
    }).format(value)
  }

  goToPatientsList(): void {
    this.router.navigate(['/dashboard/patients/list'])
  }

  goToAppointmentsList(): void {
    this.router.navigate(['/dashboard/appointments'])
  }

  goToUsersList(): void {
    this.router.navigate(['/dashboard/users/list'])
  }

  goToReports(): void {
    this.router.navigate(['/dashboard/reports'])
  }

  goToPharmacy(): void {
    this.router.navigate(['/dashboard/pharmacy/inventory'])
  }

  getStatusClass(status: string): string {
    const classes: { [key: string]: string } = {
      confirmed: 'bg-green-100 text-green-700 border-green-200',
      pending: 'bg-amber-100 text-amber-700 border-amber-200',
      cancelled: 'bg-red-100 text-red-700 border-red-200',
      completed: 'bg-blue-100 text-blue-700 border-blue-200',
      active: 'bg-green-100 text-green-700 border-green-200',
      inactive: 'bg-slate-100 text-slate-700 border-slate-200',
    }
    return classes[status] || 'bg-slate-100 text-slate-700 border-slate-200'
  }

  getStatusIcon(status: string): string {
    const icons: { [key: string]: string } = {
      confirmed: 'check_circle',
      pending: 'schedule',
      cancelled: 'cancel',
      completed: 'task_alt',
      active: 'check_circle',
      inactive: 'block',
    }
    return icons[status] || 'info'
  }

  getStatusText(status: string): string {
    const texts: { [key: string]: string } = {
      confirmed: 'Confirmada',
      pending: 'Pendiente',
      cancelled: 'Cancelada',
      completed: 'Completada',
      active: 'Activo',
      inactive: 'Inactivo',
    }
    return texts[status] || status
  }

  async viewAppointmentDetails(appointment: RecentAppointment): Promise<void> {
    await this.alert.fire({
      icon: 'info',
      title: 'Detalles de la Cita',
      html: `
        <div class="text-left space-y-2">
          <p><strong>Paciente:</strong> ${appointment.patientName}</p>
          <p><strong>Doctor:</strong> ${appointment.doctorName}</p>
          <p><strong>Tipo:</strong> ${appointment.type}</p>
          <p><strong>Hora:</strong> ${appointment.time}</p>
          <p><strong>Estado:</strong> ${this.getStatusText(appointment.status)}</p>
        </div>
      `,
      confirmButtonText: 'Cerrar',
    })
  }

  async editAppointment(appointment: RecentAppointment): Promise<void> {
    const result = await this.alert.fire({
      icon: 'question',
      title: 'Editar Cita',
      text: `¿Desea editar la cita de ${appointment.patientName}?`,
      showCancelButton: true,
      confirmButtonText: 'Ir a editar',
      cancelButtonText: 'Cancelar',
    })

    if (result.isConfirmed) {
      // TODO: Navegar a la página de edición cuando esté implementada
      this.router.navigate(['/dashboard/appointments', appointment.id, 'edit'])
    }
  }

  async restockMedication(alert: StockAlert): Promise<void> {
    const result = await this.alert.fire({
      icon: 'question',
      title: 'Reabastecer Medicamento',
      text: `¿Desea proceder con el reabastecimiento de ${alert.medication}?`,
      showCancelButton: true,
      confirmButtonText: 'Ir a inventario',
      cancelButtonText: 'Cancelar',
    })

    if (result.isConfirmed) {
      this.router.navigate(['/dashboard/pharmacy/inventory'])
    }
  }

  async viewPatientDetails(patient: RecentPatient): Promise<void> {
    const result = await this.alert.fire({
      icon: 'info',
      title: 'Perfil del Paciente',
      html: `
        <div class="text-left space-y-2">
          <p><strong>Nombre:</strong> ${patient.name}</p>
          <p><strong>Edad:</strong> ${patient.age} años</p>
          <p><strong>Última visita:</strong> ${new Date(patient.lastVisit).toLocaleDateString('es-BO')}</p>
          ${patient.nextAppointment ? `<p><strong>Próxima cita:</strong> ${new Date(patient.nextAppointment).toLocaleDateString('es-BO')}</p>` : ''}
          ${patient.phone ? `<p><strong>Teléfono:</strong> ${patient.phone}</p>` : ''}
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Ver expediente completo',
      cancelButtonText: 'Cerrar',
    })

    if (result.isConfirmed) {
      this.router.navigate(['/dashboard/patients', patient.id])
    }
  }

  async scheduleAppointment(patient: RecentPatient): Promise<void> {
    const result = await this.alert.fire({
      icon: 'question',
      title: 'Programar Nueva Cita',
      text: `¿Desea programar una cita para ${patient.name}?`,
      showCancelButton: true,
      confirmButtonText: 'Programar',
      cancelButtonText: 'Cancelar',
    })

    if (result.isConfirmed) {
      this.router.navigate(['/dashboard/appointments/new'], {
        queryParams: { patientId: patient.id },
      })
    }
  }
}
