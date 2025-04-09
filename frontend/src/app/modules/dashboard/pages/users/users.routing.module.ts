import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'
import { UserRegisterComponent } from './register/register.component'
import { UserListComponent } from './user-list/user-list.component'

const routes: Routes = [
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
  {
    path: '',
    redirectTo: 'list',
    pathMatch: 'full',
  },
]

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class UsersRoutingModule {}
