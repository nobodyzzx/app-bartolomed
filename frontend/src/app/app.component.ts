import { Component, computed, effect, inject, OnInit } from '@angular/core'
import { NavigationCancel, NavigationEnd, NavigationError, NavigationStart, Router } from '@angular/router'
import { LoadingService } from './core/services/loading.service'
import { AuthStatus } from './modules/auth/interfaces'
import { AuthService } from './modules/auth/services/auth.service'

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent implements OnInit {
  private authService = inject(AuthService)
  private router = inject(Router)
  public loading = inject(LoadingService)

  public finishedAuthCheck = computed(() => this.authService.authStatus() !== AuthStatus.checking)

  public authStatusEffect = effect(() => {
    if (this.authService.authStatus() === AuthStatus.notAuthenticated) {
      this.router.navigateByUrl('/auth/login')
    }
  })

  ngOnInit() {
    this.authService.initializeAuth().subscribe()

    // Mostrar barra de carga en cada navegación entre rutas
    this.router.events.subscribe(event => {
      if (event instanceof NavigationStart) this.loading.show()
      if (
        event instanceof NavigationEnd ||
        event instanceof NavigationCancel ||
        event instanceof NavigationError
      ) {
        this.loading.hide()
      }
    })
  }

  title = 'Bartolomed'
}
