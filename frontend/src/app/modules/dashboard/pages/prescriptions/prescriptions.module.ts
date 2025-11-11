import { CommonModule } from '@angular/common'
import { HttpClientModule } from '@angular/common/http'
import { NgModule } from '@angular/core'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { RouterModule, Routes } from '@angular/router'
import { MaterialModule } from '../../../../material/material.module'
import { PrescriptionDetailComponent } from './prescription-detail.component'
import { PrescriptionFormComponent } from './prescription-form.component'
import { PrescriptionListComponent } from './prescription-list.component'
import { PrescriptionsPageComponent } from './prescriptions.page.component'

const routes: Routes = [
  { path: '', component: PrescriptionsPageComponent },
  { path: 'list', component: PrescriptionListComponent },
  { path: 'new', component: PrescriptionFormComponent },
  { path: 'edit/:id', component: PrescriptionFormComponent },
  { path: ':id', component: PrescriptionDetailComponent },
]

@NgModule({
  declarations: [
    PrescriptionsPageComponent,
    PrescriptionListComponent,
    PrescriptionFormComponent,
    PrescriptionDetailComponent,
  ],
  imports: [
    CommonModule,
    RouterModule.forChild(routes),
    FormsModule,
    ReactiveFormsModule,
    MaterialModule,
    HttpClientModule,
  ],
})
export class PrescriptionsModule {}
