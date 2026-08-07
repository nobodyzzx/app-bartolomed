// src/auth/interfaces/login-response.interface.ts
import { User } from '../../users/entities/user.entity';

export interface LoginResponse {
  user: User;
  token: string;
  refreshToken?: string;
  rememberMe?: boolean;
  permissions?: string[];
}
