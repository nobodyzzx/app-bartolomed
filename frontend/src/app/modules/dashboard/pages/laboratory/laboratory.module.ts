import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'
import { canDeactivateGuard } from '../../../../core/guards/can-deactivate.guard'
import {
  LAB_MODULE_CONFIG,
  LABORATORY_MODULE_CONFIG,
} from '../lab-orders/lab-module.config'
import { LabOrdersSharedModule } from '../lab-orders/lab-orders-shared.module'
import { LabOrderDetailComponent } from '../lab-orders/lab-order-detail.component'
import { LabOrderFormComponent } from '../lab-orders/lab-order-form.component'
import { LabOrderListComponent } from '../lab-orders/lab-order-list.component'

const routes: Routes = [
  { path: '', component: LabOrderListComponent },
  { path: 'new', component: LabOrderFormComponent, canDeactivate: [canDeactivateGuard] },
  { path: ':id', component: LabOrderDetailComponent },
]

/**
 * Laboratorio clínico. Las pantallas viven en `LabOrdersSharedModule`; aquí
 * solo se declaran las rutas y la configuración que las particulariza.
 */
@NgModule({
  imports: [RouterModule.forChild(routes), LabOrdersSharedModule],
  providers: [{ provide: LAB_MODULE_CONFIG, useValue: LABORATORY_MODULE_CONFIG }],
})
export class LaboratoryModule {}
