import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../../environments/environments';
import { Clinic, ClinicStatistics, CreateClinicDto, UpdateClinicDto } from '../interfaces';

@Injectable({
  providedIn: 'root'
})
export class ClinicsService {
  private readonly baseUrl = `${environment.baseUrl}/clinics`;

  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders().set('Authorization', `Bearer ${token}`);
  }

  createClinic(createClinicDto: CreateClinicDto): Observable<Clinic> {
    return this.http.post<Clinic>(this.baseUrl, createClinicDto, { headers: this.getHeaders() });
  }

  findAll(isActive?: boolean): Observable<Clinic[]> {
    let params = new HttpParams();
    if (isActive !== undefined) {
      params = params.set('isActive', isActive.toString());
    }
    return this.http.get<Clinic[]>(this.baseUrl, { params, headers: this.getHeaders() });
  }

  findOne(id: string): Observable<Clinic> {
    return this.http.get<Clinic>(`${this.baseUrl}/${id}`, { headers: this.getHeaders() });
  }

  updateClinic(id: string, updateClinicDto: UpdateClinicDto): Observable<Clinic> {
    return this.http.patch<Clinic>(`${this.baseUrl}/${id}`, updateClinicDto, { headers: this.getHeaders() });
  }

  delete(id: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/${id}`, { headers: this.getHeaders() });
  }

  activateClinic(id: string): Observable<Clinic> {
    return this.http.patch<Clinic>(`${this.baseUrl}/${id}/activate`, {}, { headers: this.getHeaders() });
  }

  deactivateClinic(id: string): Observable<Clinic> {
    return this.http.patch<Clinic>(`${this.baseUrl}/${id}/deactivate`, {}, { headers: this.getHeaders() });
  }

  searchClinics(searchTerm: string): Observable<Clinic[]> {
    let params = new HttpParams().set('term', searchTerm);
    return this.http.get<Clinic[]>(`${this.baseUrl}/search`, { params, headers: this.getHeaders() });
  }

  getClinicStatistics(): Observable<ClinicStatistics> {
    return this.http.get<ClinicStatistics>(`${this.baseUrl}/statistics`, { headers: this.getHeaders() });
  }

  addUserToClinic(userId: string, clinicId: string): Observable<Clinic> {
    return this.http.post<Clinic>(`${this.baseUrl}/${clinicId}/users/${userId}`, {}, { headers: this.getHeaders() });
  }

  removeUserFromClinic(userId: string, clinicId: string): Observable<Clinic> {
    return this.http.delete<Clinic>(`${this.baseUrl}/${clinicId}/users/${userId}`, { headers: this.getHeaders() });
  }
}
