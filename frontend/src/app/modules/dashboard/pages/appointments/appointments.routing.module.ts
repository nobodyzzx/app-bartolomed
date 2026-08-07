import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'
import { AppointmentCalendarComponent } from './appointment-calendar.component'
import { AppointmentFormComponent } from './appointment-form.component'
import { AppointmentsPageComponent } from './index'

const routes: Routes = [
  { path: '', component: AppointmentsPageComponent },
  { path: 'list', component: AppointmentsPageComponent },
  { path: 'calendar', component: AppointmentCalendarComponent },
  { path: 'new', component: AppointmentFormComponent },
  { path: 'edit/:id', component: AppointmentFormComponent },
]

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AppointmentsRoutingModule {}
