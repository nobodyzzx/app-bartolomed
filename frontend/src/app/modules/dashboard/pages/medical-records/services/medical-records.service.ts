import { HttpClient, HttpParams } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { AlertService } from '@core/services/alert.service'
import { forkJoin, Observable, of, throwError } from 'rxjs'
import { catchError, map, switchMap, tap } from 'rxjs/operators'
import { ErrorService } from '../../../../../shared/components/services/error.service'
import { environment } from '../../../../../environments/environments'
import {
  ConsentForm,
  CreateConsentDto,
  CreateMedicalRecordDto,
  MedicalRecord,
  MedicalRecordFilters,
  RecordStatus,
  UpdateMedicalRecordDto,
} from '../interfaces'

@Injectable({
  providedIn: 'root',
})
export class MedicalRecordsService {
  private readonly apiUrl = `${environment.baseUrl}/medical-records`
  private readonly consentApiUrl = `${environment.baseUrl}/medical-records/consent-forms`

  constructor(
    private http: HttpClient,
    private alert: AlertService,
    private errorService: ErrorService,
  ) {}

  // CRUD Operations para Medical Records
  getMedicalRecords(
    filters?: MedicalRecordFilters,
    page?: number,
    limit?: number,
  ): Observable<{ data: MedicalRecord[]; total: number }> {
    let params = new HttpParams()

    if (filters) {
      Object.keys(filters).forEach(key => {
        const value = filters[key as keyof MedicalRecordFilters]
        if (value !== undefined && value !== null) {
          params = params.set(key, value.toString())
        }
      })
    }

    // Sin esto el backend aplica su `limit = 10` por defecto. La pantalla del
    // listado filtra, ordena y pagina en cliente sobre lo que reciba, así que
    // pedir una sola página dejaba el resto del expediente inalcanzable
    // mientras el contador seguía anunciando el total real.
    if (page !== undefined) params = params.set('page', String(page))
    if (limit !== undefined) params = params.set('limit', String(limit))

    return this.http
      .get<{ data: MedicalRecord[]; total: number }>(this.apiUrl, { params })
      .pipe(catchError(error => { this.errorService.handleError(error); return throwError(() => error) }))
  }

  /**
   * Todos los expedientes que la pantalla del listado necesita para filtrar,
   * ordenar y paginar en cliente. Mismo criterio que el inventario de activos:
   * se pide la primera página, se calcula cuántas faltan y se traen en paralelo.
   */
  getAllMedicalRecords(
    filters?: MedicalRecordFilters,
  ): Observable<{ data: MedicalRecord[]; total: number }> {
    const TAM = 100
    // Tope de seguridad: un historial de decenas de miles es preferible verlo
    // recortado a disparar cientos de peticiones. `total` sigue siendo el real,
    // así que la pantalla puede avisar de que no los tiene todos.
    const MAX_PAGINAS = 20

    return this.getMedicalRecords(filters, 1, TAM).pipe(
      switchMap(primera => {
        const paginas = Math.min(Math.ceil((primera.total ?? 0) / TAM), MAX_PAGINAS)
        if (paginas <= 1) return of(primera)
        const resto = Array.from({ length: paginas - 1 }, (_, i) =>
          this.getMedicalRecords(filters, i + 2, TAM),
        )
        return forkJoin(resto).pipe(
          map(rs => ({
            data: [primera.data, ...rs.map(r => r.data)].flat(),
            total: primera.total,
          })),
        )
      }),
    )
  }

  getMedicalRecordById(id: string): Observable<MedicalRecord> {
    return this.http
      .get<MedicalRecord>(`${this.apiUrl}/${id}`)
      .pipe(catchError(error => { this.errorService.handleError(error); return throwError(() => error) }))
  }

  getMedicalRecordsByPatient(patientId: string): Observable<MedicalRecord[]> {
    return this.http
      .get<MedicalRecord[]>(`${this.apiUrl}/patient/${patientId}`)
      .pipe(catchError(error => { this.errorService.handleError(error); return throwError(() => error) }))
  }

  getMedicalRecordsByDoctor(doctorId: string): Observable<MedicalRecord[]> {
    return this.http
      .get<MedicalRecord[]>(`${this.apiUrl}/doctor/${doctorId}`)
      .pipe(catchError(error => { this.errorService.handleError(error); return throwError(() => error) }))
  }

  /** Crea el expediente; el mensaje varía según se guarde como borrador o completo. */
  createMedicalRecord(medicalRecord: CreateMedicalRecordDto): Observable<MedicalRecord> {
    const isDraft = medicalRecord.status === RecordStatus.DRAFT
    return this.http.post<MedicalRecord>(this.apiUrl, medicalRecord).pipe(
      tap(() =>
        this.alert.fire({
          icon: 'success',
          title: isDraft ? '¡Borrador guardado!' : '¡Expediente creado!',
          text: isDraft
            ? 'El expediente médico ha sido guardado como borrador.'
            : 'El expediente médico ha sido creado exitosamente.',
          confirmButtonText: 'Aceptar',
        }),
      ),
      catchError(error => {
        this.errorService.handleError(error)
        return throwError(() => error)
      }),
    )
  }

