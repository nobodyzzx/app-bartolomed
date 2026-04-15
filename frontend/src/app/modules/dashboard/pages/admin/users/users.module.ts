import { CommonModule } from '@angular/common'
import { NgModule } from '@angular/core'

import { HttpClientModule } from '@angular/common/http'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { MaterialModule } from '../../../../../material/material.module'
import { SharedModule } from '../../../../../shared/shared.module'
import { UserRegisterComponent } from './register/register.component'
import { UserDetailDialogComponent } from './user-detail-dialog/user-detail-dialog.component'
import { UserListComponent } from './user-list/user-list.component'
import { UsersRoutingModule } from './users.routing.module'

@NgModule({
  declarations: [UserRegisterComponent, UserListComponent, UserDetailDialogComponent],
  imports: [
    CommonModule,
    UsersRoutingModule,
    FormsModule,
    ReactiveFormsModule,
    MaterialModule,
    SharedModule,
    HttpClientModule,
  ],
})
export class UsersModule {}
