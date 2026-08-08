import { CommonModule } from '@angular/common'
import { NgModule } from '@angular/core'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { RouterModule } from '@angular/router'
import { MaterialModule } from '../../../../material/material.module'
import { SharedModule } from '../../../../shared/shared.module'
import { LabOrderDetailComponent } from './lab-order-detail.component'
import { LabOrderFormComponent } from './lab-order-form.component'
import { LabOrderListComponent } from './lab-order-list.component'
import { LabOrdersService } from './lab-orders.service'

/**
 * Las tres pantallas que comparten **Laboratorio** y **Estudios Especiales**:
 * lista, formulario y detalle.
 *
 * Los componentes no saben a qué módulo sirven — lo leen de `LAB_MODULE_CONFIG`,
 * que provee cada módulo perezoso en su propio inyector. Por eso `LabOrdersService`
 * se provee **aquí y no en `root`**: así cada módulo recibe su propia instancia,
 * apuntando a su propia ruta de la API.
 *
 * Ver `2026-08-07 - Decisión - Estudios especiales comparten motor con laboratorio`.
 */
@NgModule({
  declarations: [
    LabOrderListComponent,
    LabOrderFormComponent,
    LabOrderDetailComponent,
  ],
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    ReactiveFormsModule,
    MaterialModule,
    SharedModule,
  ],
  providers: [LabOrdersService],
  exports: [
    LabOrderListComponent,
    LabOrderFormComponent,
    LabOrderDetailComponent,
  ],
})
export class LabOrdersSharedModule {}
