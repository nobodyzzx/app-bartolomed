import { CommonModule } from '@angular/common'
import { HttpClientModule } from '@angular/common/http'
import { NgModule } from '@angular/core'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { RouterModule, Routes } from '@angular/router'
import { MaterialModule } from '../../../../../material/material.module'
import { SharedModule } from '../../../../../shared/shared.module'
import { BackupPageComponent } from './backup.page.component'

const routes: Routes = [{ path: '', component: BackupPageComponent }]

@NgModule({
  declarations: [BackupPageComponent],
  imports: [
    CommonModule,
    RouterModule.forChild(routes),
    FormsModule,
    ReactiveFormsModule,
    MaterialModule,
    SharedModule,
    HttpClientModule,
  ],
})
export class BackupModule {}
