import { HttpClient, HttpParams } from '@angular/common/http'
import { Injectable, inject } from '@angular/core'
import { Observable, of } from 'rxjs'
import { catchError, map } from 'rxjs/operators'
import { environment } from '../../../../environments/environments'
import { RecentAppointment, RecentPatient, StockAlert } from './interfaces/dashboard-ui.interfaces'

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly http = inject(HttpClient)
  private readonly base = environment.baseUrl

  /** Total de pacientes y estadísticas desde /api/patients/statistics */
  getPatientStats(): Observable<{ total: number }> {
    return this.http.get<any>(`${this.base}/patients/statistics`).pipe(
      map(r => ({ total: r.totalPatients ?? 0 })),
      catchError(() => of({ total: 0 })),
    )
  }

  /** Citas de hoy desde /api/appointments */
  getTodayAppointments(): Observable<RecentAppointment[]> {
    const today = new Date().toISOString().slice(0, 10)
    const params = new HttpParams().set('date', today).set('limit', '20')
    return this.http.get<any>(`${this.base}/appointments`, { params }).pipe(
      map(r => {
        const items: any[] = Array.isArray(r) ? r : (r.data ?? r.items ?? [])
        return items.map((a: any) => ({
          id:          a.id,
          patientName: a.patient
            ? `${a.patient.firstName ?? ''} ${a.patient.lastName ?? ''}`.trim()
            : 'Paciente',
          doctorName:  a.doctor
            ? `${a.doctor.personalInfo?.firstName ?? ''} ${a.doctor.personalInfo?.lastName ?? ''}`.trim() || 'Médico'
            : 'Médico',
          time:        (a.startTime ?? a.appointmentDate ?? '').slice(11, 16) || '--:--',
          date:        a.appointmentDate ?? a.startTime ?? today,
          status:      a.status ?? 'pending',
          type:        a.type ?? a.appointmentType ?? 'Consulta',
        }))
      }),
      catchError(() => of([])),
    )
  }

  /** Medicamentos con stock bajo desde /api/pharmacy/inventory/stock/low-stock */
  getLowStockAlerts(): Observable<StockAlert[]> {
    return this.http.get<any[]>(`${this.base}/pharmacy/inventory/stock/low-stock`).pipe(
      map(items => (items ?? []).map((s: any) => ({
        id:           s.id,
        medication:   s.medication?.name ?? s.medicationName ?? 'Medicamento',
        currentStock: s.availableQuantity ?? s.quantity ?? 0,
        minimumStock: s.minimumStock ?? 10,
        category:     s.medication?.category ?? '',
        expiryDate:   s.expiryDate ?? undefined,
      }))),
      catchError(() => of([])),
    )
  }

  /** Pacientes recientes desde /api/patients?limit=6 */
  getRecentPatients(): Observable<RecentPatient[]> {
    const params = new HttpParams().set('limit', '6').set('page', '1')
    return this.http.get<any>(`${this.base}/patients`, { params }).pipe(
      map(r => {
        const items: any[] = Array.isArray(r) ? r : (r.data ?? r.items ?? [])
        return items.map((p: any) => {
          const birth = p.birthDate ? new Date(p.birthDate) : null
          const age   = birth ? Math.floor((Date.now() - birth.getTime()) / 31_557_600_000) : 0
          return {
            id:              p.id,
            name:            `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim() || 'Paciente',
            age,
            lastVisit:       p.lastVisit ?? p.updatedAt ?? p.createdAt ?? '',
            nextAppointment: p.nextAppointment ?? undefined,
            status:          (p.isActive !== false) ? 'active' : 'inactive',
            phone:           p.phone ?? undefined,
          } as RecentPatient
        })
      }),
      catchError(() => of([])),
    )
  }

  /** Ventas diarias últimos 7 días para gráfico de barras */
  getWeeklySales(clinicId: string): Observable<{ labels: string[]; values: number[] }> {
    const end   = new Date()
    const start = new Date(); start.setDate(start.getDate() - 6)
    const fmt   = (d: Date) => d.toISOString().slice(0, 10)
    const params = new HttpParams()
      .set('startDate', fmt(start)).set('endDate', fmt(end)).set('clinicId', clinicId)
    return this.http.get<any>(`${this.base}/reports/pharmacy/daily-sales`, { params }).pipe(
      map(r => {
        const days = r?.dailySales ?? []
        // Generar labels para los 7 días aunque no haya ventas
        const labels: string[] = []
        const map7 = new Map<string, number>()
        days.forEach((d: any) => map7.set(d.date?.slice(0, 10), Number(d.totalRevenue ?? 0)))
        for (let i = 6; i >= 0; i--) {
          const d = new Date(); d.setDate(d.getDate() - i)
          const key = fmt(d)
          labels.push(new Intl.DateTimeFormat('es-BO', { weekday: 'short', day: 'numeric' }).format(d))
          map7.set(key, map7.get(key) ?? 0)
        }
        const values = Array.from(map7.values()).slice(-7)
        return { labels, values }
      }),
      catchError(() => of({ labels: [], values: [] })),
    )
  }

  /** Comparativo mensual 6 meses para gráfico de línea */
  getMonthlySales(clinicId: string): Observable<{ labels: string[]; values: number[] }> {
    const params = new HttpParams().set('clinicId', clinicId)
    return this.http.get<any>(`${this.base}/reports/pharmacy/monthly-comparison`, { params }).pipe(
      map(r => {
        const rows = r?.rows ?? []
        const labels = rows.map((m: any) => {
          const [y, mo] = (m.month as string).split('-')
          return new Intl.DateTimeFormat('es-BO', { month: 'short', year: '2-digit' }).format(new Date(+y, +mo - 1))
        })
        const values = rows.map((m: any) => Number(m.totalRevenue ?? 0))
        return { labels, values }
      }),
      catchError(() => of({ labels: [], values: [] })),
    )
  }

  /** Citas pendientes de hoy (scheduled/confirmed) */
  getPendingAppointmentsCount(): Observable<number> {
    const today = new Date().toISOString().slice(0, 10)
    const params = new HttpParams().set('date', today).set('status', 'scheduled').set('limit', '100')
    return this.http.get<any>(`${this.base}/appointments`, { params }).pipe(
      map(r => {
        const items: any[] = Array.isArray(r) ? r : (r.data ?? r.items ?? [])
        return items.length
      }),
      catchError(() => of(0)),
    )
  }
}
