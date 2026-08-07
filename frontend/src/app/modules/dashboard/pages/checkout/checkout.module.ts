import { CommonModule } from '@angular/common'
import { NgModule } from '@angular/core'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { RouterModule, Routes } from '@angular/router'
import { MaterialModule } from '../../../../material/material.module'
import { SharedModule } from '../../../../shared/shared.module'
import { CheckoutComponent } from './checkout.component'

const routes: Routes = [{ path: '', component: CheckoutComponent }]

@NgModule({
  declarations: [CheckoutComponent],
  imports: [
    CommonModule,
    RouterModule.forChild(routes),
    FormsModule,
    ReactiveFormsModule,
    MaterialModule,
    SharedModule,
  ],
})
export class CheckoutModule {}
