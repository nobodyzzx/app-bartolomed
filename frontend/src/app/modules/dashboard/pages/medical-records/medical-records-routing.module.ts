import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'
import { MedicalRecordFormComponent } from './components/medical-record-form.component'
import { PatientMedicalHistoryComponent } from './components/patient-medical-history.component'
import { MedicalRecordsDashboardComponent } from './medical-records-dashboard.component'

const routes: Routes = [
  {
    path: '',
    component: MedicalRecordsDashboardComponent,
  },
  {
    path: 'patient/:patientId/history',
    component: PatientMedicalHistoryComponent,
  },
  {
    path: 'new',
    component: MedicalRecordFormComponent,
  },
  {
    path: ':id',
    component: MedicalRecordFormComponent,
  },
  {
    path: ':id/edit',
    component: MedicalRecordFormComponent,
  },
]

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class MedicalRecordsRoutingModule {}
