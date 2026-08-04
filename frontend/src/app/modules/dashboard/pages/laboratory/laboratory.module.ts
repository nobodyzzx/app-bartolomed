import { CommonModule } from '@angular/common'
import { HttpClientModule } from '@angular/common/http'
import { NgModule } from '@angular/core'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { RouterModule, Routes } from '@angular/router'
import { canDeactivateGuard } from '../../../../core/guards/can-deactivate.guard'
import { MaterialModule } from '../../../../material/material.module'
import { SharedModule } from '../../../../shared/shared.module'
import { LabOrderDetailComponent } from './lab-order-detail.component'
import { LabOrderFormComponent } from './lab-order-form.component'
import { LabOrderListComponent } from './lab-order-list.component'

const routes: Routes = [
  { path: '', component: LabOrderListComponent },
  { path: 'new', component: LabOrderFormComponent, canDeactivate: [canDeactivateGuard] },
  { path: ':id', component: LabOrderDetailComponent },
]

@NgModule({
  declarations: [
    LabOrderListComponent,
    LabOrderFormComponent,
    LabOrderDetailComponent,
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
export class LaboratoryModule {}
