import { CommonModule } from '@angular/common'
import { HttpClientModule } from '@angular/common/http'
import { NgModule } from '@angular/core'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { MaterialModule } from '../../../../material/material.module'
import { SharedModule } from '../../../../shared/shared.module'
import { AppointmentCalendarComponent } from './appointment-calendar.component'
import { AppointmentFormComponent } from './appointment-form.component'
import { AppointmentsPageComponent } from './appointments.page.component'
import { AppointmentsRoutingModule } from './appointments.routing.module'

@NgModule({
  declarations: [AppointmentsPageComponent, AppointmentFormComponent, AppointmentCalendarComponent],
  imports: [
    CommonModule,
    AppointmentsRoutingModule,
    FormsModule,
    ReactiveFormsModule,
    MaterialModule,
    HttpClientModule,
    SharedModule,
  ],
})
export class AppointmentsModule {}
