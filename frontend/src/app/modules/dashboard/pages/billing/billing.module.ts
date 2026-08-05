import { CommonModule } from '@angular/common'
import { HttpClientModule } from '@angular/common/http'
import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { RouterModule, Routes } from '@angular/router'
import { MaterialModule } from '../../../../material/material.module'
import { SharedModule } from '../../../../shared/shared.module'
import { BillingPageComponent } from './billing.page.component'
import { PaymentFormComponent } from './payment-form.component'

const routes: Routes = [
  { path: '', component: BillingPageComponent },
  { path: 'payments/new', component: PaymentFormComponent },
  { path: 'payments/new/:invoiceId', component: PaymentFormComponent },
]

@NgModule({
  declarations: [BillingPageComponent, PaymentFormComponent],
  imports: [
    CommonModule,
    RouterModule.forChild(routes),
    FormsModule,
    ReactiveFormsModule,
    MaterialModule,
    HttpClientModule,
    SharedModule,
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class BillingModule {}
