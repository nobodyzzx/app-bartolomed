import { HttpClient, HttpParams } from '@angular/common/http'
import { Injectable, inject } from '@angular/core'
import { Observable } from 'rxjs'
import { environment } from '../../../environments/environments'

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

  findAll(isActive?: boolean): Observable<Role[]> {
    const url = `${this.baseUrl}/roles`
    let params = new HttpParams()
    if (isActive !== undefined) {
      params = params.set('isActive', isActive.toString())
    }
    return this.http.get<Role[]>(url, { params })
  }

  findOne(id: string): Observable<Role> {
    return this.http.get<Role>(`${this.baseUrl}/roles/${id}`)
  }

  create(payload: CreateRolePayload): Observable<Role> {
    return this.http.post<Role>(`${this.baseUrl}/roles`, payload)
  }

  update(id: string, payload: Partial<CreateRolePayload>): Observable<Role> {
    return this.http.patch<Role>(`${this.baseUrl}/roles/${id}`, payload)
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/roles/${id}`)
  }

  activate(id: string): Observable<Role> {
    return this.http.patch<Role>(`${this.baseUrl}/roles/${id}/activate`, {})
  }
}
