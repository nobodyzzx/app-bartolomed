import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { MaterialModule } from '../material/material.module';
import { NavbarComponent } from './components/navbar/navbar.component';
import { DashboardRoutingModule } from '../modules/dashboard/dashboard-routing.module';

@NgModule({
  declarations: [SidebarComponent, NavbarComponent],
  imports: [CommonModule, MaterialModule, DashboardRoutingModule],
  exports: [SidebarComponent, NavbarComponent],
})
export class SharedModule {}
