import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'
import { UserRegisterComponent } from './register/register.component'
import { UserListComponent } from './user-list/user-list.component'
import { UserManagementComponent } from './user-management/user-management.component'

const routes: Routes = [
  {
    path: '',
    component: UserManagementComponent,
  },
  {
    path: 'management',
    component: UserManagementComponent,
  },
  {
    path: 'register',
    component: UserRegisterComponent,
  },
  {
    path: 'list',
    component: UserListComponent,
  },
  {
    path: 'edit/:id',
    component: UserRegisterComponent,
  },
]

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class UsersRoutingModule {}
