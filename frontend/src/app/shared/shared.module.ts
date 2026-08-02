import { CommonModule } from '@angular/common'
import { NgModule } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { RouterModule } from '@angular/router'
import { BaseChartDirective } from 'ng2-charts'
import { MaterialModule } from '../material/material.module'
import { ConfirmDialogComponent } from './components/confirm-dialog/confirm-dialog.component'
import { EmptyStateComponent } from './components/empty-state/empty-state.component'
import { NavbarComponent } from './components/navbar/navbar.component'
import { PageHeaderComponent } from './components/page-header/page-header.component'
import { SearchBarComponent } from './components/search-bar/search-bar.component'
import { SectionErrorBadgeComponent } from './components/section-error-badge/section-error-badge.component'
import { SidebarMenuItemComponent } from './components/sidebar/sidebar-menu-item/sidebar-menu-item.component'
import { SidebarComponent } from './components/sidebar/sidebar.component'
import { SkeletonTableComponent } from './components/skeleton-table/skeleton-table.component'
import { StatCardComponent } from './components/stat-card/stat-card.component'
import { StatusBadgeComponent } from './components/status-badge/status-badge.component'

@NgModule({
  declarations: [
    SidebarComponent,
    SidebarMenuItemComponent,
    NavbarComponent,
    ConfirmDialogComponent,
  ],
  imports: [
    CommonModule,
    FormsModule,
    MaterialModule,
    RouterModule,
    // Componentes standalone y directivas de terceros
    BaseChartDirective,
    StatCardComponent,
    PageHeaderComponent,
    SearchBarComponent,
    EmptyStateComponent,
    SkeletonTableComponent,
    StatusBadgeComponent,
    SectionErrorBadgeComponent,
  ],
  exports: [
    SidebarComponent,
    NavbarComponent,
    CommonModule,
    MaterialModule,
    ConfirmDialogComponent,
    // Componentes compartidos y directivas de terceros
    BaseChartDirective,
    StatCardComponent,
    PageHeaderComponent,
    SearchBarComponent,
    EmptyStateComponent,
    SkeletonTableComponent,
    StatusBadgeComponent,
    SectionErrorBadgeComponent,
  ],
})
export class SharedModule {}
