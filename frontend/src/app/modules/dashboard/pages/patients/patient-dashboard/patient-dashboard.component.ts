import { Location } from '@angular/common'
import { Component, OnInit } from '@angular/core'
import { Router } from '@angular/router'
import { AlertService } from '@core/services/alert.service'
import { Gender, Patient } from '../interfaces'
import { PatientsService } from '../services'

@Component({
  selector: 'app-patient-dashboard',
  templateUrl: './patient-dashboard.component.html',
  styleUrl: './patient-dashboard.component.css',
})
export class PatientDashboardComponent implements OnInit {
  searchTerm = ''
  allPatients: Patient[] = []
  recentPatients: Patient[] = []
  isLoading = false

  readonly displayedColumns = ['name', 'age', 'createdAt', 'actions']

  constructor(
    private patientsService: PatientsService,
    private router: Router,
    private alert: AlertService,
    private location: Location,
  ) {}

  ngOnInit(): void {
    this.loadPatients()
  }

  loadPatients(): void {
    this.isLoading = true
    this.patientsService.findAll().subscribe({
      next: patients => {
        this.allPatients = patients
        this.recentPatients = [...patients]
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 8)
        this.isLoading = false
      },
      error: error => {
        this.alert.error('Error al cargar pacientes', error?.message || 'Inténtalo de nuevo')
        this.isLoading = false
      },
    })
  }

  getTotalCount(): number {
    return this.allPatients.length
  }

  getMaleCount(): number {
    return this.allPatients.filter(p => p.gender === Gender.MALE).length
  }

  getFemaleCount(): number {
    return this.allPatients.filter(p => p.gender === Gender.FEMALE).length
  }

  getNewThisMonthCount(): number {
    const start = new Date()
    start.setDate(1)
    start.setHours(0, 0, 0, 0)
    return this.allPatients.filter(p => new Date(p.createdAt) >= start).length
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

  getInitials(patient: Patient): string {
    return `${patient.firstName.charAt(0)}${patient.lastName.charAt(0)}`
  }

  getGender(patient: Patient): Gender {
    return patient.gender
  }

  navigateToList(): void {
    this.router.navigate(['/dashboard/patients/list'])
  }

  navigateToNewPatient(): void {
    this.router.navigate(['/dashboard/patients/new'])
  }

  viewPatient(patient: Patient): void {
    this.router.navigate(['/dashboard/patients/view', patient.id])
  }

  editPatient(patient: Patient): void {
    this.router.navigate(['/dashboard/patients/edit', patient.id])
  }

  goToListSearch(): void {
    const term = this.searchTerm.trim()
    if (!term) return
    this.router.navigate(['/dashboard/patients/list'], { queryParams: { q: term } })
  }

  goBack(): void {
    this.location.back()
  }
}
