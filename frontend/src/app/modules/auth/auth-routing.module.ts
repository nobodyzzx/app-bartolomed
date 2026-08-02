import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { authGuard, guestGuard } from './guards';
import { AuthLayoutComponent } from './layouts/auth-layout/auth-layout.component';
import { LoginPageComponent } from './pages/login-page/login-page.component';
import { ResetPasswordPageComponent } from './pages/reset-password-page/reset-password-page.component';
import { SelectClinicPageComponent } from './pages/select-clinic-page/select-clinic-page.component';

const routes: Routes = [
  {
    // Debe ir ANTES del path:'' de abajo: ese padre usa matching por prefijo
    // (default, necesario para que sus children resuelvan) con un '**' interno,
    // así que si va después, ese wildcard intercepta 'select-clinic' primero y
    // nunca se llega a esta ruta — guestGuard entra en vez de authGuard y, como
    // el usuario ya está autenticado, redirige a /dashboard, que redirige de
    // nuevo a /auth/select-clinic → loop infinito (bug real, visto en producción).
    path: 'select-clinic',
    component: SelectClinicPageComponent,
    canActivate: [authGuard],   // Requiere auth pero NO bloquea usuarios autenticados
  },
  {
    path: '',
    component: AuthLayoutComponent,
    canActivate: [guestGuard],   // Solo login/reset-password bloquean usuarios autenticados
    children: [
      { path: 'login', component: LoginPageComponent },
      { path: 'reset-password', component: ResetPasswordPageComponent },
      { path: '**', redirectTo: 'login' },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AuthRoutingModule {}
