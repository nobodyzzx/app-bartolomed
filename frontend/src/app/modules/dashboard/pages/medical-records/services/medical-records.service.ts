import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import { 
  MedicalRecord, 
  CreateMedicalRecordDto, 
  UpdateMedicalRecordDto, 
  MedicalRecordFilters,
  ConsentForm,
  CreateConsentDto
} from '../interfaces';

@Injectable({
  providedIn: 'root'
})
export class MedicalRecordsService {
  private readonly apiUrl = `${environment.apiUrl}/medical-records`;
  private readonly consentApiUrl = `${environment.apiUrl}/medical-records/consent-forms`;

  constructor(private http: HttpClient) {}

    // CRUD Operations para Medical Records
  getMedicalRecords(filters?: MedicalRecordFilters): Observable<{ data: MedicalRecord[]; total: number }> {
    let params = new HttpParams();
    
    if (filters) {
      Object.keys(filters).forEach(key => {
        const value = filters[key as keyof MedicalRecordFilters];
        if (value !== undefined && value !== null) {
          params = params.set(key, value.toString());
        }
      });
    }
    
    return this.http.get<{ data: MedicalRecord[]; total: number }>(this.apiUrl, { params });
  }

  getMedicalRecordById(id: string): Observable<MedicalRecord> {
    return this.http.get<MedicalRecord>(`${this.apiUrl}/${id}`);
  }

  getMedicalRecordsByPatient(patientId: string): Observable<MedicalRecord[]> {
    return this.http.get<MedicalRecord[]>(`${this.apiUrl}/patient/${patientId}`);
  }

  getMedicalRecordsByDoctor(doctorId: string): Observable<MedicalRecord[]> {
    return this.http.get<MedicalRecord[]>(`${this.apiUrl}/doctor/${doctorId}`);
  }

  createMedicalRecord(medicalRecord: CreateMedicalRecordDto): Observable<MedicalRecord> {
    return this.http.post<MedicalRecord>(this.apiUrl, medicalRecord);
  }

  updateMedicalRecord(id: string, medicalRecord: UpdateMedicalRecordDto): Observable<MedicalRecord> {
    return this.http.patch<MedicalRecord>(`${this.apiUrl}/${id}`, medicalRecord);
  }

  deleteMedicalRecord(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  // CRUD Operations para Consent Forms
  getConsentForms(medicalRecordId?: string): Observable<ConsentForm[]> {
    let params = new HttpParams();
    if (medicalRecordId) {
      params = params.set('medicalRecordId', medicalRecordId);
    }
    return this.http.get<ConsentForm[]>(this.consentApiUrl, { params });
  }

  getConsentFormById(id: string): Observable<ConsentForm> {
    return this.http.get<ConsentForm>(`${this.consentApiUrl}/${id}`);
  }

  createConsentForm(consent: CreateConsentDto): Observable<ConsentForm> {
    return this.http.post<ConsentForm>(this.consentApiUrl, consent);
  }

  updateConsentForm(id: string, consent: Partial<ConsentForm>): Observable<ConsentForm> {
    return this.http.patch<ConsentForm>(`${this.consentApiUrl}/${id}`, consent);
  }

  deleteConsentForm(id: string): Observable<void> {
    return this.http.delete<void>(`${this.consentApiUrl}/${id}`);
  }

  // Upload de archivos firmados
  uploadSignedConsent(consentId: string, file: File, witnessData?: { witnessName?: string; witnessRelationship?: string; notes?: string }): Observable<ConsentForm> {
    const formData = new FormData();
    formData.append('file', file);
    
    if (witnessData?.witnessName) {
      formData.append('witnessName', witnessData.witnessName);
    }
    if (witnessData?.witnessRelationship) {
      formData.append('witnessRelationship', witnessData.witnessRelationship);
    }
    if (witnessData?.notes) {
      formData.append('notes', witnessData.notes);
    }
    
    return this.http.post<ConsentForm>(`${this.consentApiUrl}/${consentId}/upload`, formData);
  }

  // Estadísticas y reportes
  getMedicalRecordsStats(): Observable<any> {
    return this.http.get(`${this.apiUrl}/stats`);
  }

  // Obtener consentimientos por expediente médico
  getConsentFormsByMedicalRecord(medicalRecordId: string): Observable<ConsentForm[]> {
    return this.http.get<ConsentForm[]>(`${this.apiUrl}/${medicalRecordId}/consent-forms`);
  }
}
