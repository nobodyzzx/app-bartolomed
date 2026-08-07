import { inject, Injectable, OnDestroy } from '@angular/core'
import { AlertService } from './alert.service'

const WARN_BEFORE_MS = 5 * 60 * 1000 // Avisar 5 minutos antes de expirar

@Injectable({ providedIn: 'root' })
export class SessionService implements OnDestroy {
  private alert = inject(AlertService)
  private warnTimer: ReturnType<typeof setTimeout> | null = null
  private expireTimer: ReturnType<typeof setTimeout> | null = null

  /**
   * Inicia los temporizadores de advertencia/expiración a partir del JWT.
   * Llamar tras cada login o refresh de token.
   */
  scheduleFromToken(token: string): void {
    this.clearTimers()

    const exp = this.getExpiration(token)
    if (!exp) return

    const now = Date.now()
    const msUntilExpiry = exp - now
    if (msUntilExpiry <= 0) return

    const msUntilWarn = msUntilExpiry - WARN_BEFORE_MS
    if (msUntilWarn > 0) {
      this.warnTimer = setTimeout(() => this.showWarning(), msUntilWarn)
    }

    this.expireTimer = setTimeout(() => this.showExpired(), msUntilExpiry)
  }

  clearTimers(): void {
    if (this.warnTimer) clearTimeout(this.warnTimer)
    if (this.expireTimer) clearTimeout(this.expireTimer)
    this.warnTimer = null
    this.expireTimer = null
  }

  private getExpiration(token: string): number | null {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      return typeof payload.exp === 'number' ? payload.exp * 1000 : null
    } catch {
      return null
    }
  }

  private showWarning(): void {
    this.alert.fire({
      icon: 'warning',
      title: 'Sesión por expirar',
      text: 'Tu sesión expirará en 5 minutos. Guarda tu trabajo.',
      toast: true,
      position: 'top-end',
      timer: 8000,
      showConfirmButton: false,
    })
  }

  private showExpired(): void {
    this.alert.fire({
      icon: 'error',
      title: 'Sesión expirada',
      text: 'Tu sesión ha expirado. Por favor inicia sesión nuevamente.',
      showConfirmButton: true,
      confirmButtonText: 'Ir al login',
      allowOutsideClick: false,
    })
  }

  ngOnDestroy(): void {
    this.clearTimers()
  }
}
