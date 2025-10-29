import { CommonModule, DecimalPipe } from '@angular/common';
import { CUSTOM_ELEMENTS_SCHEMA, NgModule, NO_ERRORS_SCHEMA } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';

import { MaterialModule } from '../../material/material.module';
import { SharedModule } from '../../shared/shared.module';
import { DashboardMaterialModule } from './dashboard-material.module';
import { DashboardRoutingModule } from './dashboard-routing.module';
import { DashboardLayoutComponent } from './layouts/dashboard-layout/dashboard-layout.component';
import { MainDashboardComponent } from './pages/main-dashboard/main-dashboard.component';

@NgModule({
  declarations: [DashboardLayoutComponent, MainDashboardComponent],
  imports: [
    CommonModule, 
    ReactiveFormsModule,
    DashboardMaterialModule,
    DashboardRoutingModule,
    MaterialModule,
    SharedModule
  ],
  providers: [DecimalPipe],
  schemas: [CUSTOM_ELEMENTS_SCHEMA, NO_ERRORS_SCHEMA]
})
export class DashboardModule {}
