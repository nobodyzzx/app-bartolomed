import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { Observable } from 'rxjs'
import { environment } from '../../../../../environments/environments'
import {
  CreatePatientDto,
  Gender,
  PaginatedResult,
  Patient,
  PatientStatistics,
  UpdatePatientDto,
} from '../interfaces'

@Injectable({
  providedIn: 'root',
})
export class PatientsService {
  private readonly baseUrl = `${environment.baseUrl}/patients`

  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token')
    return new HttpHeaders().set('Authorization', `Bearer ${token}`)
  }

  createPatient(createPatientDto: CreatePatientDto): Observable<Patient> {
    return this.http.post<Patient>(this.baseUrl, createPatientDto, { headers: this.getHeaders() })
  }

  findAll(options: { page?: number; limit?: number; gender?: Gender } = {}): Observable<PaginatedResult<Patient>> {
    let params = new HttpParams()
    if (options.page) params = params.set('page', options.page)
    if (options.limit) params = params.set('limit', options.limit)
    if (options.gender) params = params.set('gender', options.gender)
    return this.http.get<PaginatedResult<Patient>>(this.baseUrl, { params, headers: this.getHeaders() })
  }

  findOne(id: string): Observable<Patient> {
    return this.http.get<Patient>(`${this.baseUrl}/${id}`, { headers: this.getHeaders() })
  }

  getPatientById(id: string): Observable<Patient> {
    return this.findOne(id)
  }

  findByDocument(documentNumber: string): Observable<Patient> {
    return this.http.get<Patient>(`${this.baseUrl}/document/${documentNumber}`, {
      headers: this.getHeaders(),
    })
  }

  updatePatient(id: string, updatePatientDto: UpdatePatientDto): Observable<Patient> {
    return this.http.patch<Patient>(`${this.baseUrl}/${id}`, updatePatientDto, {
      headers: this.getHeaders(),
    })
  }

  removePatient(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`, { headers: this.getHeaders() })
  }

  searchPatients(searchTerm: string, clinicId?: string): Observable<Patient[]> {
    let params = new HttpParams().set('term', searchTerm)
    if (clinicId) {
      params = params.set('clinicId', clinicId)
    }
    return this.http.get<Patient[]>(`${this.baseUrl}/search`, {
      params,
      headers: this.getHeaders(),
    })
  }

  getPatientStatistics(clinicId?: string): Observable<PatientStatistics> {
    let params = new HttpParams()
    if (clinicId) {
      params = params.set('clinicId', clinicId)
    }
    return this.http.get<PatientStatistics>(`${this.baseUrl}/statistics`, {
      params,
      headers: this.getHeaders(),
    })
  }
}
