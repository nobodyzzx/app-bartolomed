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
  // Sin variante "en blanco": PaymentFormComponent siempre cobra el saldo de
  // UNA factura puntual (llega desde "Cobrar saldo" en la lista) — la ruta
  // sin :invoiceId pedía elegir paciente/clínica a mano y tipear un UUID de
  // factura en un input de texto, campos que además nunca llegaban al
  // backend (CreatePaymentDto no los declara).
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
