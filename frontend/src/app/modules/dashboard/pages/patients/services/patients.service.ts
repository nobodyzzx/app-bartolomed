import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { AlertService } from '@core/services/alert.service'
import { Observable, throwError } from 'rxjs'
import { catchError, tap } from 'rxjs/operators'
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

  constructor(
    private http: HttpClient,
    private alert: AlertService,
  ) {}

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token')
    return new HttpHeaders().set('Authorization', `Bearer ${token}`)
  }

  /** Sin tap/catchError: el componente gestiona un diálogo de éxito con 3 rutas de navegación distintas y un manejo de error propio (incl. reintento automático). */
  createPatient(createPatientDto: CreatePatientDto): Observable<Patient> {
    return this.http.post<Patient>(this.baseUrl, createPatientDto, { headers: this.getHeaders() })
  }

  findAll(options: { page?: number; limit?: number; gender?: Gender } = {}): Observable<PaginatedResult<Patient>> {
    let params = new HttpParams()
    if (options.page) params = params.set('page', options.page)
    if (options.limit) params = params.set('limit', options.limit)
    if (options.gender) params = params.set('gender', options.gender)
    return this.http
      .get<PaginatedResult<Patient>>(this.baseUrl, { params, headers: this.getHeaders() })
      .pipe(catchError(error => { this.alert.error('Error al cargar pacientes'); return throwError(() => error) }))
  }

  /** Sin catchError: patient-form.component.ts distingue 404 (paciente no encontrado) de otros errores para decidir el mensaje y la navegación. */
  findOne(id: string): Observable<Patient> {
    return this.http.get<Patient>(`${this.baseUrl}/${id}`, { headers: this.getHeaders() })
  }

  getPatientById(id: string): Observable<Patient> {
    return this.findOne(id)
  }

  /** Sin catchError: usado como verificación de duplicados no crítica; el consumidor degrada en silencio a "no encontrado". */
  findByDocument(documentNumber: string): Observable<Patient> {
    return this.http.get<Patient>(`${this.baseUrl}/document/${documentNumber}`, {
      headers: this.getHeaders(),
    })
  }

  /** Sin tap/catchError: mismo motivo que createPatient (diálogo de éxito y manejo de error propios del componente). */
  updatePatient(id: string, updatePatientDto: UpdatePatientDto): Observable<Patient> {
    return this.http.patch<Patient>(`${this.baseUrl}/${id}`, updatePatientDto, {
      headers: this.getHeaders(),
    })
  }

  removePatient(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`, { headers: this.getHeaders() }).pipe(
      tap(() => this.alert.success('Eliminado', 'El paciente ha sido eliminado.')),
      catchError(error => { this.alert.error('No se pudo eliminar el paciente.'); return throwError(() => error) }),
    )
  }

  searchPatients(searchTerm: string, clinicId?: string): Observable<Patient[]> {
    let params = new HttpParams().set('term', searchTerm)
    if (clinicId) {
      params = params.set('clinicId', clinicId)
    }
    return this.http
      .get<Patient[]>(`${this.baseUrl}/search`, { params, headers: this.getHeaders() })
      .pipe(catchError(error => { this.alert.error('Error al buscar pacientes'); return throwError(() => error) }))
  }

  /** Sin catchError: estadística no crítica, el consumidor degrada en silencio si falla. */
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
