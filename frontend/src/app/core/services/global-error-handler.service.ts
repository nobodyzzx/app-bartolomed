import { ErrorHandler, Injectable, NgZone } from '@angular/core'
import { environment } from '../../environments/environments'

/**
 * Captura errores no manejados (fuera de los catchError de HTTP, que ya
 * gestionan sus propios servicios). Loguea siempre a consola y, si hay un
 * DSN de Sentry configurado, también reporta la excepción allí.
 *
 * @sentry/angular se importa dinámicamente para no inflar el bundle inicial
 * cuando no hay DSN configurado (dev, o prod sin proyecto Sentry todavía).
 */
@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  constructor(private zone: NgZone) {}

  handleError(error: unknown): void {
    // console.error fuera de Angular zone para no disparar un ciclo de detección de cambios extra
    this.zone.runOutsideAngular(() => {
      console.error('[GlobalErrorHandler]', error)
    })

    if (environment.sentryDsn) {
      import('@sentry/angular').then(Sentry => Sentry.captureException(error))
    }
  }
}
