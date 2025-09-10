import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { AssetReport, AssetStatus, ReportType } from '../interfaces/assets.interfaces';
import { AssetReportsService } from '../services/asset-reports.service';

@Component({
  selector: 'app-asset-reports',
  templateUrl: './asset-reports.component.html',
  styleUrls: ['./asset-reports.component.css']
})
export class AssetReportsComponent implements OnInit {
  reportsForm: FormGroup;
  reports: AssetReport[] = [];
  loading = false;
  selectedReport: AssetReport | null = null;

  reportTypes = Object.values(ReportType);
  assetStatuses = Object.values(AssetStatus);

  displayedColumns: string[] = [
    'title',
    'type', 
    'description',
    'date',
    'status',
    'actions'
  ];

  constructor(
    private fb: FormBuilder,
    private assetReportsService: AssetReportsService
  ) {
    this.reportsForm = this.fb.group({
      reportType: [''],
      dateFrom: [''],
      dateTo: [''],
      status: [''],
      format: ['PDF']
    });
  }

  ngOnInit(): void {
    this.loadReports();
  }

  loadReports(): void {
    this.loading = true;
    this.assetReportsService.getReports().subscribe({
      next: (reports) => {
        this.reports = reports;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading reports:', error);
        this.loading = false;
      }
    });
  }

  generateReport(): void {
    if (this.reportsForm.valid) {
      this.loading = true;
      const reportData = this.reportsForm.value;
      
      this.assetReportsService.generateReport(reportData).subscribe({
        next: (report) => {
          this.reports.unshift(report);
          this.reportsForm.reset();
          this.reportsForm.patchValue({ format: 'PDF' });
          this.loading = false;
          console.log('Report generated successfully');
        },
        error: (error) => {
          console.error('Error generating report:', error);
          this.loading = false;
        }
      });
    }
  }

  downloadReport(report: AssetReport): void {
    this.assetReportsService.downloadReport(report.id).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${report.title}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      },
      error: (error) => {
        console.error('Error downloading report:', error);
      }
    });
  }

  viewReport(report: AssetReport): void {
    this.selectedReport = report;
  }

  deleteReport(report: AssetReport): void {
    if (confirm(`¿Está seguro de que desea eliminar el reporte "${report.title}"?`)) {
      this.assetReportsService.deleteReport(report.id).subscribe({
        next: () => {
          this.reports = this.reports.filter(r => r.id !== report.id);
          console.log('Report deleted successfully');
        },
        error: (error) => {
          console.error('Error deleting report:', error);
        }
      });
    }
  }

  getReportTypeDisplay(type: ReportType): string {
    const typeLabels: Record<ReportType, string> = {
      [ReportType.LOCATION]: 'Por Ubicación',
      [ReportType.STATUS]: 'Por Estado',
      [ReportType.MAINTENANCE]: 'Mantenimiento',
      [ReportType.DEPRECIATION]: 'Depreciación',
      [ReportType.OBSOLETE]: 'Obsoletos',
      [ReportType.FINANCIAL]: 'Financiero'
    };
    return typeLabels[type] || type;
  }

  getStatusDisplay(status: AssetStatus): string {
    const statusLabels: Record<AssetStatus, string> = {
      [AssetStatus.ACTIVE]: 'Activo',
      [AssetStatus.INACTIVE]: 'Inactivo',
      [AssetStatus.MAINTENANCE]: 'En Mantenimiento',
      [AssetStatus.RETIRED]: 'Retirado',
      [AssetStatus.DISPOSED]: 'Desechado'
    };
    return statusLabels[status] || status;
  }

  resetForm(): void {
    this.reportsForm.reset();
    this.reportsForm.patchValue({ format: 'PDF' });
  }
}
