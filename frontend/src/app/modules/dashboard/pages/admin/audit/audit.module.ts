import { CommonModule } from '@angular/common'
import { HttpClientModule } from '@angular/common/http'
import { NgModule } from '@angular/core'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { MaterialModule } from '../../../../../material/material.module'
import { SharedModule } from '../../../../../shared/shared.module'
import { AuditPageComponent } from './audit.page.component'
import { AuditRoutingModule } from './audit-routing.module'

@NgModule({
  declarations: [AuditPageComponent],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MaterialModule,
    SharedModule,
    HttpClientModule,
    AuditRoutingModule,
  ],
})
export class AuditModule {}
