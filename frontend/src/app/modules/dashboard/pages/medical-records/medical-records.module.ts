import { CommonModule } from '@angular/common'
import { CUSTOM_ELEMENTS_SCHEMA, NgModule, NO_ERRORS_SCHEMA } from '@angular/core'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { MaterialModule } from '../../../../material/material.module'
import { MedicalRecordFormComponent } from './components/medical-record-form.component'
import { MedicalRecordsDashboardComponent } from './medical-records-dashboard.component'
import { MedicalRecordsRoutingModule } from './medical-records-routing.module'

@NgModule({
  declarations: [MedicalRecordsDashboardComponent, MedicalRecordFormComponent],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    MaterialModule,
    MedicalRecordsRoutingModule,
  ],
  schemas: [NO_ERRORS_SCHEMA, CUSTOM_ELEMENTS_SCHEMA],
})
export class MedicalRecordsModule {}
