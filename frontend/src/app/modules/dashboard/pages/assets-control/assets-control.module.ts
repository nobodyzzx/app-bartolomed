import { CommonModule } from '@angular/common'
import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { MaterialModule } from '../../../../material/material.module'
import { SharedModule } from '../../../../shared/shared.module'

import { AssetInventoryControlComponent } from './asset-inventory-control/asset-inventory-control.component'
import { AssetMaintenanceDetailDialogComponent } from './asset-maintenance/asset-maintenance-detail-dialog/asset-maintenance-detail-dialog.component'
import { AssetMaintenanceComponent } from './asset-maintenance/asset-maintenance.component'
import { AssetTransferAuditDialogComponent } from './asset-transfers/asset-transfer-audit-dialog/asset-transfer-audit-dialog.component'
import { AssetTransfersComponent } from './asset-transfers/asset-transfers.component'
import { AssetsControlRoutingModule } from './assets-control-routing.module'
import { AssetsFormComponent } from './assets-form/assets-form.component'

@NgModule({
  declarations: [
    AssetsFormComponent,
    AssetMaintenanceComponent,
    AssetMaintenanceDetailDialogComponent,
    AssetInventoryControlComponent,
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
