import { Component, computed, inject, OnInit } from '@angular/core';
import { AuthService } from '../../../auth/services/auth.service';
import { SidenavService } from '../services/sidenav.services';

@Component({
  selector: 'shared-sidebar',
  templateUrl: './sidebar.component.html',
  styles: ``
})
export class SidebarComponent implements OnInit {
  private authService = inject(AuthService);
  private sidenavService = inject(SidenavService);
  public user = computed(() => this.authService.currentUser());
  isExpanded = true;

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
