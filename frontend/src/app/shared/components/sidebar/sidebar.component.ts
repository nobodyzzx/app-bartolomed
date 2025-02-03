import { Component, computed, inject, OnInit } from '@angular/core';
import { AuthService } from '../../../auth/services/auth.service';
import { SidenavService } from '../services/sidenav.services';
import { UserRoles } from '../../../modules/dashboard/interfaces/userRoles.enum';

@Component({
  selector: 'shared-sidebar',
  templateUrl: './sidebar.component.html',
  styles: ``,
})
export class SidebarComponent implements OnInit {
  private authService = inject(AuthService);
  private sidenavService = inject(SidenavService);
  public user = computed(() => this.authService.currentUser());
  isExpanded = true;

  hasRole(role: UserRoles): boolean {
    return this.user()?.roles.includes(role) || false;
  }

  isAdmin(): boolean {
    return this.hasRole(UserRoles.ADMIN);
  }

  isDoctor(): boolean {
    return this.hasRole(UserRoles.USER) && (this.user()?.roles.includes('Doctor') ?? false);
  }

  ngOnInit() {
    this.authService.checkAuthStatus().subscribe(this.user);
    this.sidenavService.isExpanded$.subscribe((isExpanded) => {
      this.isExpanded = isExpanded;
    });
  }

  onLogout() {
    this.authService.logout();
  }
}
