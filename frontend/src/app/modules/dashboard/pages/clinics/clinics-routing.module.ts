import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ClinicDashboardComponent } from './clinic-dashboard/clinic-dashboard.component';
import { ClinicFormComponent } from './clinic-form/clinic-form.component';
import { ClinicListComponent } from './clinic-list/clinic-list.component';

const routes: Routes = [
  {
    path: '',
    component: ClinicDashboardComponent
  },
  {
    path: 'list',
    component: ClinicListComponent
  },
  {
    path: 'new',
    component: ClinicFormComponent
  },
  {
    path: 'edit/:id',
    component: ClinicFormComponent
  },
  {
    path: 'view/:id',
    component: ClinicFormComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ClinicsRoutingModule { }
