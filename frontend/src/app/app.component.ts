import { Component, computed, effect, inject, OnInit } from '@angular/core';
import { AuthService } from './modules/auth/services/auth.service';
import { AuthStatus } from './modules/auth/interfaces';
import { Router } from '@angular/router';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent implements OnInit {
  ngOnInit() {
    window.addEventListener('unload', function (event) {
      // Cleanup code here
    });
  }

  private authService = inject(AuthService);
  private router = inject(Router);

  public finishedAuthCheck = computed<boolean>(() => {
    if (this.authService.authStatus() === AuthStatus.checking) {
      return false;
    }
    return true;
  });

  public authStatusChangedEffect = effect(() => {
    switch (this.authService.authStatus()) {
      case AuthStatus.checking:
        return;
      /* case AuthStatus.authenticated:
        this.router.navigateByUrl('/dashboard/users/register');
        return; */
      case AuthStatus.notAuthenticated:
        this.router.navigateByUrl('/auth/login');
        return;
    }
  });

  title = 'Bartolomed';
}
