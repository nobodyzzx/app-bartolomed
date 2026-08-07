import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { BaseChartDirective } from 'ng2-charts';
import { MaterialModule } from '../../../../material/material.module';
import { SharedModule } from '../../../../shared/shared.module';

import { ReportsRoutingModule } from './reports-routing.module';
import { ReportsComponent } from './reports.component';

@NgModule({
  declarations: [ReportsComponent],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    MaterialModule,
    SharedModule,
    BaseChartDirective,
    ReportsRoutingModule,
  ],
})
export class ReportsModule { }
