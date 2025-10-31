import { Location } from '@angular/common'
import { Component, OnInit, ViewChild } from '@angular/core'
import { MatPaginator } from '@angular/material/paginator'
import { MatSort } from '@angular/material/sort'
import { MatTableDataSource } from '@angular/material/table'
import { ActivatedRoute, Router } from '@angular/router'
import Swal from 'sweetalert2'
import { ErrorService } from '../../../../../shared/components/services/error.service'
import { Patient } from '../interfaces'
import { PatientsService } from '../services'

@Component({
  selector: 'app-patient-list',
  templateUrl: './patient-list.component.html',
  styleUrl: './patient-list.component.css',
})
export class PatientListComponent implements OnInit {
  displayedColumns: string[] = ['documentNumber', 'name', 'age', 'gender', 'phone', 'actions']
  dataSource: MatTableDataSource<Patient>
  isLoading = false

  @ViewChild(MatPaginator) paginator!: MatPaginator
  @ViewChild(MatSort) sort!: MatSort

  patients: Patient[] = []

  constructor(
    private patientsService: PatientsService,
    private router: Router,
    private errorService: ErrorService,
    private location: Location,
    private route: ActivatedRoute,
  ) {
    this.dataSource = new MatTableDataSource(this.patients)
  }

  ngOnInit(): void {
    this.route.queryParamMap.subscribe(params => {
      const q = (params.get('q') || '').trim()
      if (q) {
        this.searchPatients(q)
      } else {
        this.loadPatients()
      }
    })
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator
    this.dataSource.sort = this.sort
  }

  loadPatients() {
    this.isLoading = true
    this.patientsService.findAll().subscribe({
      next: patients => {
        this.patients = patients
        this.dataSource.data = this.patients
        this.isLoading = false
      },
      error: error => {
        this.errorService.handleError(error)
        this.isLoading = false
      },
    })
  }

  applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value
    this.dataSource.filter = filterValue.trim().toLowerCase()

    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage()
    }
  }

  searchPatients(searchTerm: string) {
    if (searchTerm.trim()) {
      this.isLoading = true
      this.patientsService.searchPatients(searchTerm).subscribe({
        next: patients => {
          this.dataSource.data = patients
          this.isLoading = false
        },
        error: error => {
          this.errorService.handleError(error)
          this.isLoading = false
        },
      })
    } else {
      this.loadPatients()
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

  createPatient() {
    this.router.navigate(['/dashboard/patients/new'])
  }

  goBack() {
    this.location.back()
  }

  editPatient(patient: Patient) {
    this.router.navigate(['/dashboard/patients/edit', patient.id])
  }

  viewPatient(patient: Patient) {
    this.router.navigate(['/dashboard/patients/view', patient.id])
  }

  deletePatient(patient: Patient) {
    Swal.fire({
      title: '¿Estás seguro?',
      text: `¿Deseas eliminar al paciente ${this.getPatientFullName(patient)}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
    }).then(result => {
      if (result.isConfirmed) {
        this.patientsService.removePatient(patient.id).subscribe({
          next: () => {
            Swal.fire('Eliminado', 'El paciente ha sido eliminado.', 'success')
            this.loadPatients()
          },
          error: error => {
            this.errorService.handleError(error)
          },
        })
      }
    })
  }
}
