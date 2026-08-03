import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { environment } from '../../../../../../environments/environments';
import { ErrorService } from '../../../../../../shared/components/services/error.service';
import { AlertService } from '@core/services/alert.service';
import { Clinic, ClinicStatistics, CreateClinicDto, UpdateClinicDto } from '../interfaces';

@Injectable({
  providedIn: 'root'
})
export class ClinicsService {
  private readonly baseUrl = `${environment.baseUrl}/clinics`;

  constructor(
    private http: HttpClient,
    private errorService: ErrorService,
    private alert: AlertService,
  ) {}

  private handleError = (error: any) => {
    this.errorService.handleError(error);
    return throwError(() => error);
  };

  createClinic(createClinicDto: CreateClinicDto): Observable<Clinic> {
    return this.http.post<Clinic>(this.baseUrl, createClinicDto).pipe(
      tap(() => this.alert.success('Clínica creada', 'La clínica ha sido registrada correctamente.')),
      catchError(this.handleError),
    );
  }

  findAll(isActive?: boolean): Observable<Clinic[]> {
    let params = new HttpParams();
    if (isActive !== undefined) {
      params = params.set('isActive', isActive.toString());
    }
    return this.http.get<Clinic[]>(this.baseUrl, { params }).pipe(catchError(this.handleError));
  }

  findOne(id: string): Observable<Clinic> {
    return this.http.get<Clinic>(`${this.baseUrl}/${id}`).pipe(catchError(this.handleError));
  }

  updateClinic(id: string, updateClinicDto: UpdateClinicDto): Observable<Clinic> {
    return this.http.patch<Clinic>(`${this.baseUrl}/${id}`, updateClinicDto).pipe(
      tap(() => this.alert.success('Clínica actualizada', 'La clínica ha sido actualizada correctamente')),
      catchError(this.handleError),
    );
  }

  delete(id: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/${id}`).pipe(
      tap(() => this.alert.success('Clínica eliminada', 'La clínica ha sido eliminada correctamente')),
      catchError(this.handleError),
    );
  }

  activateClinic(id: string): Observable<Clinic> {
    return this.http.patch<Clinic>(`${this.baseUrl}/${id}/activate`, {}).pipe(
      tap(() => this.alert.success('Clínica activada', 'La clínica ha sido activada correctamente')),
      catchError(this.handleError),
    );
  }

  deactivateClinic(id: string): Observable<Clinic> {
    return this.http.patch<Clinic>(`${this.baseUrl}/${id}/deactivate`, {}).pipe(
      tap(() => this.alert.success('Clínica desactivada', 'La clínica ha sido desactivada correctamente')),
      catchError(this.handleError),
    );
  }

  searchClinics(searchTerm: string): Observable<Clinic[]> {
    let params = new HttpParams().set('term', searchTerm);
    return this.http.get<Clinic[]>(`${this.baseUrl}/search`, { params }).pipe(catchError(this.handleError));
  }

  getClinicStatistics(): Observable<ClinicStatistics> {
    return this.http.get<ClinicStatistics>(`${this.baseUrl}/statistics`).pipe(catchError(this.handleError));
  }

}
