// src/auth/interfaces/login-response.interface.ts
import { User } from '../entities/user.entity';

export interface LoginResponse {
  user: User;
  token: string;
}
