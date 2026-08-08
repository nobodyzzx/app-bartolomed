import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'
import { canDeactivateGuard } from '../../../../core/guards/can-deactivate.guard'
import {
  LAB_MODULE_CONFIG,
  SPECIAL_STUDIES_MODULE_CONFIG,
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
 * Estudios especiales: ecografía, colonoscopía y electrocardiograma.
 *
 * Mismas pantallas que laboratorio (`LabOrdersSharedModule`) con otra
 * configuración: otra ruta de la API —`/api/special-studies`, que es lo que
 * impide que este módulo muestre los análisis clínicos del paciente—, otro
 * catálogo del tarifario y sin tipo de muestra.
 */
@NgModule({
  imports: [RouterModule.forChild(routes), LabOrdersSharedModule],
  providers: [{ provide: LAB_MODULE_CONFIG, useValue: SPECIAL_STUDIES_MODULE_CONFIG }],
})
export class SpecialStudiesModule {}
