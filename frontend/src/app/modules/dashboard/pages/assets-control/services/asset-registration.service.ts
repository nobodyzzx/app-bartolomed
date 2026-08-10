import { HttpClient, HttpParams } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { Observable, forkJoin, of, throwError } from 'rxjs'
import { catchError, map, switchMap, tap } from 'rxjs/operators'
import { AlertService } from '../../../../../core/services/alert.service'
import { environment } from '../../../../../environments/environments'
import { ErrorService } from '../../../../../shared/components/services/error.service'
import { AssetFilters, BaseAsset, CreateAssetDto, PaginatedResult } from '../interfaces/assets.interfaces'

export interface AssetStats {
  total: number
  active: number
  inactive: number
  maintenance: number
  retired: number
  totalValue: number
  currentValue: number
  totalDepreciation: number
  underWarranty: number
  maintenanceDue: number
  byType: Record<string, number>
  byCondition: Record<string, number>
}

@Injectable({
  providedIn: 'root',
})
export class AssetRegistrationService {
  private apiUrl = `${environment.baseUrl}/assets`

  constructor(
    private http: HttpClient,
    private errorService: ErrorService,
    private alertService: AlertService,
  ) {}

  private handleHttpError = (error: any): Observable<never> => {
    this.errorService.handleError(error)
    return throwError(() => error)
  }

  getAssets(filters?: AssetFilters, page = 1, limit = 25): Observable<PaginatedResult<BaseAsset>> {
    let params = new HttpParams().set('page', page.toString()).set('limit', limit.toString())

    if (filters) {
      if (filters.status) params = params.set('status', filters.status)
      if (filters.type) params = params.set('type', filters.type)
      if (filters.location) params = params.set('location', filters.location)
      if (filters.manufacturer) params = params.set('manufacturer', filters.manufacturer)
      if (filters.condition) params = params.set('condition', filters.condition)
      if (filters.search) params = params.set('search', filters.search)
    }

    return this.http
      .get<PaginatedResult<BaseAsset>>(this.apiUrl, { params })
      .pipe(catchError(this.handleHttpError))
  }

  /**
   * Trae el inventario **completo**, no la primera página.
   *
   * `getAssets()` sin argumentos pide 25 filas, y el listado las metía en un
   * paginador de cliente: con el inventario cargado, la pantalla mostraba 25, el
   * buscador buscaba entre esos 25 y los contadores contaban 25. El resto era
   * inalcanzable.
   *
   * Se pide de a 100 —el tope que acepta `FilterAssetsDto`— y se completa según
   * el `total` que devuelve la primera página.
   */
  getAllAssets(filters?: AssetFilters): Observable<BaseAsset[]> {
    const TAM = 100
    // Tope de seguridad: si el inventario creciera a decenas de miles, es
    // preferible mostrar los primeros 5.000 que disparar 200 peticiones.
    const MAX_PAGINAS = 50

    return this.getAssets(filters, 1, TAM).pipe(
      switchMap(primera => {
        const paginas = Math.min(Math.ceil((primera.total ?? 0) / TAM), MAX_PAGINAS)
        if (paginas <= 1) return of(primera.data)
        const resto = Array.from({ length: paginas - 1 }, (_, i) => this.getAssets(filters, i + 2, TAM))
        return forkJoin(resto).pipe(map(rs => [primera.data, ...rs.map(r => r.data)].flat()))
      }),
    )
  }

  getAssetById(id: string): Observable<BaseAsset> {
    return this.http.get<BaseAsset>(`${this.apiUrl}/${id}`).pipe(catchError(this.handleHttpError))
  }

  createAsset(assetData: CreateAssetDto): Observable<BaseAsset> {
    return this.http.post<BaseAsset>(this.apiUrl, assetData).pipe(
      tap(() => {
        this.alertService.success('Éxito', 'Activo creado correctamente')
      }),
      catchError(this.handleHttpError),
    )
  }

  updateAsset(id: string, assetData: Partial<CreateAssetDto>): Observable<BaseAsset> {
    return this.http.patch<BaseAsset>(`${this.apiUrl}/${id}`, assetData).pipe(
      tap(() => {
        this.alertService.success('Éxito', 'Activo actualizado correctamente')
      }),
      catchError(this.handleHttpError),
    )
  }

  deleteAsset(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(catchError(this.handleHttpError))
  }

  // Valores únicos para dropdowns
  getAssetTypes(): Observable<string[]> {
    return this.http
      .get<string[]>(`${this.apiUrl}/unique/type`)
      .pipe(catchError(this.handleHttpError))
  }

  getManufacturers(): Observable<string[]> {
    return this.http
      .get<string[]>(`${this.apiUrl}/unique/manufacturer`)
      .pipe(catchError(this.handleHttpError))
  }

  getLocations(): Observable<string[]> {
    return this.http
      .get<string[]>(`${this.apiUrl}/unique/location`)
      .pipe(catchError(this.handleHttpError))
  }

  getCategories(): Observable<string[]> {
    return this.http
      .get<string[]>(`${this.apiUrl}/unique/category`)
      .pipe(catchError(this.handleHttpError))
  }

  // Validaciones
  validateSerialNumber(serialNumber: string, excludeId?: string): Observable<boolean> {
    let params = new HttpParams()
    if (excludeId) {
      params = params.set('excludeId', excludeId)
    }

    return this.http
      .get<boolean>(`${this.apiUrl}/validate-serial/${serialNumber}`, {
        params,
      })
      .pipe(catchError(this.handleHttpError))
  }

  // Estadísticas
  getAssetStats(): Observable<AssetStats> {
    return this.http.get<AssetStats>(`${this.apiUrl}/stats`).pipe(catchError(this.handleHttpError))
  }
}
