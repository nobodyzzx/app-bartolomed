import { Component, DestroyRef, inject, OnInit, ViewChild } from '@angular/core'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { MatDialog } from '@angular/material/dialog'
import { MatPaginator } from '@angular/material/paginator'
import { MatSort } from '@angular/material/sort'
import { MatTableDataSource } from '@angular/material/table'
import { ActivatedRoute, Router } from '@angular/router'
import { AlertService } from '@core/services/alert.service'
import { ConfirmDialogComponent } from '../../../../../../shared/components/confirm-dialog/confirm-dialog.component'
import { ErrorService } from '../../../../../../shared/components/services/error.service'
import { SidenavService } from '../../../../../../shared/components/services/sidenav.service'
import { Clinic } from '../interfaces'
import { ClinicsService } from '../services'

@Component({
    selector: 'app-clinic-list',
    templateUrl: './clinic-list.component.html',
    styleUrl: './clinic-list.component.css',
    standalone: false
})
export class ClinicListComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef)

  displayedColumns: string[] = ['name', 'address', 'phone', 'email', 'isActive', 'actions']
  dataSource = new MatTableDataSource<Clinic>()
  isExpanded: boolean = true
  isLoading = false
  searchTerm = ''
  filterStatus: 'all' | 'active' | 'inactive' = 'all'
  allClinics: Clinic[] = []

  @ViewChild(MatPaginator) paginator!: MatPaginator
  @ViewChild(MatSort) sort!: MatSort

  constructor(
    private clinicsService: ClinicsService,
    private router: Router,
    private route: ActivatedRoute,
    private dialog: MatDialog,
    private errorService: ErrorService,
    private sidenavService: SidenavService,
    private alert: AlertService,
  ) {}

  ngOnInit(): void {
    this.sidenavService.isExpanded$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(isExpanded => (this.isExpanded = isExpanded))

    this.route.queryParams.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      const status = params['status']
      if (status === 'active') {
        this.filterStatus = 'active'
      } else if (status === 'inactive') {
        this.filterStatus = 'inactive'
      } else {
        this.filterStatus = 'all'
      }
      this.loadClinics()
    })
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator
    this.dataSource.sort = this.sort
  }

  loadClinics() {
    this.isLoading = true

    // Cargar todas las clínicas primero
    this.clinicsService.findAll().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: clinics => {
        this.allClinics = clinics

        // Aplicar filtro según el estado seleccionado
        let filteredClinics = clinics
        if (this.filterStatus === 'active') {
          filteredClinics = clinics.filter(c => c.isActive === true)
        } else if (this.filterStatus === 'inactive') {
          filteredClinics = clinics.filter(c => c.isActive === false)
        }

        this.dataSource.data = filteredClinics
        this.isLoading = false
      },
      error: error => {
        this.errorService.handleError(error)
        this.isLoading = false
      },
    })
  }

  searchClinics() {
    if (this.searchTerm.trim()) {
      this.isLoading = true
      this.clinicsService.searchClinics(this.searchTerm).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: clinics => {
          this.dataSource.data = clinics
          this.isLoading = false
        },
        error: error => {
          this.errorService.handleError(error)
          this.isLoading = false
        },
      })
    } else {
      this.loadClinics()
    }
  }

  applyFilter(value: string) {
    this.dataSource.filter = value.trim().toLowerCase()
    if (this.dataSource.paginator) this.dataSource.paginator.firstPage()
  }

  viewClinic(clinic: Clinic) {
    this.router.navigate(['/dashboard/clinics/view', clinic.id])
  }

  editClinic(clinic: Clinic) {
    this.router.navigate(['/dashboard/clinics/edit', clinic.id])
  }

  toggleClinicStatus(clinic: Clinic) {
    const action = clinic.isActive ? 'desactivar' : 'activar'
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: `${action.charAt(0).toUpperCase() + action.slice(1)} Clínica`,
        message: `¿Está seguro que desea ${action} la clínica "${clinic.name}"?`,
        confirmText: action.charAt(0).toUpperCase() + action.slice(1),
        cancelText: 'Cancelar',
      },
    })

    dialogRef.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(result => {
      if (result) {
        const request = clinic.isActive
          ? this.clinicsService.deactivateClinic(clinic.id)
          : this.clinicsService.activateClinic(clinic.id)

        request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
          next: () => {
            this.alert
              .success(
                `Clínica ${clinic.isActive ? 'desactivada' : 'activada'}`,
                `La clínica ha sido ${clinic.isActive ? 'desactivada' : 'activada'} correctamente`,
              )
              .then()
            this.loadClinics()
          },
          error: error => {
            this.errorService.handleError(error)
          },
        })
      }
    })
  }

  deleteClinic(clinic: Clinic) {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Eliminar Clínica',
        message: `¿Está seguro que desea eliminar la clínica "${clinic.name}"? Esta acción no se puede deshacer.`,
        confirmText: 'Eliminar',
        cancelText: 'Cancelar',
        isDestructive: true,
      },
    })

    dialogRef.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(result => {
      if (result) {
        this.clinicsService.delete(clinic.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
          next: () => {
            this.alert
              .success('Clínica eliminada', 'La clínica ha sido eliminada correctamente')
              .then()
            this.loadClinics()
          },
          error: (error: any) => {
            this.errorService.handleError(error)
          },
        })
      }
    })
  }

  navigateToNew() {
    this.router.navigate(['/dashboard/clinics/new'])
  }

  setFilterStatus(status: 'all' | 'active' | 'inactive') {
    this.filterStatus = status
    if (status === 'all') {
      this.router.navigate(['/dashboard/clinics'])
    } else {
      this.router.navigate(['/dashboard/clinics'], { queryParams: { status } })
    }
  }

  getActiveClinicsCount(): number {
    return this.allClinics.filter(c => c.isActive).length
  }

  getInactiveClinicsCount(): number {
    return this.allClinics.filter(c => !c.isActive).length
  }
}
