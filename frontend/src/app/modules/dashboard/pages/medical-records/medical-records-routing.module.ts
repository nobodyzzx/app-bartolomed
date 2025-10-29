import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { MedicalRecordsDashboardComponent } from './medical-records-dashboard.component';
import { MedicalRecordFormComponent } from './components/medical-record-form.component';

const routes: Routes = [
  {
    path: '',
    component: MedicalRecordsDashboardComponent
  },
  {
    path: 'new',
    component: MedicalRecordFormComponent
  },
  {
    path: ':id',
    component: MedicalRecordFormComponent
  },
  {
    path: ':id/edit',
    component: MedicalRecordFormComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class MedicalRecordsRoutingModule { }
