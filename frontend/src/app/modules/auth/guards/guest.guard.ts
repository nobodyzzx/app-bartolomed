import { inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { CanActivateFn, Router } from '@angular/router';
import { AuthStatus } from '../interfaces';
import { filter, map, take } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const guestGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.authStatus() !== AuthStatus.checking) {
    if (authService.authStatus() === AuthStatus.authenticated) {
      return router.createUrlTree(['/dashboard']);
    }
    return true;
  }

  // Esperar a que el check de auth termine antes de decidir
  return toObservable(authService.authStatus).pipe(
    filter(status => status !== AuthStatus.checking),
    take(1),
    map(status =>
      status === AuthStatus.authenticated ? router.createUrlTree(['/dashboard']) : true,
    ),
  );
};
