import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { UsersRoutingModule } from './users.routing.module';
import { UserRegisterComponent } from './register/register.component';
import { ReactiveFormsModule } from '@angular/forms';
import { MaterialModule } from '../../../../material/material.module';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { UserListComponent } from './user-list/user-list.component';

@NgModule({
  declarations: [UserRegisterComponent, UserListComponent],
  imports: [CommonModule, UsersRoutingModule, ReactiveFormsModule, MaterialModule, HttpClientModule],
})
export class UsersModule {}
