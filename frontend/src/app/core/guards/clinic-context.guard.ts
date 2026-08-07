import { inject } from '@angular/core'
import { CanActivateFn, Router } from '@angular/router'
import { ClinicContextService } from '../../modules/clinics/services/clinic-context.service'
import { AuthService } from '../../modules/auth/services/auth.service'

/**
 * Garantiza que siempre haya un clinicId en contexto antes de entrar al dashboard.
 * Si no hay contexto → redirige al selector de clínica.
 * Si no hay usuario autenticado → el authGuard se encarga.
 */
export const clinicContextGuard: CanActivateFn = () => {
  const clinicCtx = inject(ClinicContextService)
  const authService = inject(AuthService)
  const router = inject(Router)

  if (clinicCtx.clinicId) return true

  // Sin usuario autenticado, authGuard redirige a login — no duplicar lógica
  if (!authService.currentUser()) return true

  return router.createUrlTree(['/auth/select-clinic'])
}
