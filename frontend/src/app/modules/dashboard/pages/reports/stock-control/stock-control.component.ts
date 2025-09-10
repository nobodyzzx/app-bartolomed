import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { GenerateReportParams, StockReport } from '../interfaces/reports.interfaces';
import { ReportsService } from '../services/reports.service';

@Component({
  selector: 'app-stock-control',
  templateUrl: './stock-control.component.html',
  styleUrls: ['./stock-control.component.css']
})
export class StockControlComponent implements OnInit {
  stockReports: StockReport[] = [];
  loading = false;
  generateForm: FormGroup;
  displayedColumns: string[] = ['title', 'type', 'date', 'totalProducts', 'stockValue', 'status', 'actions'];

  reportTypes = [
    { value: 'Inventario', label: 'Reporte de Inventario General' },
    { value: 'Vencimientos', label: 'Productos por Vencer' },
    { value: 'Movimientos', label: 'Movimientos de Stock' },
    { value: 'Bajo Stock', label: 'Productos con Stock Bajo' }
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
      startDate: [''],
      endDate: ['']
    });
  }

  ngOnInit(): void {
    this.loadStockReports();
  }

  loadStockReports(): void {
    this.loading = true;
    this.reportsService.getStockReports().subscribe({
      next: (reports) => {
        this.stockReports = reports;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading stock reports:', error);
        this.snackBar.open('Error al cargar los reportes de stock', 'Cerrar', {
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

      this.reportsService.generateStockReport(params).subscribe({
        next: (newReport) => {
          this.stockReports.unshift(newReport);
          this.generateForm.reset();
          this.loading = false;
          this.snackBar.open('Reporte de stock generado exitosamente', 'Cerrar', {
            duration: 3000
          });
        },
        error: (error) => {
          console.error('Error generating stock report:', error);
          this.snackBar.open('Error al generar el reporte de stock', 'Cerrar', {
            duration: 3000
          });
          this.loading = false;
        }
      });
    }
  }

  downloadReport(report: StockReport): void {
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

  exportToExcel(report: StockReport): void {
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

  deleteReport(report: StockReport): void {
    if (confirm(`¿Está seguro de que desea eliminar el reporte "${report.title}"?`)) {
      this.reportsService.deleteReport(report.id).subscribe({
        next: () => {
          this.stockReports = this.stockReports.filter(r => r.id !== report.id);
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

  getTypeIcon(type: string): string {
    switch (type) {
      case 'Inventario': return 'inventory';
      case 'Vencimientos': return 'schedule';
      case 'Movimientos': return 'swap_horiz';
      case 'Bajo Stock': return 'warning';
      default: return 'assessment';
    }
  }

  getTypeColor(type: string): string {
    switch (type) {
      case 'Inventario': return 'primary';
      case 'Vencimientos': return 'warn';
      case 'Movimientos': return 'accent';
      case 'Bajo Stock': return 'warn';
      default: return 'primary';
    }
  }
}
