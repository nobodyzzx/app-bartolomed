import { CommonModule } from '@angular/common'
import { NgModule } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { RouterModule } from '@angular/router'
import { MaterialModule } from '../material/material.module'
import { NavbarComponent } from './components/navbar/navbar.component'
import { PlaceholderComponent } from './components/placeholder/placeholder.component'
import { RoleSimulatorDialogComponent } from './components/role-simulator-dialog/role-simulator-dialog.component'
import { SidebarComponent } from './components/sidebar/sidebar.component'
import { PhoneMaskDirective } from './directives/phone-mask.directive'

@NgModule({
  declarations: [
    SidebarComponent,
    NavbarComponent,
    PlaceholderComponent,
    RoleSimulatorDialogComponent,
    PhoneMaskDirective,
  ],
  imports: [CommonModule, FormsModule, MaterialModule, RouterModule],
  exports: [
    SidebarComponent,
    NavbarComponent,
    PlaceholderComponent,
    CommonModule,
    MaterialModule,
    PhoneMaskDirective,
  ],
})
export class SharedModule {}
