import { NgModule, NO_ERRORS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { MaterialModule } from '../../../../material/material.module';
import { MedicalRecordsRoutingModule } from './medical-records-routing.module';
import { MedicalRecordsDashboardComponent } from './medical-records-dashboard.component';
import { MedicalRecordFormComponent } from './components/medical-record-form.component';

@NgModule({
  declarations: [
    MedicalRecordsDashboardComponent,
    MedicalRecordFormComponent
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    MaterialModule,
    MedicalRecordsRoutingModule
  ],
  schemas: [NO_ERRORS_SCHEMA]
})
export class MedicalRecordsModule { }
