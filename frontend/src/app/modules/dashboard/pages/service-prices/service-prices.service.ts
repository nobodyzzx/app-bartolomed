import { HttpClient, HttpParams } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { AlertService } from '@core/services/alert.service'
import { Observable, throwError } from 'rxjs'
import { catchError, tap } from 'rxjs/operators'
import { environment } from '../../../../environments/environments'
import { ErrorService } from '../../../../shared/components/services/error.service'

export enum ServiceCategory {
  CONSULTATION = 'consultation',
  LABORATORY = 'laboratory',
  /**
   * Estudios especiales: ecografía, colonoscopía, electrocardiograma. Van
   * aparte de `PROCEDURE` porque aquello son prácticas terapéuticas y esto son
   * estudios diagnósticos, con su propio módulo, su rol y su informe.
   */
  SPECIAL_STUDY = 'special_study',
  PROCEDURE = 'procedure',
  OTHER = 'other',
}

/** Espejo de `AppointmentType` del backend: liga la tarifa al tipo de cita. */
export enum AppointmentType {
  CONSULTATION = 'consultation',
  FOLLOW_UP = 'follow_up',
  EMERGENCY = 'emergency',
  SURGERY = 'surgery',
  LABORATORY = 'laboratory',
  IMAGING = 'imaging',
  VACCINATION = 'vaccination',
  THERAPY = 'therapy',
  OTHER = 'other',
}

export interface ServicePrice {
  id: string
  code: string
  name: string
  description: string | null
  category: ServiceCategory
  appointmentType: AppointmentType | null
  price: number
  /** Lo que cuesta el estudio derivado al laboratorio externo. Nulo si no se deriva. */
  costPrice: number | null
  labCategory: string | null
  turnaroundMinDays: number | null
  turnaroundMaxDays: number | null
  turnaroundNote: string | null
  isActive: boolean
  requiresConsent: boolean
  clinicId: string
  createdAt: string
  updatedAt: string
}

/** Lo justo para elegir un servicio del tarifario y referenciarlo. */
export interface ServicePriceCatalogItem {
  id: string
  code: string
  name: string
  category: ServiceCategory
  price: number
  /** Categoría clínica del estudio (`HEMATOLOGIA`…), para agrupar el catálogo. */
  labCategory?: string | null
  turnaroundMinDays?: number | null
  turnaroundMaxDays?: number | null
  /** Entregas que no se expresan en días; manda sobre los días si viene. */
  turnaroundNote?: string | null
  /** ¿El estudio exige consentimiento informado firmado? (colonoscopía sí). */
  requiresConsent?: boolean
}

/** Nombre legible de cada categoría clínica, en el orden del tarifario. */
export const LAB_CATEGORY_LABELS: Record<string, string> = {
  HEMATOLOGIA: 'Hematología',
  COAGULACION: 'Coagulación',
  QUIMICA_SANGUINEA: 'Química sanguínea',
  MARCADORES_TUMORALES: 'Marcadores tumorales',
  HORMONAS: 'Hormonas',
  INMUNOLOGIA_PRUEBAS_RAPIDAS: 'Inmunología y pruebas rápidas',
  ORINA: 'Orina',
  HECES_FECALES: 'Heces fecales',
  BACTERIOLOGIA: 'Bacteriología',
  BIOLOGIA_MOLECULAR: 'Biología molecular y otros',
}

const LAB_CATEGORY_ORDER = Object.keys(LAB_CATEGORY_LABELS)

export function labCategoryLabel(code: string | null | undefined): string {
  if (!code) return 'Otros estudios'
  return LAB_CATEGORY_LABELS[code] ?? code
}

export function labCategoryRank(code: string | null | undefined): number {
  const i = LAB_CATEGORY_ORDER.indexOf(code ?? '')
  return i === -1 ? LAB_CATEGORY_ORDER.length : i
}

/** "En el día", "1 a 3 días"… para decirle al paciente cuándo estará listo. */
export function turnaroundLabel(item: ServicePriceCatalogItem): string {
  if (item.turnaroundNote) return item.turnaroundNote
  const { turnaroundMinDays: min, turnaroundMaxDays: max } = item
  if (min === null || min === undefined) return ''
  if (min === 0 && (max ?? 0) === 0) return 'En el día'
  if (min === max) return min === 1 ? 'Al día siguiente' : `${min} días`
  return `${min} a ${max} días`
}

export interface ServicePricePayload {
  /** Opcional al crear: si se omite, el backend genera el siguiente libre. */
  code?: string
  name: string
  description?: string
  category: ServiceCategory
  appointmentType?: AppointmentType | null
  price: number
  /** Costo de convenio. Si no se envía, el backend deja el que ya estaba. */
  costPrice?: number
  isActive?: boolean
  /** ¿El estudio exige consentimiento informado firmado? */
  requiresConsent?: boolean
}

