import { registerLocaleData } from '@angular/common'
import { HTTP_INTERCEPTORS, HttpClientModule } from '@angular/common/http'
import localeEsBo from '@angular/common/locales/es-BO'
import { ErrorHandler, LOCALE_ID, NgModule } from '@angular/core'
import { BrowserModule } from '@angular/platform-browser'
import { provideCharts, withDefaultRegisterables } from 'ng2-charts'

import { provideAnimationsAsync } from '@angular/platform-browser/animations/async'
import { AppRoutingModule } from './app-routing.module'
import { MatPaginatorIntl } from '@angular/material/paginator'
import { SpanishPaginatorIntl } from './core/services/paginator-intl.service'
import { AppComponent } from './app.component'
import { GlobalErrorHandler } from './core/services/global-error-handler.service'
import { MaterialModule } from './material/material.module'
import { AuthInterceptor } from './modules/auth/interceptors/auth.interceptor'
import { ClinicContextInterceptor } from './modules/clinics/interceptors/clinic-context.interceptor'
import { SharedModule } from './shared/shared.module'

// Registrar locale español (Bolivia) para fechas dd/MM/yyyy y hora 24h
registerLocaleData(localeEsBo)

@NgModule({
  declarations: [AppComponent],
  imports: [BrowserModule, AppRoutingModule, HttpClientModule, SharedModule, MaterialModule],
  providers: [
    provideAnimationsAsync(),
    provideCharts(withDefaultRegisterables()),
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
    { provide: HTTP_INTERCEPTORS, useClass: ClinicContextInterceptor, multi: true },
    { provide: LOCALE_ID, useValue: 'es-BO' },
    // `LOCALE_ID` no traduce las cadenas propias de los componentes de
    // Material: el paginador seguía en inglés en las seis pantallas que lo usan.
    { provide: MatPaginatorIntl, useClass: SpanishPaginatorIntl },
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
