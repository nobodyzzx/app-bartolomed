import { Component, Inject } from '@angular/core'
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog'
import { AssetMaintenance, MaintenanceStatus, MaintenanceType } from '../../interfaces/assets.interfaces'

@Component({
    selector: 'app-asset-maintenance-detail-dialog',
    templateUrl: './asset-maintenance-detail-dialog.component.html',
    standalone: false
})
export class AssetMaintenanceDetailDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<AssetMaintenanceDetailDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public record: AssetMaintenance,
  ) {}

  getStatusClass(status: MaintenanceStatus): string {
    const classes: Record<MaintenanceStatus, string> = {
      [MaintenanceStatus.COMPLETED]: 'bg-green-100 text-green-700',
      [MaintenanceStatus.IN_PROGRESS]: 'bg-blue-100 text-blue-700',
      [MaintenanceStatus.SCHEDULED]: 'bg-amber-100 text-amber-700',
      [MaintenanceStatus.CANCELLED]: 'bg-slate-100 text-slate-700',
      [MaintenanceStatus.DELAYED]: 'bg-red-100 text-red-700',
    }
    return classes[status] || 'bg-slate-100 text-slate-700'
  }

  getStatusIcon(status: MaintenanceStatus): string {
    const icons: Record<MaintenanceStatus, string> = {
      [MaintenanceStatus.COMPLETED]: 'check_circle',
      [MaintenanceStatus.IN_PROGRESS]: 'sync',
      [MaintenanceStatus.SCHEDULED]: 'schedule',
      [MaintenanceStatus.CANCELLED]: 'cancel',
      [MaintenanceStatus.DELAYED]: 'error',
    }
    return icons[status] || 'info'
  }

  getTypeIcon(type: MaintenanceType): string {
    const icons: Record<MaintenanceType, string> = {
      [MaintenanceType.PREVENTIVE]: 'schedule',
      [MaintenanceType.CORRECTIVE]: 'build',
      [MaintenanceType.EMERGENCY]: 'emergency',
      [MaintenanceType.CALIBRATION]: 'tune',
      [MaintenanceType.INSPECTION]: 'search',
    }
    return icons[type] || 'build'
  }

  formatCurrency(amount: number | undefined): string {
    if (amount === undefined || amount === null) return 'N/A'
    return new Intl.NumberFormat('es-US', {
      style: 'currency',
      currency: 'BOB',
    }).format(amount)
  }
}
