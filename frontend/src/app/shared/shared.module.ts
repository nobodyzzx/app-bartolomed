import { CommonModule } from '@angular/common'
import { NgModule } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { RouterModule } from '@angular/router'
import { MaterialModule } from '../material/material.module'
import { ConfirmDialogComponent } from './components/confirm-dialog/confirm-dialog.component'
import { EmptyStateComponent } from './components/empty-state/empty-state.component'
import { NavbarComponent } from './components/navbar/navbar.component'
import { PageHeaderComponent } from './components/page-header/page-header.component'
import { PlaceholderComponent } from './components/placeholder/placeholder.component'
import { SearchBarComponent } from './components/search-bar/search-bar.component'
import { SidebarMenuItemComponent } from './components/sidebar/sidebar-menu-item/sidebar-menu-item.component'
import { SidebarComponent } from './components/sidebar/sidebar.component'
import { SkeletonTableComponent } from './components/skeleton-table/skeleton-table.component'
import { StatCardComponent } from './components/stat-card/stat-card.component'
import { StatusBadgeComponent } from './components/status-badge/status-badge.component'
import { PhoneMaskDirective } from './directives/phone-mask.directive'

@NgModule({
  declarations: [
    SidebarComponent,
    SidebarMenuItemComponent,
    NavbarComponent,
    PlaceholderComponent,
    PhoneMaskDirective,
    ConfirmDialogComponent,
  ],
  imports: [
    CommonModule,
    FormsModule,
    MaterialModule,
    RouterModule,
    // Componentes standalone
    StatCardComponent,
    PageHeaderComponent,
    SearchBarComponent,
    EmptyStateComponent,
    SkeletonTableComponent,
    StatusBadgeComponent,
  ],
  exports: [
    SidebarComponent,
    NavbarComponent,
    PlaceholderComponent,
    CommonModule,
    MaterialModule,
    PhoneMaskDirective,
    ConfirmDialogComponent,
    // Componentes compartidos (disponibles para todos los módulos que importen SharedModule)
    StatCardComponent,
    PageHeaderComponent,
    SearchBarComponent,
    EmptyStateComponent,
    SkeletonTableComponent,
    StatusBadgeComponent,
  ],
})
export class SharedModule {}
