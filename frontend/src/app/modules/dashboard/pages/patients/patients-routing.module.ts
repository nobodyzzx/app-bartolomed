import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { PatientDashboardComponent } from './patient-dashboard/patient-dashboard.component';
import { PatientFormComponent } from './patient-form/patient-form.component';
import { PatientListComponent } from './patient-list/patient-list.component';

const routes: Routes = [
  {
    path: '',
    component: PatientDashboardComponent
  },
  {
    path: 'list',
    component: PatientListComponent
  },
  {
    path: 'new',
    component: PatientFormComponent
  },
  {
    path: 'edit/:id',
    component: PatientFormComponent
  },
  {
    path: 'view/:id',
    component: PatientFormComponent,
    data: { viewMode: true }
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class PatientsRoutingModule { }
