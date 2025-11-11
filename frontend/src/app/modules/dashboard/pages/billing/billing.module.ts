import { CommonModule } from '@angular/common'
import { HttpClientModule } from '@angular/common/http'
import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { RouterModule, Routes } from '@angular/router'
import { MaterialModule } from '../../../../material/material.module'
import { BillingPageComponent } from './billing.page.component'
import { InvoiceFormComponent } from './invoice-form.component'
import { PaymentFormComponent } from './payment-form.component'

const routes: Routes = [
  { path: '', component: BillingPageComponent },
  { path: 'invoices/new', component: InvoiceFormComponent },
  { path: 'invoices/:id/edit', component: InvoiceFormComponent },
  { path: 'payments/new', component: PaymentFormComponent },
  { path: 'payments/new/:invoiceId', component: PaymentFormComponent },
]

@NgModule({
  declarations: [BillingPageComponent, InvoiceFormComponent, PaymentFormComponent],
  imports: [
    CommonModule,
    RouterModule.forChild(routes),
    FormsModule,
    ReactiveFormsModule,
    MaterialModule,
    HttpClientModule,
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class BillingModule {}
