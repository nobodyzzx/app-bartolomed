import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'
import { canDeactivateGuard } from '../../../../core/guards/can-deactivate.guard'
import { Permission } from '@core/enums/permission.enum'
import { permissionsGuard } from '@core/guards/permissions.guard'
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
    // Crear expediente: NURSE tiene RecordsRead (entra al módulo) pero el
    // backend solo permite escribir a DOCTOR/ADMIN — sin este guard llegaba
    // al formulario completo y recién se enteraba al guardar (403).
    path: 'new',
    component: MedicalRecordFormComponent,
    canActivate: [permissionsGuard],
    data: { requiredPermissions: [Permission.RecordsWrite] },
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
    canActivate: [permissionsGuard],
    data: { requiredPermissions: [Permission.RecordsWrite] },
    canDeactivate: [canDeactivateGuard],
  },
]

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class MedicalRecordsRoutingModule {}
