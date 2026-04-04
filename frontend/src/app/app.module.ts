import { registerLocaleData } from '@angular/common'
import { HTTP_INTERCEPTORS, HttpClientModule } from '@angular/common/http'
import localeEsBo from '@angular/common/locales/es-BO'
import { LOCALE_ID, NgModule } from '@angular/core'
import { BrowserModule } from '@angular/platform-browser'
import { provideCharts, withDefaultRegisterables } from 'ng2-charts'

import { provideAnimationsAsync } from '@angular/platform-browser/animations/async'
import { AppRoutingModule } from './app-routing.module'
import { AppComponent } from './app.component'
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
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
