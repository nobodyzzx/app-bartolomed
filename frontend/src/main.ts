import { provideZoneChangeDetection } from '@angular/core'
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic'

import { AppModule } from './app/app.module'
import { environment } from './app/environments/environments'

function bootstrap() {
  return platformBrowserDynamic()
    .bootstrapModule(AppModule, {
      applicationProviders: [provideZoneChangeDetection({ eventCoalescing: true })],
    })
    .catch(err => console.error(err))
}

// Sin DSN configurado (dev, o prod hasta que se cree un proyecto Sentry real),
// @sentry/angular ni siquiera se descarga — import() dinámico para que quede
// en un chunk separado y no infle el bundle inicial de quienes no lo usan.
if (environment.sentryDsn) {
  import('@sentry/angular').then(Sentry => {
    Sentry.init({
      dsn: environment.sentryDsn,
      environment: environment.production ? 'production' : 'development',
    })
    bootstrap()
  })
} else {
  bootstrap()
}
