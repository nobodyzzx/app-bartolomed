import { HttpClient } from '@angular/common/http'
import { Injectable, inject } from '@angular/core'
import { Observable, throwError } from 'rxjs'
import { catchError, tap } from 'rxjs/operators'
import { AlertService } from '../../../../../core/services/alert.service'
import { environment } from '../../../../../environments/environments'
import { ErrorService } from '../../../../../shared/components/services/error.service'
import { openPdfInNewTab } from '../../../../../shared/utils/pdf-viewer.util'
import {
  AssetMovement,
  InventoryCount,
  MoveAssetDto,
  TargetClinic,
} from '../interfaces/assets.interfaces'

/**
 * Movimientos entre ambientes y tomas de inventario: las dos cosas que cierran
 * el ciclo del conteo en papel.
 */
@Injectable({ providedIn: 'root' })
export class InventoryCountsService {
  private readonly http = inject(HttpClient)
  private readonly errorService = inject(ErrorService)
  private readonly alert = inject(AlertService)

  private readonly apiUrl = `${environment.baseUrl}/assets`

  private handleHttpError = (error: any): Observable<never> => {
    this.errorService.handleError(error)
    return throwError(() => error)
  }

  // ─── Movimientos ──────────────────────────────────────────────────────────

  move(assetId: string, dto: MoveAssetDto): Observable<AssetMovement> {
    return this.http.post<AssetMovement>(`${this.apiUrl}/${assetId}/move`, dto).pipe(
      tap(m =>
        this.alert.success(
          'Movido',
          // Cruzando de clínica se nombra: es un cambio de inventario, no un
          // cambio de cuarto, y conviene que quede claro en el aviso.
          m.toClinic
            ? `${m.quantity} unidad(es) a ${m.toLocation}, en ${m.toClinic.name}`
            : `${m.quantity} unidad(es) a ${m.toLocation}`,
        ),
      ),
      catchError(this.handleHttpError),
    )
  }

  /** Clínicas a las que se puede mandar un ítem, con sus ambientes. */
  getTargetClinics(): Observable<TargetClinic[]> {
    return this.http
      .get<TargetClinic[]>(`${this.apiUrl}/movements/target-clinics`)
      .pipe(catchError(this.handleHttpError))
  }

  getMovements(location?: string): Observable<{ data: AssetMovement[]; total: number }> {
    const query = location ? `?location=${encodeURIComponent(location)}` : ''
    return this.http
      .get<{ data: AssetMovement[]; total: number }>(`${this.apiUrl}/movements${query}`)
      .pipe(catchError(this.handleHttpError))
  }

  getAssetMovements(assetId: string): Observable<AssetMovement[]> {
    return this.http
      .get<AssetMovement[]>(`${this.apiUrl}/${assetId}/movements`)
      .pipe(catchError(this.handleHttpError))
  }

  // ─── Conteos ──────────────────────────────────────────────────────────────

  start(location?: string, notes?: string): Observable<InventoryCount> {
    return this.http.post<InventoryCount>(`${this.apiUrl}/counts`, { location, notes }).pipe(
      tap(c => this.alert.success('Conteo abierto', `${c.countNumber} — ${c.items?.length ?? 0} ítems`)),
      catchError(this.handleHttpError),
    )
  }

  list(): Observable<InventoryCount[]> {
    return this.http.get<InventoryCount[]>(`${this.apiUrl}/counts`).pipe(catchError(this.handleHttpError))
  }

  get(id: string): Observable<InventoryCount> {
    return this.http
      .get<InventoryCount>(`${this.apiUrl}/counts/${id}`)
      .pipe(catchError(this.handleHttpError))
  }

  /** Guarda las unidades halladas. Se puede llamar varias veces. */
  saveCounted(
    id: string,
    items: Array<{ itemId: string; countedQuantity: number; notes?: string }>,
  ): Observable<InventoryCount> {
    return this.http
      .patch<InventoryCount>(`${this.apiUrl}/counts/${id}/items`, { items })
      .pipe(catchError(this.handleHttpError))
  }

  close(id: string, adjustInventory: boolean, notes?: string): Observable<InventoryCount> {
    return this.http
      .post<InventoryCount>(`${this.apiUrl}/counts/${id}/close`, { adjustInventory, notes })
      .pipe(
        tap(() =>
          this.alert.success(
            'Conteo cerrado',
            adjustInventory ? 'El inventario quedó ajustado a lo contado' : 'Registrado sin ajustar el inventario',
          ),
        ),
        catchError(this.handleHttpError),
      )
  }

  cancel(id: string): Observable<InventoryCount> {
    return this.http
      .post<InventoryCount>(`${this.apiUrl}/counts/${id}/cancel`, {})
      .pipe(catchError(this.handleHttpError))
  }

  /** Acta de diferencias, para archivar firmada. */
  downloadAct(count: InventoryCount): Observable<Blob> {
    return this.http
      .get(`${this.apiUrl}/counts/${count.id}/act`, { responseType: 'blob' })
      .pipe(
        tap(blob => openPdfInNewTab(blob, `acta-conteo-${count.countNumber}.pdf`)),
        catchError(this.handleHttpError),
      )
  }
}
