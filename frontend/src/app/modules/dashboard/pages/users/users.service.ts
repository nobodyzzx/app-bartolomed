import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { catchError, map, Observable, tap, throwError } from 'rxjs';
import { environment } from '../../../../environments/environments';
import { AuthService } from '../../../auth/services/auth.service';
import { ErrorService } from '../../../../shared/components/services/error.service';
import { User } from '../../../auth/interfaces/user.interface';
import { CreateUserDto, UpdateUserDto } from '../../interfaces/user.dto';

@Injectable({
  providedIn: 'root',
})
export class UsersService {
  private readonly baseUrl = environment.baseUrl;
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private errorService = inject(ErrorService);

  //Signals

  private users = signal<User[]>([]);
  public currentUsers = computed(() => this.users());

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders().set('Authorization', `Bearer ${token}`);
  }

  get authHeaders(): HttpHeaders {
    return new HttpHeaders().set('Authorization', `Bearer ${localStorage.getItem('token')}`);
  }

  getUsers(): Observable<User[]> {
    const headers = this.getHeaders();
    return this.http.get<User[]>(`${this.baseUrl}/users`, { headers }).pipe(
      tap((users) => this.users.set(users)),
      catchError((error) => {
        this.errorService.handleError(error);
        return [];
      })
    );
  }

  getUserById(id: string): Observable<User> {
    const headers = this.getHeaders();
    return this.http.get<User>(`${this.baseUrl}/users/${id}`, { headers }).pipe(
      catchError((error) => {
        this.errorService.handleError(error);
        throw error;
      })
    );
  }

  createUser(userData: CreateUserDto): Observable<User> {
    const headers = this.getHeaders();
    return this.http.post<User>(`${this.baseUrl}/users/create`, userData, { headers }).pipe(
      tap((newUser) => {
        this.users.update((current) => [...current, newUser]);
      }),
      catchError((error) => {
        this.errorService.handleError(error);
        throw error;
      })
    );
  }

  updateUser(userData: UpdateUserDto): Observable<User> {
    const headers = this.getHeaders();
    return this.http.patch<User>(`${this.baseUrl}/users/${userData.id}`, userData, { headers }).pipe(
      tap((updatedUser) => {
        this.users.update((current) => current.map((user) => (user.id === updatedUser.id ? updatedUser : user)));
      }),
      catchError((error) => {
        this.errorService.handleError(error);
        throw error;
      })
    );
  }

  deleteUser(id: string): Observable<void> {
    const headers = this.getHeaders();
    return this.http.delete<void>(`${this.baseUrl}/users/${id}`, { headers }).pipe(
      tap(() => {
        this.users.update((current) => current.filter((user) => user.id !== id));
      }),
      catchError((error) => {
        this.errorService.handleError(error);
        throw error;
      })
    );
  }
  findAll(): Observable<User[]> {
    return this.http
      .get<User[]>(`${this.baseUrl}/users`, {
        headers: this.authHeaders,
      })
      .pipe(
        tap((users) => this.users.set(users)),
        catchError((error) => {
          this.errorService.handleError(error);
          return throwError(() => error);
        })
      );
  }

  findOne(id: string): Observable<User> {
    return this.http
      .get<User>(`${this.baseUrl}/users/${id}`, {
        headers: this.authHeaders,
      })
      .pipe(
        catchError((error) => {
          this.errorService.handleError(error);
          return throwError(() => error);
        })
      );
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
