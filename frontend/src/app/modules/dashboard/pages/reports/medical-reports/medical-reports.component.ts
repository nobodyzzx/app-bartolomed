import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { GenerateReportParams, MedicalReport } from '../interfaces/reports.interfaces';
import { ReportsService } from '../services/reports.service';

@Component({
  selector: 'app-medical-reports',
  templateUrl: './medical-reports.component.html',
  styleUrls: ['./medical-reports.component.css']
})
export class MedicalReportsComponent implements OnInit {
  medicalReports: MedicalReport[] = [];
  loading = false;
  generateForm: FormGroup;
  displayedColumns: string[] = ['title', 'type', 'date', 'patientCount', 'status', 'actions'];

  reportTypes = [
    { value: 'Consultas', label: 'Reporte de Consultas' },
    { value: 'Diagnósticos', label: 'Diagnósticos Frecuentes' },
    { value: 'Tratamientos', label: 'Efectividad de Tratamientos' },
    { value: 'Epidemiológico', label: 'Análisis Epidemiológico' }
  ];

  constructor(
    private reportsService: ReportsService,
    private fb: FormBuilder,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {
    this.generateForm = this.fb.group({
      type: ['', Validators.required],
      title: ['', Validators.required],
      description: [''],
      startDate: ['', Validators.required],
      endDate: ['', Validators.required]
    });
  }

  ngOnInit(): void {
    this.loadMedicalReports();
  }

  loadMedicalReports(): void {
    this.loading = true;
    this.reportsService.getMedicalReports().subscribe({
      next: (reports) => {
        this.medicalReports = reports;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading medical reports:', error);
        this.snackBar.open('Error al cargar los reportes médicos', 'Cerrar', {
          duration: 3000
        });
        this.loading = false;
      }
    });
  }

  onGenerateReport(): void {
    if (this.generateForm.valid) {
      this.loading = true;
      const formValue = this.generateForm.value;
      
      const params: GenerateReportParams = {
        type: formValue.type,
        title: formValue.title,
        description: formValue.description,
        filters: {
          startDate: formValue.startDate,
          endDate: formValue.endDate
        }
      };

      this.reportsService.generateMedicalReport(params).subscribe({
        next: (newReport) => {
          this.medicalReports.unshift(newReport);
          this.generateForm.reset();
          this.loading = false;
          this.snackBar.open('Reporte médico generado exitosamente', 'Cerrar', {
            duration: 3000
          });
        },
        error: (error) => {
          console.error('Error generating medical report:', error);
          this.snackBar.open('Error al generar el reporte médico', 'Cerrar', {
            duration: 3000
          });
          this.loading = false;
        }
      });
    }
  }

  downloadReport(report: MedicalReport): void {
    this.reportsService.downloadReport(report.id, 'pdf').subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${report.title}.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
        this.snackBar.open('Reporte descargado exitosamente', 'Cerrar', {
          duration: 2000
        });
      },
      error: (error) => {
        console.error('Error downloading report:', error);
        this.snackBar.open('Error al descargar el reporte', 'Cerrar', {
          duration: 3000
        });
      }
    });
  }

  deleteReport(report: MedicalReport): void {
    if (confirm(`¿Está seguro de que desea eliminar el reporte "${report.title}"?`)) {
      this.reportsService.deleteReport(report.id).subscribe({
        next: () => {
          this.medicalReports = this.medicalReports.filter(r => r.id !== report.id);
          this.snackBar.open('Reporte eliminado exitosamente', 'Cerrar', {
            duration: 2000
          });
        },
        error: (error) => {
          console.error('Error deleting report:', error);
          this.snackBar.open('Error al eliminar el reporte', 'Cerrar', {
            duration: 3000
          });
        }
      });
    }
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'published': return 'primary';
      case 'generated': return 'accent';
      case 'draft': return 'warn';
      case 'archived': return '';
      default: return '';
    }
  }

  getStatusText(status: string): string {
    switch (status) {
      case 'published': return 'Publicado';
      case 'generated': return 'Generado';
      case 'draft': return 'Borrador';
      case 'archived': return 'Archivado';
      default: return status;
    }
  }
}
