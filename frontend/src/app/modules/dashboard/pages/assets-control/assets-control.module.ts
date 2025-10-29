import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MaterialModule } from '../../../../material/material.module';

import { AssetInventoryControlComponent } from './asset-inventory-control/asset-inventory-control.component';
import { AssetMaintenanceComponent } from './asset-maintenance/asset-maintenance.component';
import { AssetRegistrationComponent } from './asset-registration/asset-registration.component';
import { AssetReportsComponent } from './asset-reports/asset-reports.component';
import { AssetsControlRoutingModule } from './assets-control-routing.module';
import { AssetsControlComponent } from './assets-control.component';

@NgModule({
  declarations: [
    AssetsControlComponent,
    AssetRegistrationComponent,
    AssetMaintenanceComponent,
    AssetInventoryControlComponent,
    AssetReportsComponent
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    MaterialModule,
    AssetsControlRoutingModule
  ]
})
export class AssetsControlModule { }
