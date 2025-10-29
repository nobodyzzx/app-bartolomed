import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MaterialModule } from '../../../../material/material.module';

import { FinancialReportsComponent } from './financial-reports/financial-reports.component';
import { MedicalReportsComponent } from './medical-reports/medical-reports.component';
import { ReportsRoutingModule } from './reports-routing.module';
import { ReportsComponent } from './reports.component';
import { StockControlComponent } from './stock-control/stock-control.component';

@NgModule({
  declarations: [
    ReportsComponent,
    MedicalReportsComponent,
    FinancialReportsComponent,
    StockControlComponent
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    MaterialModule,
    ReportsRoutingModule
  ]
})
export class ReportsModule { }
