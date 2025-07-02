import { Component, computed, inject, OnInit, OnDestroy } from '@angular/core'
import { AuthService } from '../../../auth/services/auth.service'
import { SidenavService } from '../../../../shared/components/services/sidenav.services'
import { Subscription } from 'rxjs'

@Component({
  selector: 'app-dashboard-layout',
  templateUrl: './dashboard-layout.component.html',
  styleUrl: './dashboard-layout.component.css',
})
export class DashboardLayoutComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService)
  private sidenavService = inject(SidenavService)
  public user = computed(() => this.authService.currentUser())
  public isExpanded = true
  private subscription = new Subscription()

  ngOnInit() {
    // Verificar estado de autenticación
    this.authService.checkAuthStatus().subscribe()
    
    // Suscribirse al estado del sidenav
    this.subscription.add(
      this.sidenavService.isExpanded$.subscribe(isExpanded => {
        this.isExpanded = isExpanded
      })
    )
  }

  ngOnDestroy() {
    // Limpiar suscripciones para evitar memory leaks
    this.subscription.unsubscribe()
  }

  toggleSidenav() {
    this.sidenavService.toggleSidenav()
  }

  onLogout() {
    this.authService.logout()
  }
}
