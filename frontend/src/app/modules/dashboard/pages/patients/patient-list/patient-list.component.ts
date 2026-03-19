import { Location } from '@angular/common'
import { AfterViewInit, Component, OnInit, ViewChild } from '@angular/core'
import { MatPaginator } from '@angular/material/paginator'
import { MatSort } from '@angular/material/sort'
import { MatTableDataSource } from '@angular/material/table'
import { ActivatedRoute, Router } from '@angular/router'
import { AlertService } from '@core/services/alert.service'
import { Gender, Patient } from '../interfaces'
import { PatientsService } from '../services'

@Component({
  selector: 'app-patient-list',
  templateUrl: './patient-list.component.html',
  styleUrl: './patient-list.component.css',
})
export class PatientListComponent implements OnInit, AfterViewInit {
  displayedColumns: string[] = ['documentNumber', 'name', 'age', 'gender', 'phone', 'actions']
  dataSource: MatTableDataSource<Patient>
  isLoading = false
  searchTerm = ''

  @ViewChild(MatPaginator) paginator!: MatPaginator
  @ViewChild(MatSort) sort!: MatSort

  readonly Gender = Gender
  patients: Patient[] = []
  activeGenderFilter: Gender | null = null

  constructor(
    private patientsService: PatientsService,
    private router: Router,
    private location: Location,
    private route: ActivatedRoute,
    private alert: AlertService,
  ) {
    this.dataSource = new MatTableDataSource<Patient>([])
    this.dataSource.filterPredicate = (patient: Patient, filter: string) => {
      const term = filter.toLowerCase()
      const fullName = `${patient.firstName} ${patient.lastName}`.toLowerCase()
      return (
        fullName.includes(term) ||
        patient.documentNumber.toLowerCase().includes(term) ||
        (patient.phone ?? '').toLowerCase().includes(term) ||
        (patient.email ?? '').toLowerCase().includes(term)
      )
    }
  }

  ngOnInit(): void {
    this.route.queryParamMap.subscribe(params => {
      const q = (params.get('q') || '').trim()
      if (q) {
        this.searchTerm = q
        this.loadPatients(() => {
          this.dataSource.filter = q.toLowerCase()
        })
      } else {
        this.loadPatients()
      }
    })
  }

  ngAfterViewInit(): void {
    this.dataSource.paginator = this.paginator
    this.dataSource.sort = this.sort
  }

  loadPatients(afterLoad?: () => void): void {
    this.isLoading = true
    this.patientsService.findAll().subscribe({
      next: patients => {
        this.patients = patients
        this.applyFilters()
        this.isLoading = false
        afterLoad?.()
      },
      error: error => {
        this.alert.error('Error al cargar pacientes', error?.message || 'Inténtalo de nuevo')
        this.isLoading = false
      },
    })
  }

  applyFilter(event: Event): void {
    this.searchTerm = (event.target as HTMLInputElement).value
    this.applyFilters()
  }

  setGenderFilter(gender: Gender | null): void {
    this.activeGenderFilter = gender
    this.applyFilters()
  }

  private applyFilters(): void {
    const filtered = this.activeGenderFilter
      ? this.patients.filter(p => p.gender === this.activeGenderFilter)
      : this.patients
    this.dataSource.data = filtered
    this.dataSource.filter = this.searchTerm.trim().toLowerCase()
    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage()
    }
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

  getAverageAge(): number {
    if (!this.patients.length) return 0
    const total = this.patients.reduce((sum, p) => sum + this.getPatientAge(p), 0)
    return Math.round(total / this.patients.length)
  }

  getMaleCount(): number {
    return this.patients.filter(p => p.gender === Gender.MALE).length
  }

  getFemaleCount(): number {
    return this.patients.filter(p => p.gender === Gender.FEMALE).length
  }

  createPatient(): void {
    this.router.navigate(['/dashboard/patients/new'])
  }

  goBack(): void {
    this.location.back()
  }

  viewPatient(patient: Patient): void {
    this.router.navigate(['/dashboard/patients/view', patient.id])
  }

  editPatient(patient: Patient): void {
    this.router.navigate(['/dashboard/patients/edit', patient.id])
  }

  deletePatient(patient: Patient): void {
    this.alert
      .fire({
        title: '¿Eliminar paciente?',
        text: `¿Está seguro de eliminar a ${this.getPatientFullName(patient)}? Esta acción no se puede deshacer.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar',
      })
      .then(result => {
        if (result.isConfirmed) {
          this.patientsService.removePatient(patient.id).subscribe({
            next: () => {
              this.patients = this.patients.filter(p => p.id !== patient.id)
              this.applyFilters()
              this.alert.success('Eliminado', 'El paciente ha sido eliminado.')
            },
            error: error => {
              this.alert.error('No se pudo eliminar', error?.message || 'Inténtalo de nuevo')
            },
          })
        }
      })
  }

  createMedicalRecord(patient: Patient): void {
    this.router.navigate(['/dashboard/medical-records/new'], {
      queryParams: { patientId: patient.id },
    })
  }

  viewMedicalHistory(patient: Patient): void {
    this.router.navigate(['/dashboard/medical-records/patient', patient.id, 'history'])
  }
}
