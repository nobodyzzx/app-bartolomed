import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'
import { canDeactivateGuard } from '../../../../core/guards/can-deactivate.guard'
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
    canDeactivate: [canDeactivateGuard],
  },
  {
    path: ':id',
    component: MedicalRecordFormComponent,
    canDeactivate: [canDeactivateGuard],
  },
  {
    path: ':id/edit',
    component: MedicalRecordFormComponent,
    canDeactivate: [canDeactivateGuard],
  },
]

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class MedicalRecordsRoutingModule {}
