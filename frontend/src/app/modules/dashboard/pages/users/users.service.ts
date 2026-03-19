import { computed, inject, Injectable, signal } from '@angular/core'
import { HttpClient } from '@angular/common/http'
import { catchError, Observable, tap, throwError } from 'rxjs'
import { environment } from '../../../../environments/environments'
import { ErrorService } from '../../../../shared/components/services/error.service'
import { User } from '../../../auth/interfaces/user.interface'
import { CreateUserDto, UpdateUserDto } from '../../interfaces/user.dto'

@Injectable({
  providedIn: 'root',
})
export class UsersService {
  private readonly baseUrl = environment.baseUrl
  private http = inject(HttpClient)
  private errorService = inject(ErrorService)

  private users = signal<User[]>([])
  public currentUsers = computed(() => this.users())

  getUsers(): Observable<User[]> {
    return this.http.get<User[]>(`${this.baseUrl}/users`).pipe(
      tap(users => this.users.set(users)),
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