  updateMedicalRecord(
    id: string,
    medicalRecord: UpdateMedicalRecordDto,
  ): Observable<MedicalRecord> {
    return this.http.patch<MedicalRecord>(`${this.apiUrl}/${id}`, medicalRecord).pipe(
      tap(() =>
        this.alert.fire({
          icon: 'success',
          title: '¡Expediente actualizado!',
          text: 'El expediente médico ha sido actualizado exitosamente.',
          confirmButtonText: 'Aceptar',
        }),
      ),
      catchError(error => { this.errorService.handleError(error); return throwError(() => error) }),
    )
  }

  deleteMedicalRecord(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(
      tap(() => this.alert.success('Eliminado', 'El expediente médico ha sido eliminado.')),
      catchError(error => { this.errorService.handleError(error); return throwError(() => error) }),
    )
  }

  // CRUD Operations para Consent Forms
  getConsentForms(medicalRecordId?: string): Observable<ConsentForm[]> {
    let params = new HttpParams()
    if (medicalRecordId) {
      params = params.set('medicalRecordId', medicalRecordId)
    }
    return this.http
      .get<ConsentForm[]>(this.consentApiUrl, { params })
      .pipe(catchError(error => { this.errorService.handleError(error); return throwError(() => error) }))
  }

  getConsentFormById(id: string): Observable<ConsentForm> {
    return this.http
      .get<ConsentForm>(`${this.consentApiUrl}/${id}`)
      .pipe(catchError(error => { this.errorService.handleError(error); return throwError(() => error) }))
  }

  /** Crea el consentimiento inmediatamente después de crear el expediente que lo requiere. */
  createConsentForm(consent: CreateConsentDto): Observable<ConsentForm> {
    return this.http.post<ConsentForm>(this.consentApiUrl, consent).pipe(
      tap(() =>
        this.alert.fire({
          icon: 'success',
          title: '¡Expediente y consentimiento creados!',
          text: 'El expediente médico y el consentimiento han sido creados exitosamente.',
          confirmButtonText: 'Aceptar',
        }),
      ),
      catchError(error => { this.errorService.handleError(error); return throwError(() => error) }),
    )
  }

  updateConsentForm(id: string, consent: Partial<ConsentForm>): Observable<ConsentForm> {
    return this.http.patch<ConsentForm>(`${this.consentApiUrl}/${id}`, consent).pipe(
      tap(() => this.alert.success('Consentimiento actualizado')),
      catchError(error => { this.errorService.handleError(error); return throwError(() => error) }),
    )
  }

  deleteConsentForm(id: string): Observable<void> {
    return this.http.delete<void>(`${this.consentApiUrl}/${id}`).pipe(
      tap(() => this.alert.success('Consentimiento eliminado')),
      catchError(error => { this.errorService.handleError(error); return throwError(() => error) }),
    )
  }

  // Upload de archivos firmados
  uploadSignedConsent(
    consentId: string,
    file: File,
    witnessData?: { witnessName?: string; witnessRelationship?: string; notes?: string },
  ): Observable<ConsentForm> {
    const formData = new FormData()
    formData.append('file', file)

    if (witnessData?.witnessName) {
      formData.append('witnessName', witnessData.witnessName)
    }
    if (witnessData?.witnessRelationship) {
      formData.append('witnessRelationship', witnessData.witnessRelationship)
    }
    if (witnessData?.notes) {
      formData.append('notes', witnessData.notes)
    }

    return this.http.post<ConsentForm>(`${this.consentApiUrl}/${consentId}/upload`, formData).pipe(
      tap(() => this.alert.success('Documento firmado subido correctamente')),
      catchError(error => { this.errorService.handleError(error); return throwError(() => error) }),
    )
  }

  // Estadísticas y reportes
  getMedicalRecordsStats(): Observable<any> {
    return this.http
      .get(`${this.apiUrl}/stats`)
      .pipe(catchError(error => { this.errorService.handleError(error); return throwError(() => error) }))
  }

  // Generación de PDFs (backend)
  downloadConsentPdf(dto: Record<string, any>): Observable<Blob> {
    return this.http
      .post(`${this.apiUrl}/pdf/consent`, dto, { responseType: 'blob' })
      .pipe(catchError(error => { this.errorService.handleError(error); return throwError(() => error) }))
  }

  downloadSummaryPdf(dto: Record<string, any>): Observable<Blob> {
    return this.http
      .post(`${this.apiUrl}/pdf/summary`, dto, { responseType: 'blob' })
      .pipe(catchError(error => { this.errorService.handleError(error); return throwError(() => error) }))
  }

  // Obtener consentimientos por expediente médico
  getConsentFormsByMedicalRecord(medicalRecordId: string): Observable<ConsentForm[]> {
    return this.http
      .get<ConsentForm[]>(`${this.apiUrl}/${medicalRecordId}/consent-forms`)
      .pipe(catchError(error => { this.errorService.handleError(error); return throwError(() => error) }))
  }
}
