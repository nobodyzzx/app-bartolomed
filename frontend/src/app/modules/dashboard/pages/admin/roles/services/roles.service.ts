import { HttpClient, HttpParams } from '@angular/common/http'
import { Injectable, inject } from '@angular/core'
import { Observable, throwError } from 'rxjs'
import { catchError, tap } from 'rxjs/operators'
import { environment } from '../../../../../../environments/environments'
import { NotificationService } from '../../../../../../shared/services/notification.service'

export interface Role {
  id: string
  name: string
  description?: string
  permissions?: string[]
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface CreateRolePayload {
  name: string
  description?: string
  permissions?: string[]
  isActive?: boolean
}

@Injectable({
  providedIn: 'root',
})
export class RolesService {
  private readonly baseUrl = environment.baseUrl
  private http = inject(HttpClient)
  private notification = inject(NotificationService)

  private handleError = (error: any) => {
    this.notification.error(this.errorMessage(error))
    return throwError(() => error)
  }

  private errorMessage(error: any, fallback = 'Ocurrió un error inesperado'): string {
    return error?.error?.message || fallback
  }

  findAll(isActive?: boolean): Observable<Role[]> {
    const url = `${this.baseUrl}/roles`
    let params = new HttpParams()
    if (isActive !== undefined) {
      params = params.set('isActive', isActive.toString())
    }
    return this.http.get<Role[]>(url, { params }).pipe(
      catchError(error => {
        this.notification.error('Error al cargar roles')
        return throwError(() => error)
      }),
    )
  }

  findOne(id: string): Observable<Role> {
    return this.http.get<Role>(`${this.baseUrl}/roles/${id}`).pipe(catchError(this.handleError))
  }

  create(payload: CreateRolePayload): Observable<Role> {
    return this.http.post<Role>(`${this.baseUrl}/roles`, payload).pipe(
      tap(() => this.notification.success('Rol creado')),
      catchError(error => {
        const message = error?.error?.message?.includes('duplicate')
          ? 'El rol ya existe'
          : 'Error al crear rol'
        this.notification.error(message)
        return throwError(() => error)
      }),
    )
  }

  update(id: string, payload: Partial<CreateRolePayload>): Observable<Role> {
    return this.http.patch<Role>(`${this.baseUrl}/roles/${id}`, payload).pipe(
      tap(() => this.notification.success('Rol actualizado')),
      catchError(error => {
        this.notification.error('Error al actualizar rol')
        return throwError(() => error)
      }),
    )
  }

  /** Activa/desactiva un rol; mensaje de éxito propio (no reutiliza el de `update()`). */
  setActiveStatus(id: string, isActive: boolean): Observable<Role> {
    return this.http.patch<Role>(`${this.baseUrl}/roles/${id}`, { isActive }).pipe(
      tap(() => this.notification.success(`Rol ${isActive ? 'activado' : 'desactivado'}`)),
      catchError(error => {
        this.notification.error(`Error al ${isActive ? 'activar' : 'desactivar'} el rol`)
        return throwError(() => error)
      }),
    )
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/roles/${id}`).pipe(
      tap(() => this.notification.success('Rol eliminado')),
      catchError(error => {
        this.notification.error('Error al eliminar rol')
        return throwError(() => error)
      }),
    )
  }

  activate(id: string): Observable<Role> {
    return this.http.patch<Role>(`${this.baseUrl}/roles/${id}/activate`, {}).pipe(catchError(this.handleError))
  }
}
