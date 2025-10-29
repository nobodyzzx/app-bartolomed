import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { MaterialModule } from '../../../../material/material.module';
import { AppointmentFormComponent } from './appointment-form.component';

@NgModule({
  declarations: [
    AppointmentFormComponent
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    MaterialModule
  ],
  exports: [
    AppointmentFormComponent
  ]
})
export class AppointmentsModule { }
