import { Component, Inject } from '@angular/core'
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog'
import {
  AssetReport,
  reportFileExtension,
  ReportStatus,
  ReportType,
} from '../../interfaces/assets.interfaces'

@Component({
    selector: 'app-asset-report-detail-dialog',
    templateUrl: './asset-report-detail-dialog.component.html',
    standalone: false
})
export class AssetReportDetailDialogComponent {
  readonly ReportStatus = ReportStatus
  readonly reportFileExtension = reportFileExtension

  constructor(
    public dialogRef: MatDialogRef<AssetReportDetailDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public report: AssetReport,
  ) {}

  getReportTypeDisplay(type: ReportType): string {
    const typeLabels: Record<ReportType, string> = {
      [ReportType.LOCATION]: 'Por Ubicación',
      [ReportType.STATUS]: 'Por Estado',
      [ReportType.MAINTENANCE]: 'Mantenimiento',
      [ReportType.DEPRECIATION]: 'Depreciación',
      [ReportType.OBSOLETE]: 'Obsoletos',
      [ReportType.FINANCIAL]: 'Financiero',
    }
    return typeLabels[type] || type
  }

  getStatusClass(status: ReportStatus): string {
    const classes: Record<ReportStatus, string> = {
      [ReportStatus.COMPLETED]: 'bg-green-100 text-green-700',
      [ReportStatus.GENERATING]: 'bg-blue-100 text-blue-700',
      [ReportStatus.PENDING]: 'bg-amber-100 text-amber-700',
      [ReportStatus.FAILED]: 'bg-red-100 text-red-700',
    }
    return classes[status] || 'bg-slate-100 text-slate-700'
  }

  getStatusIcon(status: ReportStatus): string {
    const icons: Record<ReportStatus, string> = {
      [ReportStatus.COMPLETED]: 'check_circle',
      [ReportStatus.GENERATING]: 'sync',
      [ReportStatus.PENDING]: 'schedule',
      [ReportStatus.FAILED]: 'error',
    }
    return icons[status] || 'info'
  }
}
