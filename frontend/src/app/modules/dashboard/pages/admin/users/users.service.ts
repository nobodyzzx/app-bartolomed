import { computed, inject, Injectable, signal } from '@angular/core'
import { HttpClient, HttpParams } from '@angular/common/http'
import { catchError, Observable, tap, throwError } from 'rxjs'
import { environment } from '../../../../../environments/environments'
import { ErrorService } from '../../../../../shared/components/services/error.service'
import { User } from '../../../../auth/interfaces/user.interface'
import { CreateUserDto, UpdateUserDto } from '../../../interfaces/user.dto'

export interface PaginatedResult<T> {
  data: T[]
  total: number
  limit: number
  offset: number
}

/** Lo mínimo para un desplegable y para firmar: sin email ni datos de cuenta. */
export interface ClinicalStaffMember {
  id: string
  roles: string[]
  personalInfo: { firstName: string; lastName: string }
  professionalInfo: { title: string; role: string | null; specialization: string }
}

export interface UpdateUserStatusResponse {
  pendingWork?: {
    appointments: number
    prescriptions: number
    labOrders: number
  }
}

@Injectable({
  providedIn: 'root',
})
export class UsersService {
  private readonly baseUrl = environment.baseUrl
  private http = inject(HttpClient)
  private errorService = inject(ErrorService)

  private users = signal<User[]>([])
  public currentUsers = computed(() => this.users())

  /**
   * Personal clínico de la clínica activa, para poblar desplegables de "médico
   * solicitante" en laboratorio, recetas y fichas médicas. Va aparte de
   * `getUsers()` porque aquel exige ADMIN: pedirlo desde esos formularios les
   * devolvía 403 a los médicos, que son justo quienes los usan.
   */
  getClinicalStaff(): Observable<ClinicalStaffMember[]> {
    return this.http.get<ClinicalStaffMember[]>(`${this.baseUrl}/users/clinical-staff`).pipe(
      catchError(error => {
        this.errorService.handleError(error)
        return throwError(() => error)
      }),
    )
  }

  getUsers(limit = 25, offset = 0): Observable<PaginatedResult<User>> {
    const params = new HttpParams().set('limit', limit.toString()).set('offset', offset.toString())
    return this.http.get<PaginatedResult<User>>(`${this.baseUrl}/users`, { params }).pipe(
      tap(result => this.users.set(result.data)),
      catchError(error => {
        this.errorService.handleError(error)
        return throwError(() => error)
      }),
    )
  }

  getUserById(id: string): Observable<User> {
    return this.http.get<User>(`${this.baseUrl}/users/${id}`).pipe(
      catchError(error => {
        this.errorService.handleError(error)
        return throwError(() => error)
      }),
    )
  }

  createUser(userData: CreateUserDto): Observable<User> {
    return this.http.post<User>(`${this.baseUrl}/users/create`, userData).pipe(
      tap(newUser => this.users.update(current => [...current, newUser])),
      catchError(error => {
        this.errorService.handleError(error)
        return throwError(() => error)
      }),
    )
  }

  updateUser(userData: UpdateUserDto): Observable<User> {
    return this.http.patch<User>(`${this.baseUrl}/users/${userData.id}`, userData).pipe(
      tap(updated => {
        this.users.update(current =>
          current.map(user => (user.id === updated.id ? updated : user)),
        )
      }),
      catchError(error => {
        this.errorService.handleError(error)
        return throwError(() => error)
      }),
    )
  }

  deleteUser(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/users/${id}`).pipe(
      tap(() => this.users.update(current => current.filter(user => user.id !== id))),
      catchError(error => {
        this.errorService.handleError(error)
        return throwError(() => error)
      }),
    )
  }

  updateUserStatus(userId: string, isActive: boolean): Observable<UpdateUserStatusResponse> {
    return this.http.patch<UpdateUserStatusResponse>(`${this.baseUrl}/users/${userId}/status`, { isActive }).pipe(
      catchError(error => {
        this.errorService.handleError(error)
        return throwError(() => error)
      }),
    )
  }
}
