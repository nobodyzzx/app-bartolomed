import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FinancialReport, GenerateReportParams } from '../interfaces/reports.interfaces';
import { ReportsService } from '../services/reports.service';

@Component({
  selector: 'app-financial-reports',
  templateUrl: './financial-reports.component.html',
  styleUrls: ['./financial-reports.component.css']
})
export class FinancialReportsComponent implements OnInit {
  financialReports: FinancialReport[] = [];
  loading = false;
  generateForm: FormGroup;
  displayedColumns: string[] = ['title', 'type', 'date', 'totalAmount', 'status', 'actions'];

  reportTypes = [
    { value: 'Financiero', label: 'Reporte Financiero General' },
    { value: 'Ventas', label: 'Análisis de Ventas' },
    { value: 'Gastos', label: 'Control de Gastos' },
    { value: 'Ingresos', label: 'Análisis de Ingresos' },
    { value: 'Balance', label: 'Balance Contable' }
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
    this.loadFinancialReports();
  }

  loadFinancialReports(): void {
    this.loading = true;
    this.reportsService.getFinancialReports().subscribe({
      next: (reports) => {
        this.financialReports = reports;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading financial reports:', error);
        this.snackBar.open('Error al cargar los reportes financieros', 'Cerrar', {
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

      this.reportsService.generateFinancialReport(params).subscribe({
        next: (newReport) => {
          this.financialReports.unshift(newReport);
          this.generateForm.reset();
          this.loading = false;
          this.snackBar.open('Reporte financiero generado exitosamente', 'Cerrar', {
            duration: 3000
          });
        },
        error: (error) => {
          console.error('Error generating financial report:', error);
          this.snackBar.open('Error al generar el reporte financiero', 'Cerrar', {
            duration: 3000
          });
          this.loading = false;
        }
      });
    }
  }

  downloadReport(report: FinancialReport): void {
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

  exportToExcel(report: FinancialReport): void {
    this.reportsService.exportReport(report.id, 'excel').subscribe({
      next: () => {
        this.snackBar.open('Reporte exportado a Excel exitosamente', 'Cerrar', {
          duration: 2000
        });
      },
      error: (error) => {
        console.error('Error exporting to Excel:', error);
        this.snackBar.open('Error al exportar a Excel', 'Cerrar', {
          duration: 3000
        });
      }
    });
  }

  deleteReport(report: FinancialReport): void {
    if (confirm(`¿Está seguro de que desea eliminar el reporte "${report.title}"?`)) {
      this.reportsService.deleteReport(report.id).subscribe({
        next: () => {
          this.financialReports = this.financialReports.filter(r => r.id !== report.id);
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

  formatCurrency(amount: number | undefined): string {
    if (amount === undefined) return 'N/A';
    return new Intl.NumberFormat('es-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }
}
