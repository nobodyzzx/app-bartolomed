import { Location } from '@angular/common'
import { Component, OnInit } from '@angular/core'
import { Router } from '@angular/router'
import { AlertService } from '@core/services/alert.service'
import { Patient, PatientStatistics } from '../interfaces'
import { PatientsService } from '../services'

@Component({
  selector: 'app-patient-dashboard',
  templateUrl: './patient-dashboard.component.html',
  styleUrl: './patient-dashboard.component.css',
})
export class PatientDashboardComponent implements OnInit {
  searchTerm = ''
  statistics: PatientStatistics | null = null
  recentPatients: Patient[] = []
  isLoading = false

  constructor(
    private patientsService: PatientsService,
    private router: Router,
    private alert: AlertService,
    private location: Location,
  ) {}

  ngOnInit(): void {
    // this.loadStatistics(); // Temporalmente comentado para debug
    this.loadRecentPatients()
  }

  loadStatistics() {
    this.isLoading = true
    this.patientsService.getPatientStatistics().subscribe({
      next: stats => {
        this.statistics = stats
        this.isLoading = false
      },
      error: error => {
        this.alert.error('Error al cargar estadísticas', error?.message || 'Inténtalo de nuevo')
        this.isLoading = false
      },
    })
  }

  loadRecentPatients() {
    this.patientsService.findAll().subscribe({
      next: patients => {
        // Obtener los 5 pacientes más recientes
        this.recentPatients = patients
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 5)
      },
      error: error => {
        this.alert.error(
          'Error al cargar pacientes recientes',
          error?.message || 'Inténtalo de nuevo',
        )
      },
    })
  }

  getPatientFullName(patient: Patient): string {
    return `${patient.firstName} ${patient.lastName}`
  }

  getPatientAge(patient: Patient): number {
    const today = new Date()
    const birthDate = new Date(patient.birthDate)
    let age = today.getFullYear() - birthDate.getFullYear()
    const monthDiff = today.getMonth() - birthDate.getMonth()

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--
    }

    return age
  }

  navigateToPatients() {
    this.router.navigate(['/dashboard/patients/list'])
  }

  navigateToNewPatient() {
    this.router.navigate(['/dashboard/patients/new'])
  }

  viewPatient(patient: Patient) {
    this.router.navigate(['/dashboard/patients/view', patient.id])
  }

  goToListSearch() {
    const term = this.searchTerm?.trim()
    if (!term) return
    this.router.navigate(['/dashboard/patients/list'], { queryParams: { q: term } })
  }

  goBack() {
    this.location.back()
  }
}
