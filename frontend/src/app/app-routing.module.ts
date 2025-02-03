import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { authGuard, guestGuard } from './modules/auth/guards';
// import { authGuard, guestGuard } from './auth/guards';

const routes: Routes = [
  {
    path: 'auth',
    canActivate: [guestGuard],
    loadChildren: () => import('./modules/auth/auth.module').then((m) => m.AuthModule),
  },
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadChildren: () => import('./modules/dashboard/dashboard.module').then((m) => m.DashboardModule),
  },
  {
    path: '**',
    redirectTo: 'auth',
  },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
