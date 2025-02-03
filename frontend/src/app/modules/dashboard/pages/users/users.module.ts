import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { UsersRoutingModule } from './users.routing.module';
import { UserRegisterComponent } from './register/register.component';
import { ReactiveFormsModule } from '@angular/forms';
import { MaterialModule } from '../../../../material/material.module';
import { HttpClient, HttpClientModule } from '@angular/common/http';

@NgModule({
  declarations: [UserRegisterComponent],
  imports: [CommonModule, UsersRoutingModule, ReactiveFormsModule, MaterialModule, HttpClientModule],
})
export class UsersModule {}
