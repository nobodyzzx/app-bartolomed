import { inject } from '@angular/core'
import { toObservable } from '@angular/core/rxjs-interop'
import { CanActivateFn, Router } from '@angular/router'
import { filter, map, take } from 'rxjs'
import { AuthStatus } from '../interfaces'
import { AuthService } from '../services/auth.service'

export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService)
  const router = inject(Router)

  // Si ya está resuelto, responder inmediatamente sin crear un Observable
  if (authService.authStatus() !== AuthStatus.checking) {
    if (authService.authStatus() === AuthStatus.authenticated) return true
    router.navigateByUrl('/auth/login')
    return false
  }

  // Si está en checking, esperar a que se resuelva
  return toObservable(authService.authStatus).pipe(
    filter(status => status !== AuthStatus.checking),
    take(1),
    map(status => {
      if (status === AuthStatus.authenticated) return true
      router.navigateByUrl('/auth/login')
      return false
    }),
  )
}