/** Un precio que cambiaría (o cambió) al aplicar un margen en bloque. */
export interface MarginChange {
  id: string
  code: string
  name: string
  labCategory: string | null
  costPrice: number
  priceFrom: number
  priceTo: number
  /** Margen que queda tras redondear, que es el que se cobra de verdad. */
  effectiveMarginPct: number
}

export interface ApplyMarginResult {
  /** `false` cuando fue una vista previa. */
  applied: boolean
  affected: number
  scanned: number
  changes: MarginChange[]
}

export interface ApplyMarginPayload {
  labCategory?: string
  marginPct: number
  roundTo?: number
  dryRun?: boolean
}

export interface ServicePriceListFilter {
  category?: ServiceCategory
  search?: string
  isActive?: string
  page?: number
  pageSize?: number
}

export interface ServicePriceListResponse {
  items: ServicePrice[]
  total: number
  page: number
  pageSize: number
}

export const CATEGORY_LABELS: Record<ServiceCategory, string> = {
  [ServiceCategory.CONSULTATION]: 'Consulta',
  [ServiceCategory.LABORATORY]: 'Laboratorio',
  [ServiceCategory.SPECIAL_STUDY]: 'Estudio especial',
  [ServiceCategory.PROCEDURE]: 'Procedimiento',
  [ServiceCategory.OTHER]: 'Otro',
}

export const APPOINTMENT_TYPE_LABELS: Record<AppointmentType, string> = {
  [AppointmentType.CONSULTATION]: 'Consulta',
  [AppointmentType.FOLLOW_UP]: 'Seguimiento',
  [AppointmentType.EMERGENCY]: 'Emergencia',
  [AppointmentType.SURGERY]: 'Cirugía',
  [AppointmentType.LABORATORY]: 'Laboratorio',
  [AppointmentType.IMAGING]: 'Imagenología',
  [AppointmentType.VACCINATION]: 'Vacunación',
  [AppointmentType.THERAPY]: 'Terapia',
  [AppointmentType.OTHER]: 'Otro',
}

@Injectable({ providedIn: 'root' })
export class ServicePricesService {
  private readonly base = `${environment.baseUrl}/service-prices`

  constructor(
    private http: HttpClient,
    private errorService: ErrorService,
    private alert: AlertService,
  ) {}

  list(filter: ServicePriceListFilter = {}): Observable<ServicePriceListResponse> {
    let params = new HttpParams()
    Object.entries(filter).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value))
      }
    })

    return this.http.get<ServicePriceListResponse>(this.base, { params }).pipe(
      catchError(err => {
        this.errorService.handleError(err)
        return throwError(() => err)
      }),
    )
  }

  /**
   * Catálogo para elegir un servicio al pedirlo (el estudio de una orden de
   * laboratorio, por ejemplo). Va aparte de `list()` porque aquel exige
   * `billing.read`, que un médico no tiene: este acepta además `lab.order`.
   */
  catalog(category?: ServicePriceCatalogItem['category']): Observable<ServicePriceCatalogItem[]> {
    let params = new HttpParams()
    if (category) params = params.set('category', category)

    return this.http
      .get<ServicePriceCatalogItem[]>(`${this.base}/catalog`, { params })
      .pipe(
        catchError(err => {
          this.errorService.handleError(err)
          return throwError(() => err)
        }),
      )
  }

  create(payload: ServicePricePayload): Observable<ServicePrice> {
    return this.http.post<ServicePrice>(this.base, payload).pipe(
      tap(() => this.alert.success('Éxito', 'Servicio agregado al tarifario')),
      catchError(err => {
        this.errorService.handleError(err)
        return throwError(() => err)
      }),
    )
  }

  update(id: string, payload: Partial<ServicePricePayload>): Observable<ServicePrice> {
    return this.http.patch<ServicePrice>(`${this.base}/${id}`, payload).pipe(
      tap(() => this.alert.success('Éxito', 'Servicio actualizado')),
      catchError(err => {
        this.errorService.handleError(err)
        return throwError(() => err)
      }),
    )
  }

  /**
   * Recalcula precios en bloque desde el margen. Con `dryRun` solo devuelve la
   * vista previa; el aviso de éxito se reserva para la aplicación real.
   */
  applyMargin(payload: ApplyMarginPayload): Observable<ApplyMarginResult> {
    return this.http.post<ApplyMarginResult>(`${this.base}/apply-margin`, payload).pipe(
      tap(res => {
        if (!payload.dryRun) {
          this.alert.success('Precios actualizados', `Se recalcularon ${res.affected} servicio(s)`)
        }
      }),
      catchError(err => {
        this.errorService.handleError(err)
        return throwError(() => err)
      }),
    )
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`).pipe(
      tap(() => this.alert.success('Eliminado', 'Servicio dado de baja del tarifario')),
      catchError(err => {
        this.errorService.handleError(err)
        return throwError(() => err)
      }),
    )
  }
}
