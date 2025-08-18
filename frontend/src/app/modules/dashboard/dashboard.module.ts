import { NgModule, NO_ERRORS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';

import { DashboardRoutingModule } from './dashboard-routing.module';
import { DashboardLayoutComponent } from './layouts/dashboard-layout/dashboard-layout.component';
import { MainDashboardComponent } from './pages/main-dashboard/main-dashboard.component';
import { MaterialModule } from '../../material/material.module';
import { SharedModule } from '../../shared/shared.module';

@NgModule({
  declarations: [DashboardLayoutComponent, MainDashboardComponent],
  imports: [
    CommonModule, 
    ReactiveFormsModule,
    DashboardRoutingModule, 
    MaterialModule, 
    SharedModule
  ],
  schemas: [NO_ERRORS_SCHEMA]
})
export class DashboardModule {}
