import { CommonModule } from '@angular/common'
import { NgModule } from '@angular/core'

import { HttpClientModule } from '@angular/common/http'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { MaterialModule } from '../../../../material/material.module'
import { UserRegisterComponent } from './register/register.component'
import { UserListComponent } from './user-list/user-list.component'
import { UserManagementComponent } from './user-management/user-management.component'
import { UsersRoutingModule } from './users.routing.module'

@NgModule({
  declarations: [UserRegisterComponent, UserListComponent, UserManagementComponent],
  imports: [
    CommonModule,
    UsersRoutingModule,
    FormsModule,
    ReactiveFormsModule,
    MaterialModule,
    HttpClientModule,
  ],
})
export class UsersModule {}
