import { User } from '../../auth/interfaces/user.interface'

// DTO para crear usuario
export interface CreateUserDto {
  email: string
  password: string
  personalInfo: {
    firstName: string
    lastName: string
  }
  roles?: string[]
  clinicId?: string
}

// DTO para actualizar usuario
export interface UpdateUserDto extends Partial<Omit<CreateUserDto, 'password'>> {
  id: string
}

// DTO para respuesta de login/registro
export interface AuthResponse {
  user: User
  token: string
}
