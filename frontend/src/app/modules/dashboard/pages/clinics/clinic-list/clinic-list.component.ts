import { Component, OnInit, ViewChild } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { Router } from '@angular/router';
import { ConfirmDialogComponent } from '../../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { ErrorService } from '../../../../../shared/components/services/error.service';
import { Clinic } from '../interfaces';
import { ClinicsService } from '../services';

@Component({
  selector: 'app-clinic-list',
  templateUrl: './clinic-list.component.html',
  styleUrl: './clinic-list.component.css'
})
export class ClinicListComponent implements OnInit {
  displayedColumns: string[] = ['name', 'address', 'phone', 'email', 'isActive', 'actions'];
  dataSource = new MatTableDataSource<Clinic>();
  isLoading = false;
  searchTerm = '';

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  constructor(
    private clinicsService: ClinicsService,
    private router: Router,
    private dialog: MatDialog,
    private errorService: ErrorService
  ) { }

  ngOnInit(): void {
    this.loadClinics();
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  loadClinics() {
    this.isLoading = true;
    this.clinicsService.findAll(true).subscribe({
      next: (clinics) => {
        this.dataSource.data = clinics;
        this.isLoading = false;
      },
      error: (error) => {
        this.errorService.handleError(error);
        this.isLoading = false;
      }
    });
  }

  searchClinics() {
    if (this.searchTerm.trim()) {
      this.isLoading = true;
      this.clinicsService.searchClinics(this.searchTerm).subscribe({
        next: (clinics) => {
          this.dataSource.data = clinics;
          this.isLoading = false;
        },
        error: (error) => {
          this.errorService.handleError(error);
          this.isLoading = false;
        }
      });
    } else {
      this.loadClinics();
    }
  }

  applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSource.filter = filterValue.trim().toLowerCase();

    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  viewClinic(clinic: Clinic) {
    this.router.navigate(['/dashboard/clinics/view', clinic.id]);
  }

  editClinic(clinic: Clinic) {
    this.router.navigate(['/dashboard/clinics/edit', clinic.id]);
  }

  toggleClinicStatus(clinic: Clinic) {
    const action = clinic.isActive ? 'desactivar' : 'activar';
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: `${action.charAt(0).toUpperCase() + action.slice(1)} Clínica`,
        message: `¿Está seguro que desea ${action} la clínica "${clinic.name}"?`,
        confirmText: action.charAt(0).toUpperCase() + action.slice(1),
        cancelText: 'Cancelar'
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        const request = clinic.isActive 
          ? this.clinicsService.deactivateClinic(clinic.id)
          : this.clinicsService.activateClinic(clinic.id);

        request.subscribe({
          next: () => {
            this.loadClinics();
          },
          error: (error) => {
            this.errorService.handleError(error);
          }
        });
      }
    });
  }

  deleteClinic(clinic: Clinic) {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Eliminar Clínica',
        message: `¿Está seguro que desea eliminar la clínica "${clinic.name}"? Esta acción no se puede deshacer.`,
        confirmText: 'Eliminar',
        cancelText: 'Cancelar',
        isDestructive: true
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.clinicsService.delete(clinic.id).subscribe({
          next: () => {
            this.loadClinics();
          },
          error: (error: any) => {
            this.errorService.handleError(error);
          }
        });
      }
    });
  }

  navigateToNew() {
    this.router.navigate(['/dashboard/clinics/new']);
  }
}
