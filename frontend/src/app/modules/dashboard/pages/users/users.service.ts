import { HttpClient, HttpHeaders } from '@angular/common/http'
import { computed, inject, Injectable, signal } from '@angular/core'
import { catchError, Observable, of, tap, throwError } from 'rxjs'
import { environment } from '../../../../environments/environments'
import { ErrorService } from '../../../../shared/components/services/error.service'
import { User } from '../../../auth/interfaces/user.interface'
import { AuthService } from '../../../auth/services/auth.service'
import { CreateUserDto, UpdateUserDto } from '../../interfaces/user.dto'

@Injectable({
  providedIn: 'root',
})
export class UsersService {
  private readonly baseUrl = environment.baseUrl
  private http = inject(HttpClient)
  private authService = inject(AuthService)
  private errorService = inject(ErrorService)

  //Signals

  private users = signal<User[]>([])
  public currentUsers = computed(() => this.users())

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token')
    return new HttpHeaders().set('Authorization', `Bearer ${token}`)
  }

  get authHeaders(): HttpHeaders {
    return new HttpHeaders().set('Authorization', `Bearer ${localStorage.getItem('token')}`)
  }

  getUsers(): Observable<User[]> {
    const headers = this.getHeaders()
    return this.http.get<User[]>(`${this.baseUrl}/users`, { headers }).pipe(
      tap(users => this.users.set(users)),
      catchError(error => {
        console.warn('Backend no disponible, usando datos de prueba')
        // Datos de prueba cuando el backend no está disponible
        const mockUsers: User[] = [
          {
            id: '1',
            email: 'admin@bartolomed.com',
            roles: ['admin'],
            isActive: true,
            startDate: new Date('2024-01-15'),
            personalInfo: {
              firstName: 'Juan Carlos',
              lastName: 'Administrador',
              phone: '+1234567890'
            },
            professionalInfo: {
              specialization: 'Administración',
              title: 'Administrador General',
              role: 'Administrador',
              license: 'LIC123456',
              certifications: ['Gestión Hospitalaria', 'Administración de Salud'],
              areas: ['Administración', 'Gestión'],
              description: 'Administrador principal del sistema'
            }
          },
          {
            id: '2',
            email: 'dr.garcia@bartolomed.com',
            roles: ['doctor'],
            isActive: true,
            startDate: new Date('2024-02-01'),
            personalInfo: {
              firstName: 'María Elena',
              lastName: 'García',
              phone: '+591-70111222'
            },
            professionalInfo: {
              specialization: 'Medicina General',
              title: 'Doctora',
              role: 'Médico General',
              license: 'MED789012',
              certifications: ['Medicina Interna', 'Primeros Auxilios'],
              areas: ['Consulta General', 'Medicina Preventiva'],
              description: 'Médico general con especialización en medicina familiar'
            }
          },
          {
            id: '3',
            email: 'dr.martinez@bartolomed.com',
            roles: ['doctor'],
            isActive: true,
            startDate: new Date('2024-01-20'),
            personalInfo: {
              firstName: 'Carlos Alberto',
              lastName: 'Martínez',
              phone: '+591-70333444'
            },
            professionalInfo: {
              specialization: 'Cardiología',
              title: 'Doctor',
              role: 'Cardiólogo',
              license: 'MED456789',
              certifications: ['Cardiología Clínica', 'Ecocardiografía'],
              areas: ['Cardiología', 'Medicina Interna'],
              description: 'Especialista en enfermedades cardiovasculares'
            }
          },
          {
            id: '4',
            email: 'dra.lopez@bartolomed.com',
            roles: ['doctor'],
            isActive: true,
            startDate: new Date('2024-02-15'),
            personalInfo: {
              firstName: 'Patricia',
              lastName: 'López',
              phone: '+591-70555666'
            },
            professionalInfo: {
              specialization: 'Pediatría',
              title: 'Doctora',
              role: 'Pediatra',
              license: 'MED321654',
              certifications: ['Pediatría General', 'Neonatología'],
              areas: ['Pediatría', 'Medicina Infantil'],
              description: 'Especialista en salud infantil y adolescente'
            }
          },
          {
            id: '5',
            email: 'dr.vargas@bartolomed.com',
            roles: ['doctor'],
            isActive: true,
            startDate: new Date('2024-03-01'),
            personalInfo: {
              firstName: 'Roberto',
              lastName: 'Vargas',
              phone: '+591-70777888'
            },
            professionalInfo: {
              specialization: 'Cirugía General',
              title: 'Doctor',
              role: 'Cirujano',
              license: 'MED987654',
              certifications: ['Cirugía General', 'Laparoscopía'],
              areas: ['Cirugía', 'Emergencias'],
              description: 'Cirujano general con experiencia en cirugía mínimamente invasiva'
            }
          },
          {
            id: '6',
            email: 'enfermera@bartolomed.com',
            roles: ['nurse'],
            isActive: true,
            startDate: new Date('2024-03-10'),
            personalInfo: {
              firstName: 'Ana Sofía',
              lastName: 'Rodríguez',
              phone: '+1234567892'
            },
            professionalInfo: {
              specialization: 'Enfermería General',
              title: 'Licenciada en Enfermería',
              role: 'Enfermera',
              license: 'ENF345678',
              certifications: ['Enfermería Clínica', 'Cuidados Intensivos'],
              areas: ['Enfermería General', 'Cuidados Postoperatorios'],
              description: 'Enfermera profesional con experiencia en cuidados generales'
            }
          }
        ]
        this.users.set(mockUsers)
        return of(mockUsers)
      }),
    )
  }

  getUserById(id: string): Observable<User> {
    const headers = this.getHeaders()
    return this.http.get<User>(`${this.baseUrl}/users/${id}`, { headers }).pipe(
      catchError(error => {
        this.errorService.handleError(error)
        throw error
      }),
    )
  }

  createUser(userData: CreateUserDto): Observable<User> {
    const headers = this.getHeaders()
    return this.http.post<User>(`${this.baseUrl}/users/create`, userData, { headers }).pipe(
      tap(newUser => {
        this.users.update(current => [...current, newUser])
      }),
      catchError(error => {
        this.errorService.handleError(error)
        throw error
      }),
    )
  }

  updateUser(userData: UpdateUserDto): Observable<User> {
    const headers = this.getHeaders()
    return this.http
      .patch<User>(`${this.baseUrl}/users/${userData.id}`, userData, { headers })
      .pipe(
        tap(updatedUser => {
          this.users.update(current =>
            current.map(user => (user.id === updatedUser.id ? updatedUser : user)),
          )
        }),
        catchError(error => {
          this.errorService.handleError(error)
          throw error
        }),
      )
  }

  deleteUser(id: string): Observable<void> {
    const headers = this.getHeaders()
    return this.http.delete<void>(`${this.baseUrl}/users/${id}`, { headers }).pipe(
      tap(() => {
        this.users.update(current => current.filter(user => user.id !== id))
      }),
      catchError(error => {
        this.errorService.handleError(error)
        throw error
      }),
    )
  }
  findAll(): Observable<User[]> {
    return this.http
      .get<User[]>(`${this.baseUrl}/users`, {
        headers: this.authHeaders,
      })
      .pipe(
        tap(users => this.users.set(users)),
        catchError(error => {
          console.warn('Backend no disponible, usando datos de prueba en findAll')
          // Usar los mismos datos de prueba
          const mockUsers: User[] = [
            {
              id: '1',
              email: 'admin@bartolomed.com',
              roles: ['admin'],
              isActive: true,
              startDate: new Date('2024-01-15'),
              personalInfo: {
                firstName: 'Juan Carlos',
                lastName: 'Administrador',
                phone: '+1234567890'
              },
              professionalInfo: {
                specialization: 'Administración',
                title: 'Administrador General',
                role: 'Administrador',
                license: 'LIC123456'
              }
            },
            {
              id: '2',
              email: 'doctor@bartolomed.com',
              roles: ['user'],
              isActive: true,
              startDate: new Date('2024-02-01'),
              personalInfo: {
                firstName: 'María Elena',
                lastName: 'García',
                phone: '+1234567891'
              },
              professionalInfo: {
                specialization: 'Medicina General',
                title: 'Doctora',
                role: 'Médico General',
                license: 'MED789012'
              }
            },
            {
              id: '3',
              email: 'enfermera@bartolomed.com',
              roles: ['nurse'],
              isActive: true,
              startDate: new Date('2024-03-10'),
              personalInfo: {
                firstName: 'Ana Sofía',
                lastName: 'Rodríguez',
                phone: '+1234567892'
              },
              professionalInfo: {
                specialization: 'Enfermería General',
                title: 'Licenciada en Enfermería',
                role: 'Enfermera',
                license: 'ENF345678'
              }
            }
          ]
          this.users.set(mockUsers)
          return of(mockUsers)
        }),
      )
  }

  findOne(id: string): Observable<User> {
    return this.http
      .get<User>(`${this.baseUrl}/users/${id}`, {
        headers: this.authHeaders,
      })
      .pipe(
        catchError(error => {
          this.errorService.handleError(error)
          return throwError(() => error)
        }),
      )
  }

  updateUserStatus(userId: string, isActive: boolean): Observable<void> {
    return this.http.patch<void>(`${this.baseUrl}/users/${userId}/status`, { isActive })
  }

  /* createUser(userData: any): Observable<any> {
    const headers = this.getHeaders();
    return this.http.post(`${this.baseUrl}/users/create`, userData, { headers }).pipe(
      map(response => response),
      catchError(error => throwError(() => error.error.message))
    );
  } */

  /* createUser(userData: any): Observable<any> {
      const headers = this.getHeaders();
      
      return this.http.post(`${this.baseUrl}/users/create`, userData, { headers })
        .pipe(
          tap(response => console.log('Usuario creado:', response)),
          catchError(error => {
            console.error('Error en createUser:', error);
            return throwError(() => ({
              status: error.status,
              error: error.error,
              message: error.error?.message
            }));
          })
        );
    }
  getUsers(): Observable<any> {
    const headers = this.getHeaders();
    return this.http.get(`${this.baseUrl}/users`, { headers }).pipe(
      map(response => response),
      catchError(error => throwError(() => error.error.message))
    );
  } */
}
