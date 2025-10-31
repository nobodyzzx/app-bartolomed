import { CommonModule } from '@angular/common'
import { HttpClientModule } from '@angular/common/http'
import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { RouterModule } from '@angular/router'

import { MaterialModule } from '../../../../material/material.module'
import { PatientDashboardComponent } from './patient-dashboard/patient-dashboard.component'
import { PatientFormComponent } from './patient-form/patient-form.component'
import { PatientListComponent } from './patient-list/patient-list.component'
import { PatientsRoutingModule } from './patients-routing.module'

@NgModule({
  declarations: [PatientFormComponent, PatientListComponent, PatientDashboardComponent],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    HttpClientModule,
    MaterialModule,
    PatientsRoutingModule,
  ],
  exports: [PatientFormComponent, PatientListComponent, PatientDashboardComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class PatientsModule {}
