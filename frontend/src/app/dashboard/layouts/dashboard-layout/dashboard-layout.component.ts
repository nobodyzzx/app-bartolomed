import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { AuthService } from '../../../auth/services/auth.service';
import { DomSanitizer } from '@angular/platform-browser';
import { MatIconRegistry } from '@angular/material/icon';

@Component({
  selector: 'app-dashboard-layout',
  templateUrl: './dashboard-layout.component.html',
  styleUrl: './dashboard-layout.component.css',
})
export class DashboardLayoutComponent implements OnInit {
  private authService = inject(AuthService);
  public user = computed(() => this.authService.currentUser());

  // get user() {
  //   return this.authService.currentUser();
  // }

  ngOnInit() {
    this.authService.checkAuthStatus().subscribe(this.user);
  }
  isExpanded = true;

  toggleSidenav() {
    this.isExpanded = !this.isExpanded;
  }

  onLogout() {
    this.authService.logout();
  }
}
