import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { MaterialModule } from '../../../../material/material.module';
import { PatientFormComponent } from './patient-form/patient-form.component';
import { PatientListComponent } from './patient-list/patient-list.component';
import { PatientDashboardComponent } from './patient-dashboard/patient-dashboard.component';
import { PatientsRoutingModule } from './patients-routing.module';

@NgModule({
  declarations: [
    PatientFormComponent,
    PatientListComponent,
    PatientDashboardComponent
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    MaterialModule,
    PatientsRoutingModule
  ],
  exports: [
    PatientFormComponent,
    PatientListComponent,
    PatientDashboardComponent
  ]
})
export class PatientsModule { }
