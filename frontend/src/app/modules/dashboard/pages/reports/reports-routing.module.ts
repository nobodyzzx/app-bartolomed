import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { FinancialReportsComponent } from './financial-reports/financial-reports.component';
import { MedicalReportsComponent } from './medical-reports/medical-reports.component';
import { ReportsComponent } from './reports.component';
import { StockControlComponent } from './stock-control/stock-control.component';

const routes: Routes = [
  {
    path: '',
    component: ReportsComponent,
    children: [
      {
        path: '',
        redirectTo: 'medical-reports',
        pathMatch: 'full'
      },
      {
        path: 'medical-reports',
        component: MedicalReportsComponent,
        data: { title: 'Reportes Médicos' }
      },
      {
        path: 'financial-reports',
        component: FinancialReportsComponent,
        data: { title: 'Reportes Financieros' }
      },
      {
        path: 'stock-control',
        component: StockControlComponent,
        data: { title: 'Control de Stock' }
      }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ReportsRoutingModule { }
