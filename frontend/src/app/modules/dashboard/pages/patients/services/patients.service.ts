import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { AlertService } from '@core/services/alert.service'
import { forkJoin, Observable, of, throwError } from 'rxjs'
import { catchError, map, switchMap, tap } from 'rxjs/operators'
import { ErrorService } from '../../../../../shared/components/services/error.service'
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
    private errorService: ErrorService,
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
      .pipe(catchError(error => { this.errorService.handleError(error); return throwError(() => error) }))
  }

  /**
   * Todos los pacientes de la clínica, para que el listado ordene y pagine en
   * el navegador sobre el conjunto entero.
   *
   * Paginando contra el servidor, ordenar por una cabecera solo reordenaba la
   * página cargada: con 35 pacientes y páginas de 25, pulsar "Paciente" dejaba
   * los otros 10 fuera del orden y la lista parecía ordenada sin estarlo. El
   * backend no admite ordenar —no hay `sort` ni `orderBy` en su controlador ni
   * en su servicio—, así que el orden tiene que ser de este lado y necesita
   * tener delante todos los pacientes.
   *
   * Mismo criterio que activos e historias clínicas: primera página, se calcula
   * cuántas faltan y se traen en paralelo.
   */
  getAllPatients(gender?: Gender): Observable<PaginatedResult<Patient>> {
    const TAM = 100
    // Tope de seguridad: una clínica con decenas de miles de pacientes es
    // preferible verla recortada a disparar cientos de peticiones. `total`
    // sigue siendo el del servidor, y con eso la pantalla puede avisar.
    const MAX_PAGINAS = 20

    return this.findAll({ page: 1, limit: TAM, gender }).pipe(
      switchMap(primera => {
        const paginas = Math.min(Math.ceil((primera.total ?? 0) / TAM), MAX_PAGINAS)
        if (paginas <= 1) return of(primera)
        const resto = Array.from({ length: paginas - 1 }, (_, i) =>
          this.findAll({ page: i + 2, limit: TAM, gender }),
        )
        return forkJoin(resto).pipe(
          map(rs => ({
            ...primera,
            data: [primera.data, ...rs.map(r => r.data)].flat(),
          })),
        )
      }),
    )
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
      catchError(error => { this.errorService.handleError(error); return throwError(() => error) }),
    )
  }

  searchPatients(searchTerm: string, clinicId?: string): Observable<Patient[]> {
    let params = new HttpParams().set('term', searchTerm)
    if (clinicId) {
      params = params.set('clinicId', clinicId)
    }
    return this.http
      .get<Patient[]>(`${this.baseUrl}/search`, { params, headers: this.getHeaders() })
      .pipe(catchError(error => { this.errorService.handleError(error); return throwError(() => error) }))
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
