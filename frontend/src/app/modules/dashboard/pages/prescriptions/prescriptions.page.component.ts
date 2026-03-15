import { Location } from '@angular/common'
import { Component, OnInit } from '@angular/core'
import { Router } from '@angular/router'
import { AlertService } from '@core/services/alert.service'
import { PrescriptionsService } from './prescriptions.service'

interface Prescription {
  id: string
  prescriptionNumber: string
  prescriptionDate: string
  expiryDate: string
  status: string
  patient: {
    id: string
    firstName: string
    lastName: string
    documentNumber: string
  }
  doctor: {
    id: string
    email: string
    personalInfo?: {
      firstName: string
      lastName: string
    }
  }
  items: Array<{
    medicationName: string
    strength: string
    quantity: string
  }>
}

interface PrescriptionStatistics {
  total: number
  active: number
  expired: number
  expiringSoon: number
}

@Component({
  selector: 'app-prescriptions-page',
  templateUrl: './prescriptions.page.component.html',
})
export class PrescriptionsPageComponent implements OnInit {
  searchTerm = ''
  statistics: PrescriptionStatistics | null = null
  recentPrescriptions: Prescription[] = []
  isLoading = false
  displayedColumns: string[] = [
    'number',
    'patient',
    'doctor',
    'date',
    'expiry',
    'status',
    'actions',
  ]

  constructor(
    private prescriptionsService: PrescriptionsService,
    private router: Router,
    private alert: AlertService,
    private location: Location,
  ) {}

  ngOnInit(): void {
    this.loadData()
  }

  loadData(): void {
    this.isLoading = true
    this.prescriptionsService.list(1, 100).subscribe({
      next: (response: any) => {
        // El backend devuelve { items, total, page, pageSize }
        const prescriptions: Prescription[] = response.items || []

        // Calcular estadísticas
        const today = new Date()
        const thirtyDaysFromNow = new Date()
        thirtyDaysFromNow.setDate(today.getDate() + 30)

        this.statistics = {
          total: prescriptions.length,
          active: prescriptions.filter(p => p.status === 'active').length,
          expired: prescriptions.filter(p => {
            const expiryDate = new Date(p.expiryDate)
            return expiryDate < today
          }).length,
          expiringSoon: prescriptions.filter(p => {
            const expiryDate = new Date(p.expiryDate)
            return expiryDate >= today && expiryDate <= thirtyDaysFromNow && p.status === 'active'
          }).length,
        }

        // Obtener prescripciones recientes
        this.recentPrescriptions = prescriptions
          .sort(
            (a: Prescription, b: Prescription) =>
              new Date(b.prescriptionDate).getTime() - new Date(a.prescriptionDate).getTime(),
          )
          .slice(0, 5)

        this.isLoading = false
      },
      error: () => {
        this.alert.error('Error al cargar prescripciones', 'Inténtalo de nuevo')
        this.isLoading = false
        // Inicializar con valores vacíos en caso de error
        this.statistics = {
          total: 0,
          active: 0,
          expired: 0,
          expiringSoon: 0,
        }
        this.recentPrescriptions = []
      },
    })
  }

  getPatientFullName(prescription: Prescription): string {
    return `${prescription.patient.firstName} ${prescription.patient.lastName}`
  }

  getDoctorName(prescription: Prescription): string {
    if (prescription.doctor.personalInfo) {
      return `${prescription.doctor.personalInfo.firstName} ${prescription.doctor.personalInfo.lastName}`
    }
    return prescription.doctor.email
  }

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      draft: 'Borrador',
      active: 'Activa',
      dispensed: 'Dispensada',
      completed: 'Completada',
      cancelled: 'Cancelada',
      expired: 'Vencida',
    }
    return labels[status] || status
  }

  getStatusClass(status: string): string {
    const classes: Record<string, string> = {
      draft: 'bg-slate-100 text-slate-700',
      active: 'bg-green-100 text-green-700',
      dispensed: 'bg-blue-100 text-blue-700',
      completed: 'bg-purple-100 text-purple-700',
      cancelled: 'bg-red-100 text-red-700',
      expired: 'bg-orange-100 text-orange-700',
    }
    return classes[status] || 'bg-gray-100 text-gray-700'
  }

  formatDate(dateStr: string): string {
    const date = new Date(dateStr)
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }

  navigateToNewPrescription(): void {
    this.router.navigate(['/dashboard/prescriptions/new'])
  }

  navigateToPrescriptionsList(): void {
    this.router.navigate(['/dashboard/prescriptions/list'])
  }

  viewPrescription(prescription: Prescription): void {
    this.router.navigate(['/dashboard/prescriptions/view', prescription.id])
  }

  goBack(): void {
    this.location.back()
  }

  performSearch(): void {
    const term = this.searchTerm?.trim()
    if (!term) return
    this.router.navigate(['/dashboard/prescriptions/list'], {
      queryParams: { search: term },
    })
  }
}
