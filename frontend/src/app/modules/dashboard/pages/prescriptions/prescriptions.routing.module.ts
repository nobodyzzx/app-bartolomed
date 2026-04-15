import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'
import { PrescriptionsPageComponent } from './prescriptions.page.component'

const routes: Routes = [{ path: '', component: PrescriptionsPageComponent }]

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class PrescriptionsRoutingModule {}
