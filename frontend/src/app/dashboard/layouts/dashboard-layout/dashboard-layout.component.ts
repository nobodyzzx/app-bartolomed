import { Component, computed, inject } from '@angular/core';
import { AuthService } from '../../../auth/services/auth.service';
import { DomSanitizer } from '@angular/platform-browser';
import { MatIconRegistry } from '@angular/material/icon';

@Component({
  selector: 'app-dashboard-layout',
  templateUrl: './dashboard-layout.component.html',
  styleUrl: './dashboard-layout.component.css',
})
export class DashboardLayoutComponent {
  isExpanded = true;

  constructor(
    private matIconRegistry: MatIconRegistry,
    private domSanitizer: DomSanitizer
  ) {
    this.matIconRegistry.addSvgIcon(
      'medical-services',
      this.domSanitizer.bypassSecurityTrustResourceUrl('assets/icons/medical_services.svg')
    );
    this.matIconRegistry.addSvgIcon('pill', this.domSanitizer.bypassSecurityTrustResourceUrl('assets/icons/pill.svg'));
    this.matIconRegistry.addSvgIcon(
      'clipboard',
      this.domSanitizer.bypassSecurityTrustResourceUrl('assets/icons/clipboard.svg')
    );
    this.matIconRegistry.addSvgIcon(
      'assets',
      this.domSanitizer.bypassSecurityTrustResourceUrl('assets/icons/assets.svg')
    );
  }

  toggleSidenav() {
    this.isExpanded = !this.isExpanded;
  }
  private authService = inject(AuthService);

  public user = computed(() => this.authService.currentUser());

  // get user() {
  //   return this.authService.currentUser();
  // }
}
