import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'
import { UserRegisterComponent } from './register/register.component'
import { UserListComponent } from './user-list/user-list.component'

const routes: Routes = [
  {
    path: '',
    component: UserListComponent,
  },
  {
    path: 'register',
    component: UserRegisterComponent,
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
