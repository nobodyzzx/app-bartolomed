import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../../environments/environments';
import {
  AuditDistinctValues,
  AuditFilters,
  AuditLogsResponse,
  AuditStats,
  DailyActivity,
} from './interfaces/audit-log.interface';

@Injectable({ providedIn: 'root' })
export class AuditService {
  private readonly base = `${environment.baseUrl}/audit`;

  constructor(private readonly http: HttpClient) {}

  findAll(filters: AuditFilters): Observable<AuditLogsResponse> {
    let params = new HttpParams();
    if (filters.page != null) params = params.set('page', filters.page.toString());
    if (filters.pageSize != null) params = params.set('pageSize', filters.pageSize.toString());
    if (filters.action) params = params.set('action', filters.action);
    if (filters.resource) params = params.set('resource', filters.resource);
    if (filters.status) params = params.set('status', filters.status);
    if (filters.userEmail) params = params.set('userEmail', filters.userEmail);
    if (filters.search) params = params.set('search', filters.search);
    if (filters.startDate) params = params.set('startDate', filters.startDate);
    if (filters.endDate) params = params.set('endDate', filters.endDate);
    return this.http.get<AuditLogsResponse>(this.base, { params });
  }

  getStats(startDate?: string, endDate?: string): Observable<AuditStats> {
    let params = new HttpParams();
    if (startDate) params = params.set('startDate', startDate);
    if (endDate) params = params.set('endDate', endDate);
    return this.http.get<AuditStats>(`${this.base}/stats`, { params });
  }

  getDailyActivity(startDate?: string, endDate?: string): Observable<DailyActivity[]> {
    let params = new HttpParams();
    if (startDate) params = params.set('startDate', startDate);
    if (endDate) params = params.set('endDate', endDate);
    return this.http.get<DailyActivity[]>(`${this.base}/activity`, { params });
  }

  getDistinctValues(): Observable<AuditDistinctValues> {
    return this.http.get<AuditDistinctValues>(`${this.base}/filters`);
  }
}
