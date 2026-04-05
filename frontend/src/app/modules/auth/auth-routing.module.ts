import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { authGuard, guestGuard } from './guards';
import { AuthLayoutComponent } from './layouts/auth-layout/auth-layout.component';
import { LoginPageComponent } from './pages/login-page/login-page.component';
import { ResetPasswordPageComponent } from './pages/reset-password-page/reset-password-page.component';
import { SelectClinicPageComponent } from './pages/select-clinic-page/select-clinic-page.component';

const routes: Routes = [
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
  {
    path: 'select-clinic',
    component: SelectClinicPageComponent,
    canActivate: [authGuard],   // Requiere auth pero NO bloquea usuarios autenticados
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AuthRoutingModule {}
