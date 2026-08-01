import { Component, DestroyRef, Inject, OnInit, inject, signal } from '@angular/core'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog'
import { AssetTransfersService } from '../../services/asset-transfers.service'
import { AssetTransfer, AssetTransferAuditLog, AssetTransferStatus } from '../../interfaces/assets.interfaces'

@Component({
    selector: 'app-asset-transfer-audit-dialog',
    templateUrl: './asset-transfer-audit-dialog.component.html',
    standalone: false
})
export class AssetTransferAuditDialogComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef)

  loading = signal(true)
  auditLogs = signal<AssetTransferAuditLog[]>([])

  constructor(
    public dialogRef: MatDialogRef<AssetTransferAuditDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public transfer: AssetTransfer,
    private transfersService: AssetTransfersService,
  ) {}

  ngOnInit(): void {
    this.transfersService
      .getAuditLog(this.transfer.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: logs => {
          this.auditLogs.set(logs)
          this.loading.set(false)
        },
        error: () => this.loading.set(false),
      })
  }

  getStatusIcon(status: string): string {
    const map: Record<string, string> = {
      [AssetTransferStatus.REQUESTED]: 'schedule',
      [AssetTransferStatus.IN_TRANSIT]: 'local_shipping',
      [AssetTransferStatus.COMPLETED]: 'check_circle',
      [AssetTransferStatus.REJECTED]: 'cancel',
      [AssetTransferStatus.RETURNED]: 'undo',
    }
    return map[status] ?? 'info'
  }

  getAuditActionLabel(action: string): string {
    const map: Record<string, string> = {
      requested: 'Solicitud creada',
      dispatched: 'Activos despachados',
      completed: 'Recepción confirmada',
      rejected: 'Solicitud rechazada',
      returned: 'Activos devueltos',
    }
    return map[action] ?? action
  }
}
