import { Component, computed, inject, OnInit } from '@angular/core';
import { SidenavService } from '../services/sidenav.services';
import { UserRoles } from '../../../modules/dashboard/interfaces/userRoles.enum';
import { AuthService } from '../../../modules/auth/services/auth.service';

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
