import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { NavbarComponent } from './components/navbar/navbar.component';
import { PlaceholderComponent } from './components/placeholder/placeholder.component';
import { MaterialModule } from '../material/material.module';

@NgModule({
  declarations: [SidebarComponent, NavbarComponent, PlaceholderComponent],
  imports: [CommonModule, MaterialModule, RouterModule],
  exports: [
    SidebarComponent, 
    NavbarComponent, 
    PlaceholderComponent,
    CommonModule,
    MaterialModule
  ],
})
export class SharedModule {}
