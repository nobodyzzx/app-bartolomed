import { CommonModule } from '@angular/common'
import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { MaterialModule } from '../../../../material/material.module'
import { SharedModule } from '../../../../shared/shared.module'

import { AssetInventoryControlComponent } from './asset-inventory-control/asset-inventory-control.component'
import { AssetMaintenanceDetailDialogComponent } from './asset-maintenance/asset-maintenance-detail-dialog/asset-maintenance-detail-dialog.component'
import { AssetMaintenanceComponent } from './asset-maintenance/asset-maintenance.component'
import { AssetReportDetailDialogComponent } from './asset-reports/asset-report-detail-dialog/asset-report-detail-dialog.component'
import { AssetReportsComponent } from './asset-reports/asset-reports.component'
import { AssetTransferAuditDialogComponent } from './asset-transfers/asset-transfer-audit-dialog/asset-transfer-audit-dialog.component'
import { AssetTransfersComponent } from './asset-transfers/asset-transfers.component'
import { AssetsControlRoutingModule } from './assets-control-routing.module'
import { AssetsControlComponent } from './assets-control.component'
import { AssetsFormComponent } from './assets-form/assets-form.component'

@NgModule({
  declarations: [
    AssetsControlComponent,
    AssetsFormComponent,
    AssetMaintenanceComponent,
    AssetMaintenanceDetailDialogComponent,
    AssetInventoryControlComponent,
    AssetReportsComponent,
    AssetReportDetailDialogComponent,
    AssetTransfersComponent,
    AssetTransferAuditDialogComponent,
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    MaterialModule,
    AssetsControlRoutingModule,
    SharedModule,
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class AssetsControlModule {}
