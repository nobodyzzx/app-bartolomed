// import { User } from './user.interface';

import { User } from './user.interface'

export interface LoginResponse {
  user: User
  token: string
  refreshToken?: string
  rememberMe?: boolean
  permissions?: string[]
}
