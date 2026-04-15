import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { AuthRoutingModule } from './auth-routing.module';
import { MaterialModule } from '../../material/material.module';
import { AuthLayoutComponent } from './layouts/auth-layout/auth-layout.component';
import { ForgotPasswordDialogComponent } from './pages/forgot-password-dialog/forgot-password-dialog.component';
import { LoginPageComponent } from './pages/login-page/login-page.component';
import { ResetPasswordPageComponent } from './pages/reset-password-page/reset-password-page.component';
import { SelectClinicPageComponent } from './pages/select-clinic-page/select-clinic-page.component';

@NgModule({
  declarations: [
    LoginPageComponent,
    AuthLayoutComponent,
    ForgotPasswordDialogComponent,
    ResetPasswordPageComponent,
    SelectClinicPageComponent,
  ],
  imports: [CommonModule, AuthRoutingModule, ReactiveFormsModule, MaterialModule, RouterModule],
})
export class AuthModule {}
