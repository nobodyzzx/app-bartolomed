import { HTTP_INTERCEPTORS, HttpClientModule } from '@angular/common/http'
import { NgModule } from '@angular/core'
import { BrowserModule } from '@angular/platform-browser'

import { provideAnimationsAsync } from '@angular/platform-browser/animations/async'
import { AppRoutingModule } from './app-routing.module'
import { AppComponent } from './app.component'
import { MaterialModule } from './material/material.module'
import { AuthInterceptor } from './modules/auth/interceptors/auth.interceptor'
import { ClinicContextInterceptor } from './modules/clinics/interceptors/clinic-context.interceptor'
import { SharedModule } from './shared/shared.module'

@NgModule({
  declarations: [AppComponent],
  imports: [BrowserModule, AppRoutingModule, HttpClientModule, SharedModule, MaterialModule],
  providers: [
    provideAnimationsAsync(),
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
    { provide: HTTP_INTERCEPTORS, useClass: ClinicContextInterceptor, multi: true },
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
