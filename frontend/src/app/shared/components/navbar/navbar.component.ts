import { Component, computed, inject, OnInit } from '@angular/core';
import { AuthService } from '../../../auth/services/auth.service';
import { SidenavService } from '../services/sidenav.services';

@Component({
  selector: 'share-navbar',
  templateUrl: './navbar.component.html',
  styles: ``
})
export class NavbarComponent implements OnInit {
  private authService = inject(AuthService);
  private sidenavService = inject(SidenavService);
  public user = computed(() => this.authService.currentUser());
    
    ngOnInit() {
      this.authService.checkAuthStatus().subscribe(this.user);
    }
    isExpanded = true;
  
   toggleSidenav() {
    this.sidenavService.toggleSidenav();
  }
  
    onLogout() {
      this.authService.logout();
    }
}


