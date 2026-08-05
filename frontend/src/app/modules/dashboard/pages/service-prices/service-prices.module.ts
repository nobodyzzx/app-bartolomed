import { CommonModule } from '@angular/common'
import { NgModule } from '@angular/core'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { RouterModule, Routes } from '@angular/router'
import { MaterialModule } from '../../../../material/material.module'
import { SharedModule } from '../../../../shared/shared.module'
import { ServicePriceFormDialogComponent } from './service-price-form-dialog/service-price-form-dialog.component'
import { ServicePricesComponent } from './service-prices.component'

const routes: Routes = [{ path: '', component: ServicePricesComponent }]

@NgModule({
  declarations: [ServicePricesComponent, ServicePriceFormDialogComponent],
  imports: [
    CommonModule,
    RouterModule.forChild(routes),
    FormsModule,
    ReactiveFormsModule,
    MaterialModule,
    SharedModule,
  ],
})
export class ServicePricesModule {}
