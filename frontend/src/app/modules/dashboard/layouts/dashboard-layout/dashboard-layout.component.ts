import { Component, inject, OnInit } from '@angular/core'
import { AuthService } from '../../../auth/services/auth.service'
import { SidenavService } from '../../../../shared/components/services/sidenav.service'

@Component({
    selector: 'app-dashboard-layout',
    templateUrl: './dashboard-layout.component.html',
    styleUrl: './dashboard-layout.component.css',
    standalone: false
})
export class DashboardLayoutComponent implements OnInit {
  private authService = inject(AuthService)
  private sidenavService = inject(SidenavService)

  public isExpanded = this.sidenavService.isExpanded

  ngOnInit() {
    this.authService.checkAuthStatus().subscribe()
  }

  closeSidebar() {
    this.sidenavService.setExpanded(false)
  }
}
