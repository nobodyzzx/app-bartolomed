import { Injectable, inject } from '@angular/core'
import { ActivatedRoute, NavigationEnd, Params, Router } from '@angular/router'
import { filter } from 'rxjs/operators'
import { SortDir } from '../utils/table-sort.util'

/**
 * Lo que define la vista de un listado: qué se busca, por dónde se va y cómo
 * está ordenado. Los filtros propios de cada pantalla —estado, categoría,
 * tarjeta activa— entran por el índice suelto.
 */
export interface EstadoListado {
  q?: string
  page?: number
  size?: number
  sort?: string
  dir?: SortDir
  [filtro: string]: string | number | undefined
}

/**
 * Conserva la vista de un listado cuando se entra a una ficha y se vuelve.
 *
 * El problema: al abrir un registro Angular destruye el componente del
 * listado, y al volver se construye otro con el buscador vacío y en la página
 * 1. En una lista de 350 duele — filtras, avanzas a la página 12, corriges un
 * expediente y apareces al principio de todo.
 *
 * Se guarda en memoria y **además** se refleja en la URL. Lo segundo hace que
 * un listado filtrado se pueda compartir por enlace y sobreviva a recargar;
 * lo primero es lo que de verdad resuelve la vuelta, porque hay 37 sitios en
 * la aplicación que navegan al listado por su ruta pelada —`router.navigate(
 * ['/dashboard/patients'])`— y esos llegan sin ningún parámetro. Tocar los 37
 * sería frágil y se rompería con el primero que se añada.
 *
 * Solo se restaura al **volver de una ficha**: entrar al listado desde el menú
 * enseña la lista entera, que es lo que se espera al pulsar "Pacientes".
 */
@Injectable({ providedIn: 'root' })
export class ListStateService {
  private readonly router = inject(Router)
  private readonly estados = new Map<string, EstadoListado>()

  /** URL en la que se estaba antes de la actual. */
  private urlAnterior = ''
  private urlActual = ''

  /**
   * Marca de que el próximo cambio de parámetros lo provoca `reflejarEnUrl` y
   * no una navegación del usuario.
   */
  private escrituraPropia = false

  constructor() {
    this.urlActual = this.router.url
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(e => {
        this.urlAnterior = this.urlActual
        this.urlActual = e.urlAfterRedirects
      })
  }

  guardar(ruta: string, estado: EstadoListado): void {
    this.estados.set(ruta, { ...estado })
  }

  olvidar(ruta: string): void {
    this.estados.delete(ruta)
  }

  /**
   * El estado guardado, solo si se viene de una ficha de este mismo listado.
   *
   * Volver de **crear** no restaura: el registro recién dado de alta puede no
   * cumplir el filtro y parecería que no se guardó. Volver de **editar** sí,
   * que es donde se pierde el sitio.
   */
  recuperarSiVuelve(ruta: string): EstadoListado | undefined {
    const anterior = this.urlAnterior.split('?')[0]
    const esHija = anterior.startsWith(`${ruta}/`)
    if (!esHija) return undefined

    if (anterior.endsWith('/new')) {
      this.olvidar(ruta)
      return undefined
    }

    return this.estados.get(ruta)
  }

  /**
   * Deja el estado en la barra de direcciones sin apilar historial: cada letra
   * tecleada en el buscador crearía una entrada, y el botón "atrás" tendría que
   * pulsarse una vez por carácter para salir de la pantalla.
   */
  reflejarEnUrl(route: ActivatedRoute, estado: EstadoListado): void {
    this.escrituraPropia = true
    this.router.navigate([], {
      relativeTo: route,
      queryParams: aParams(estado),
      // `merge` y no reemplazo: hay pantallas a las que se llega con un
      // parámetro de fuera (`?patientId=…`) que no es suyo y no debe borrarse.
      queryParamsHandling: 'merge',
      replaceUrl: true,
    })
  }

  /**
   * ¿El cambio de parámetros que se está atendiendo lo escribió esta pantalla?
   *
   * Una pantalla que escucha `queryParamMap` para recargar entra en bucle sin
   * esto: reflejar la vista cambia los parámetros, eso despierta la suscripción,
   * la recarga reasigna los datos y el paginador se va a la primera página. Se
   * veía como que avanzar de página no hacía nada — la URL decía `page=2` y la
   * tabla seguía en «1 – 10 de 18».
   *
   * Se consume: solo el primer preguntón se lleva el `true`.
   */
  consumirEscrituraPropia(): boolean {
    const propia = this.escrituraPropia
    this.escrituraPropia = false
    return propia
  }
}

/** Descarta lo vacío: un `?q=&page=1&dir=` no dice nada y ensucia el enlace. */
export function aParams(estado: EstadoListado): Params {
  const params: Params = {}
  for (const [clave, valor] of Object.entries(estado)) {
    if (valor === undefined || valor === null || valor === '') continue
    // La página 1 y el orden vacío son el estado por defecto: no se escriben.
    if (clave === 'page' && Number(valor) <= 1) continue
    params[clave] = String(valor)
  }
  return params
}

/** Lee de la URL lo que se pueda; lo que no venga se queda sin definir. */
export function deParams(params: Params): EstadoListado {
  const estado: EstadoListado = {}
  if (params['q']) estado.q = String(params['q'])
  if (params['page']) estado.page = Number(params['page']) || 1
  if (params['size']) estado.size = Number(params['size']) || undefined
  if (params['sort']) estado.sort = String(params['sort'])
  if (params['dir'] === 'asc' || params['dir'] === 'desc') estado.dir = params['dir']
  return estado
}
