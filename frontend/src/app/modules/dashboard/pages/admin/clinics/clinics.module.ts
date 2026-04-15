import { CommonModule } from '@angular/common'
import { NgModule } from '@angular/core'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'

import { ClinicsRoutingModule } from './clinics-routing.module'
import { SharedModule } from '../../../../../shared/shared.module'

import { ClinicDashboardComponent } from './clinic-dashboard/clinic-dashboard.component'
import { ClinicFormComponent } from './clinic-form/clinic-form.component'
import { ClinicListComponent } from './clinic-list/clinic-list.component'

@NgModule({
  declarations: [
    ClinicDashboardComponent,
    ClinicListComponent,
    ClinicFormComponent,
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    ClinicsRoutingModule,
    SharedModule,
  ],
})
export class ClinicsModule {}
