import { Injectable } from '@angular/core'
import { MatPaginatorIntl } from '@angular/material/paginator'

/**
 * Textos del paginador de Material, en español.
 *
 * Sin esto, `<mat-paginator>` usa los suyos en inglés ("Items per page", "of")
 * y quedaban a la vista en las seis pantallas que lo usan —pacientes, clínicas,
 * auditoría, expedientes, órdenes de compra e inventario de farmacia— dentro de
 * una aplicación por lo demás íntegramente en español.
 *
 * `LOCALE_ID: 'es-BO'` no lo cubre: ese ajuste alcanza a las tuberías de fecha,
 * número y moneda, no a las cadenas propias de los componentes de Material,
 * que se sustituyen proveyendo esta clase.
 */
@Injectable()
export class SpanishPaginatorIntl extends MatPaginatorIntl {
  override itemsPerPageLabel = 'Filas por página'
  override nextPageLabel = 'Página siguiente'
  override previousPageLabel = 'Página anterior'
  override firstPageLabel = 'Primera página'
  override lastPageLabel = 'Última página'

  /**
   * "1 – 50 de 503". Material recalcula el fin real para la última página, que
   * casi nunca está completa; sin ese `Math.min` la última diría "501 – 550 de
   * 503".
   */
  override getRangeLabel = (page: number, pageSize: number, length: number): string => {
    if (length === 0 || pageSize === 0) return `0 de ${length}`

    const total = Math.max(length, 0)
    const desde = page * pageSize
    const hasta = Math.min(desde + pageSize, total)

    return `${desde + 1} – ${hasta} de ${total}`
  }
}
