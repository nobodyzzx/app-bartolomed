import { CommonModule } from '@angular/common'
import { HttpClientModule } from '@angular/common/http'
import { NgModule } from '@angular/core'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { RouterModule, Routes } from '@angular/router'
import { MaterialModule } from '../../../../material/material.module'
import { SharedModule } from '../../../../shared/shared.module'
import { PrescriptionDetailComponent } from './prescription-detail.component'
import { PrescriptionFormComponent } from './prescription-form.component'
import { PrescriptionListComponent } from './prescription-list.component'

const routes: Routes = [
  { path: '', component: PrescriptionListComponent },
  { path: 'new', component: PrescriptionFormComponent },
  { path: 'edit/:id', component: PrescriptionFormComponent },
  { path: ':id', component: PrescriptionDetailComponent },
]

@NgModule({
  declarations: [
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
    SharedModule,
  ],
})
export class PrescriptionsModule {}
