import { Component, OnInit, ViewChild } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { MedicalRecord, RecordType, RecordStatus, MedicalRecordFilters } from './interfaces';
import { MedicalRecordsService } from './services/medical-records.service';

@Component({
  selector: 'app-medical-records-dashboard',
  templateUrl: './medical-records-dashboard.component.html',
  styleUrls: ['./medical-records-dashboard.component.css']
})
export class MedicalRecordsDashboardComponent implements OnInit {
  displayedColumns: string[] = [
    'date', 
    'patient', 
    'type', 
    'chiefComplaint', 
    'doctor', 
    'status', 
    'actions'
  ];
  
  dataSource = new MatTableDataSource<MedicalRecord>([]);
  totalRecords = 0;
  
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  // Filtros
  filters: MedicalRecordFilters = {};
  recordTypes = Object.values(RecordType);
  recordStatuses = Object.values(RecordStatus);

  // Estadísticas
  stats = {
    total: 0,
    drafts: 0,
    completed: 0,
    emergencies: 0
  };

  loading = false;

  constructor(
    private medicalRecordsService: MedicalRecordsService,
    private dialog: MatDialog,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadMedicalRecords();
    this.loadStats();
  }

  ngAfterViewInit(): void {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  loadMedicalRecords(): void {
    this.loading = true;
    this.medicalRecordsService.getMedicalRecords(this.filters).subscribe({
      next: (response) => {
        this.dataSource.data = response.data;
        this.totalRecords = response.total;
        this.loading = false;
      },
      error: (error: any) => {
        console.error('Error cargando expedientes:', error);
        this.loading = false;
      }
    });
  }

  loadStats(): void {
    this.medicalRecordsService.getMedicalRecordsStats().subscribe({
      next: (stats) => {
        this.stats = stats;
      },
      error: (error) => {
        console.error('Error cargando estadísticas:', error);
      }
    });
  }

  applyFilter(event: Event): void {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSource.filter = filterValue.trim().toLowerCase();

    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  applyFilters(): void {
    this.loadMedicalRecords();
  }

  clearFilters(): void {
    this.filters = {};
    this.loadMedicalRecords();
  }

  createNewRecord(): void {
    this.router.navigate(['/dashboard/medical-records/new']);
  }

  viewRecord(record: MedicalRecord): void {
    this.router.navigate(['/dashboard/medical-records', record.id]);
  }

  editRecord(record: MedicalRecord): void {
    this.router.navigate(['/dashboard/medical-records', record.id, 'edit']);
  }

  deleteRecord(record: MedicalRecord): void {
    if (confirm('¿Está seguro de que desea eliminar este expediente médico?')) {
      this.medicalRecordsService.deleteMedicalRecord(record.id!).subscribe({
        next: () => {
          this.loadMedicalRecords();
        },
        error: (error) => {
          console.error('Error eliminando expediente:', error);
        }
      });
    }
  }

  completeRecord(record: MedicalRecord): void {
    // Actualizar el estado del expediente a 'completed'
    const updateData = { status: 'completed' as any };
    this.medicalRecordsService.updateMedicalRecord(record.id!, updateData).subscribe({
      next: () => {
        this.loadMedicalRecords();
      },
      error: (error: any) => {
        console.error('Error completando expediente:', error);
      }
    });
  }

  reviewRecord(record: MedicalRecord): void {
    // Actualizar el estado del expediente a 'reviewed'
    const updateData = { status: 'reviewed' as any };
    this.medicalRecordsService.updateMedicalRecord(record.id!, updateData).subscribe({
      next: () => {
        this.loadMedicalRecords();
      },
      error: (error: any) => {
        console.error('Error revisando expediente:', error);
      }
    });
  }

  exportRecord(record: MedicalRecord): void {
    // Por ahora, mostrar un mensaje indicando que la funcionalidad estará disponible próximamente
    console.log('Exportar expediente - funcionalidad en desarrollo');
    // TODO: Implementar exportación cuando esté disponible en el backend
  }

  getStatusColor(status: RecordStatus): string {
    switch (status) {
      case RecordStatus.DRAFT:
        return 'warn';
      case RecordStatus.COMPLETED:
        return 'primary';
      case RecordStatus.REVIEWED:
        return 'accent';
      case RecordStatus.ARCHIVED:
        return 'basic';
      default:
        return 'basic';
    }
  }

  getStatusText(status: RecordStatus): string {
    switch (status) {
      case RecordStatus.DRAFT:
        return 'Borrador';
      case RecordStatus.COMPLETED:
        return 'Completado';
      case RecordStatus.REVIEWED:
        return 'Revisado';
      case RecordStatus.ARCHIVED:
        return 'Archivado';
      default:
        return status;
    }
  }

  getTypeText(type: RecordType): string {
    switch (type) {
      case RecordType.CONSULTATION:
        return 'Consulta';
      case RecordType.EMERGENCY:
        return 'Emergencia';
      case RecordType.SURGERY:
        return 'Cirugía';
      case RecordType.FOLLOW_UP:
        return 'Seguimiento';
      case RecordType.LABORATORY:
        return 'Laboratorio';
      case RecordType.IMAGING:
        return 'Imagenología';
      case RecordType.OTHER:
        return 'Otro';
      default:
        return type;
    }
  }

  getRecordIcon(type: RecordType): string {
    switch (type) {
      case RecordType.CONSULTATION:
        return 'assignment';
      case RecordType.EMERGENCY:
        return 'emergency';
      case RecordType.SURGERY:
        return 'healing';
      case RecordType.FOLLOW_UP:
        return 'update';
      case RecordType.LABORATORY:
        return 'biotech';
      case RecordType.IMAGING:
        return 'camera_alt';
      case RecordType.OTHER:
        return 'description';
      default:
        return 'description';
    }
  }
}
