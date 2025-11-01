import { CommonModule } from '@angular/common'
import { HttpClientModule } from '@angular/common/http'
import { NgModule } from '@angular/core'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { RouterModule, Routes } from '@angular/router'
import { MaterialModule } from '../../../../material/material.module'
import { AuditPageComponent } from './audit.page.component'

const routes: Routes = [{ path: '', component: AuditPageComponent }]

@NgModule({
  declarations: [AuditPageComponent],
  imports: [
    CommonModule,
    RouterModule.forChild(routes),
    FormsModule,
    ReactiveFormsModule,
    MaterialModule,
    HttpClientModule,
  ],
})
export class AuditModule {}
