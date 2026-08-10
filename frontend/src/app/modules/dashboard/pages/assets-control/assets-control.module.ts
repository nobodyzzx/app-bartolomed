import { CommonModule } from '@angular/common'
import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { MaterialModule } from '../../../../material/material.module'
import { SharedModule } from '../../../../shared/shared.module'

import { AssetInventoryControlComponent } from './asset-inventory-control/asset-inventory-control.component'
import { AssetTransferAuditDialogComponent } from './asset-transfers/asset-transfer-audit-dialog/asset-transfer-audit-dialog.component'
import { AssetTransfersComponent } from './asset-transfers/asset-transfers.component'
import { AssetsControlRoutingModule } from './assets-control-routing.module'
import { AssetsFormComponent } from './assets-form/assets-form.component'
import { InventoryCountsComponent } from './inventory-counts/inventory-counts.component'
import { MoveAssetDialogComponent } from './move-asset-dialog/move-asset-dialog.component'

@NgModule({
  declarations: [
    AssetsFormComponent,
    InventoryCountsComponent,
    MoveAssetDialogComponent,
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
