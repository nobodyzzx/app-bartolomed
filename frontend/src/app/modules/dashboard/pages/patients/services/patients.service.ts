import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../../../environments/environments';
import { CreatePatientDto, Gender, Patient, PatientStatistics, UpdatePatientDto } from '../interfaces';

@Injectable({
  providedIn: 'root'
})
export class PatientsService {
  private readonly baseUrl = `${environment.baseUrl}/patients`;

  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders().set('Authorization', `Bearer ${token}`);
  }

  get authHeaders(): HttpHeaders {
    return new HttpHeaders().set('Authorization', `Bearer ${localStorage.getItem('token')}`);
  }

  createPatient(createPatientDto: CreatePatientDto): Observable<Patient> {
    return this.http.post<Patient>(this.baseUrl, createPatientDto, { headers: this.getHeaders() });
  }

  findAll(clinicId?: string): Observable<Patient[]> {
    let params = new HttpParams();
    if (clinicId) {
      params = params.set('clinicId', clinicId);
    }
    return this.http.get<Patient[]>(this.baseUrl, { params, headers: this.getHeaders() }).pipe(
      catchError(error => {
        console.warn('Backend no disponible, usando datos de ejemplo de pacientes');
        // Datos de ejemplo cuando el backend no está disponible
        const mockPatients: Patient[] = [
          {
            id: '1',
            firstName: 'María',
            lastName: 'González',
            email: 'maria.gonzalez@email.com',
            phone: '+591-70123456',
            birthDate: new Date('1985-03-15'),
            gender: Gender.FEMALE,
            address: 'Av. América #123, Zona Central',
            documentNumber: '12345678',
            emergencyContactName: 'Pedro González',
            emergencyContactPhone: '+591-70654321',
            clinicId: '1',
            isActive: true,
            createdAt: new Date('2024-01-10'),
            updatedAt: new Date('2024-01-10')
          },
          {
            id: '2',
            firstName: 'Carlos',
            lastName: 'Mendoza',
            email: 'carlos.mendoza@email.com',
            phone: '+591-71234567',
            birthDate: new Date('1978-07-22'),
            gender: Gender.MALE,
            address: 'Calle Sucre #456, Zona Sur',
            documentNumber: '23456789',
            emergencyContactName: 'Ana Mendoza',
            emergencyContactPhone: '+591-71987654',
            clinicId: '1',
            isActive: true,
            createdAt: new Date('2024-01-15'),
            updatedAt: new Date('2024-01-15')
          },
          {
            id: '3',
            firstName: 'Ana',
            lastName: 'Rodríguez',
            email: 'ana.rodriguez@email.com',
            phone: '+591-72345678',
            birthDate: new Date('1992-11-08'),
            gender: Gender.FEMALE,
            address: 'Av. Ballivián #789, Zona Norte',
            documentNumber: '34567890',
            emergencyContactName: 'Luis Rodríguez',
            emergencyContactPhone: '+591-72876543',
            clinicId: '1',
            isActive: true,
            createdAt: new Date('2024-01-20'),
            updatedAt: new Date('2024-01-20')
          },
          {
            id: '4',
            firstName: 'Roberto',
            lastName: 'Vargas',
            email: 'roberto.vargas@email.com',
            phone: '+591-73456789',
            birthDate: new Date('1965-05-12'),
            gender: Gender.MALE,
            address: 'Calle Comercio #321, Centro',
            documentNumber: '45678901',
            emergencyContactName: 'Elena Vargas',
            emergencyContactPhone: '+591-73765432',
            clinicId: '1',
            isActive: true,
            createdAt: new Date('2024-02-01'),
            updatedAt: new Date('2024-02-01')
          },
          {
            id: '5',
            firstName: 'Lucía',
            lastName: 'Herrera',
            email: 'lucia.herrera@email.com',
            phone: '+591-74567890',
            birthDate: new Date('1990-09-30'),
            gender: Gender.FEMALE,
            address: 'Av. 6 de Agosto #654, Zona Central',
            documentNumber: '56789012',
            emergencyContactName: 'Miguel Herrera',
            emergencyContactPhone: '+591-74654321',
            clinicId: '1',
            isActive: true,
            createdAt: new Date('2024-02-05'),
            updatedAt: new Date('2024-02-05')
          }
        ];
        return of(mockPatients);
      })
    );
  }

  findOne(id: string): Observable<Patient> {
    return this.http.get<Patient>(`${this.baseUrl}/${id}`, { headers: this.getHeaders() });
  }

  findByDocument(documentNumber: string): Observable<Patient> {
    return this.http.get<Patient>(`${this.baseUrl}/document/${documentNumber}`, { headers: this.getHeaders() });
  }

  updatePatient(id: string, updatePatientDto: UpdatePatientDto): Observable<Patient> {
    return this.http.patch<Patient>(`${this.baseUrl}/${id}`, updatePatientDto, { headers: this.getHeaders() });
  }

  removePatient(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`, { headers: this.getHeaders() });
  }

  searchPatients(searchTerm: string, clinicId?: string): Observable<Patient[]> {
    let params = new HttpParams().set('term', searchTerm);
    if (clinicId) {
      params = params.set('clinicId', clinicId);
    }
    return this.http.get<Patient[]>(`${this.baseUrl}/search`, { params, headers: this.getHeaders() });
  }

  getPatientStatistics(clinicId?: string): Observable<PatientStatistics> {
    let params = new HttpParams();
    if (clinicId) {
      params = params.set('clinicId', clinicId);
    }
    return this.http.get<PatientStatistics>(`${this.baseUrl}/statistics`, { params, headers: this.getHeaders() });
  }
}
