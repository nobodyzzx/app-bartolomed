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

@Injectable({
  providedIn: 'root',
})
export class UsersService {
  private readonly baseUrl = environment.baseUrl
  private http = inject(HttpClient)
  private errorService = inject(ErrorService)

  private users = signal<User[]>([])
  public currentUsers = computed(() => this.users())

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

  updateUserStatus(userId: string, isActive: boolean): Observable<void> {
    return this.http.patch<void>(`${this.baseUrl}/users/${userId}/status`, { isActive }).pipe(
      catchError(error => {
        this.errorService.handleError(error)
        return throwError(() => error)
      }),
    )
  }
}
