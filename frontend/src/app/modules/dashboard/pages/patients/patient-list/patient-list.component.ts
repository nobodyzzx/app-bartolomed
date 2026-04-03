import { Location } from '@angular/common'
import { AfterViewInit, Component, DestroyRef, inject, OnInit, ViewChild } from '@angular/core'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { MatPaginator, PageEvent } from '@angular/material/paginator'
import { MatSort } from '@angular/material/sort'
import { MatTableDataSource } from '@angular/material/table'
import { ActivatedRoute, Router } from '@angular/router'
import { Subject } from 'rxjs'
import { debounceTime, distinctUntilChanged } from 'rxjs/operators'
import { AlertService } from '@core/services/alert.service'
import { Gender, Patient, PatientStatistics } from '../interfaces'
import { PatientsService } from '../services'

@Component({
  selector: 'app-patient-list',
  templateUrl: './patient-list.component.html',
  styleUrl: './patient-list.component.css',
})
export class PatientListComponent implements OnInit, AfterViewInit {
  private readonly destroyRef = inject(DestroyRef)

  displayedColumns: string[] = ['documentNumber', 'name', 'age', 'gender', 'phone', 'actions']
  dataSource: MatTableDataSource<Patient>
  isLoading = false
  searchTerm = ''

  @ViewChild(MatPaginator) paginator!: MatPaginator
  @ViewChild(MatSort) sort!: MatSort

  readonly Gender = Gender
  totalRecords = 0
  pageSize = 25
  currentPage = 0
  activeGenderFilter: Gender | null = null
  statistics: PatientStatistics | null = null

  private searchSubject = new Subject<string>()

  constructor(
    private patientsService: PatientsService,
    private router: Router,
    private location: Location,
    private route: ActivatedRoute,
    private alert: AlertService,
  ) {
    this.dataSource = new MatTableDataSource<Patient>([])
  }

  ngOnInit(): void {
    this.loadStatistics()

    this.searchSubject.pipe(
      debounceTime(350),
      distinctUntilChanged(),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(() => {
      this.currentPage = 0
      if (this.paginator) this.paginator.firstPage()
      this.loadPatients()
    })

    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      const q = (params.get('q') || '').trim()
      this.searchTerm = q
      this.loadPatients()
    })
  }

  ngAfterViewInit(): void {
    this.dataSource.sort = this.sort
  }

  loadStatistics(): void {
    this.patientsService.getPatientStatistics().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: stats => { this.statistics = stats },
      error: () => { /* non-critical */ },
    })
  }

  loadPatients(): void {
    this.isLoading = true

    if (this.searchTerm.trim()) {
      this.patientsService.searchPatients(this.searchTerm).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: patients => {
          this.dataSource.data = patients
          this.totalRecords = patients.length
          this.isLoading = false
        },
        error: error => {
          this.alert.error('Error al buscar pacientes', error?.message || 'Inténtalo de nuevo')
          this.isLoading = false
        },
      })
    } else {
      this.patientsService.findAll({
        page: this.currentPage + 1,
        limit: this.pageSize,
        gender: this.activeGenderFilter ?? undefined,
      }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: result => {
          this.dataSource.data = result.data
          this.totalRecords = result.total
          this.isLoading = false
        },
        error: error => {
          this.alert.error('Error al cargar pacientes', error?.message || 'Inténtalo de nuevo')
          this.isLoading = false
        },
      })
    }
  }

  onPageChange(event: PageEvent): void {
    this.currentPage = event.pageIndex
    this.pageSize = event.pageSize
    this.loadPatients()
  }

  applyFilter(value: string): void {
    this.searchTerm = value
    this.searchSubject.next(value)
  }

  clearFilters(): void {
    this.searchTerm = ''
    this.activeGenderFilter = null
    this.currentPage = 0
    if (this.paginator) this.paginator.firstPage()
    this.loadPatients()
  }

  setGenderFilter(gender: Gender | null): void {
    this.activeGenderFilter = gender
    this.currentPage = 0
    if (this.paginator) this.paginator.firstPage()
    this.loadPatients()
  }

  getMaleCount(): number {
    return this.getGenderCount(Gender.MALE)
  }

  getFemaleCount(): number {
    return this.getGenderCount(Gender.FEMALE)
  }

  private getGenderCount(gender: Gender): number {
    const stat = this.statistics?.genderStats.find(s => s.gender === gender)
    return stat ? Number(stat.count) : 0
  }

  getNewThisMonthCount(): number {
    return this.statistics?.newThisMonth ?? 0
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
          this.patientsService.removePatient(patient.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: () => {
              this.dataSource.data = this.dataSource.data.filter(p => p.id !== patient.id)
              this.totalRecords--
              this.loadStatistics()
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
