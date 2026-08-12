import { TestBed } from '@angular/core/testing'
import { NavigationEnd, Router } from '@angular/router'
import { Subject } from 'rxjs'
import { aParams, deParams, ListStateService } from './list-state.service'

const RUTA = '/dashboard/patients'

describe('ListStateService', () => {
  let service: ListStateService
  let events$: Subject<NavigationEnd>

  /** Simula haber navegado por `urls` en ese orden. */
  function navegar(...urls: string[]): void {
    let id = 1
    for (const url of urls) {
      events$.next(new NavigationEnd(id++, url, url))
    }
  }

  beforeEach(() => {
    events$ = new Subject<NavigationEnd>()

    TestBed.configureTestingModule({
      providers: [
        ListStateService,
        { provide: Router, useValue: { url: '/', events: events$.asObservable(), navigate: () => Promise.resolve(true) } },
      ],
    })

    service = TestBed.inject(ListStateService)
  })

  describe('recuperarSiVuelve', () => {
    /**
     * El caso que motivó todo esto: filtras, avanzas de página, entras a
     * corregir un registro y al volver estabas al principio de la lista sin
     * filtro, porque Angular destruye el componente al navegar.
     */
    it('devuelve el estado al volver de una ficha del listado', () => {
      service.guardar(RUTA, { q: 'cefalea', page: 12 })
      navegar(RUTA, `${RUTA}/edit/abc`, RUTA)

      expect(service.recuperarSiVuelve(RUTA)).toEqual({ q: 'cefalea', page: 12 })
    })

    /** Entrar por el menú enseña la lista entera, que es lo que se espera. */
    it('no restaura al entrar desde otra parte de la aplicación', () => {
      service.guardar(RUTA, { q: 'cefalea' })
      navegar('/dashboard/appointments', RUTA)

      expect(service.recuperarSiVuelve(RUTA)).toBeUndefined()
    })

    /**
     * El registro recién dado de alta puede no cumplir el filtro, y entonces
     * parecería que no se guardó.
     */
    it('al volver de crear, olvida el filtro', () => {
      service.guardar(RUTA, { q: 'cefalea' })
      navegar(RUTA, `${RUTA}/new`, RUTA)

      expect(service.recuperarSiVuelve(RUTA)).toBeUndefined()
    })

    it('y no lo devuelve tampoco en la siguiente vuelta: se olvidó de verdad', () => {
      service.guardar(RUTA, { q: 'cefalea' })
      navegar(RUTA, `${RUTA}/new`, RUTA)
      service.recuperarSiVuelve(RUTA)

      navegar(`${RUTA}/edit/abc`, RUTA)

      expect(service.recuperarSiVuelve(RUTA)).toBeUndefined()
    })

    it('sin nada guardado no inventa un estado', () => {
      navegar(RUTA, `${RUTA}/edit/abc`, RUTA)

      expect(service.recuperarSiVuelve(RUTA)).toBeUndefined()
    })

    /** `/dashboard/patients-archived` no es una ficha de `/dashboard/patients`. */
    it('no confunde otra ruta que empiece igual con una ficha propia', () => {
      service.guardar(RUTA, { q: 'cefalea' })
      navegar(RUTA, '/dashboard/patients-archived', RUTA)

      expect(service.recuperarSiVuelve(RUTA)).toBeUndefined()
    })

    it('ignora los parámetros al decidir de dónde se viene', () => {
      service.guardar(RUTA, { q: 'cefalea' })
      navegar(RUTA, `${RUTA}/view/abc?from=list`, RUTA)

      expect(service.recuperarSiVuelve(RUTA)).toEqual({ q: 'cefalea' })
    })

    it('guarda una copia: cambiar el objeto después no altera lo guardado', () => {
      const estado = { q: 'cefalea' }
      service.guardar(RUTA, estado)
      estado.q = 'otra cosa'
      navegar(RUTA, `${RUTA}/edit/abc`, RUTA)

      expect(service.recuperarSiVuelve(RUTA)).toEqual({ q: 'cefalea' })
    })
  })

  describe('aParams', () => {
    it('descarta lo vacío para no ensuciar el enlace', () => {
      expect(aParams({ q: '', sort: undefined, dir: '' as never, page: 3 })).toEqual({ page: '3' })
    })

    /** La página 1 es el estado por defecto: escribirla no aporta nada. */
    it('no escribe la primera página', () => {
      expect(aParams({ page: 1, q: 'ana' })).toEqual({ q: 'ana' })
    })

    it('conserva los filtros propios de cada pantalla', () => {
      expect(aParams({ vista: 'enDesuso', categoria: 'insumos' })).toEqual({
        vista: 'enDesuso',
        categoria: 'insumos',
      })
    })
  })

  describe('deParams', () => {
    it('lee lo que venga en la URL', () => {
      expect(deParams({ q: 'ana', page: '3', sort: 'name', dir: 'desc' })).toEqual({
        q: 'ana',
        page: 3,
        sort: 'name',
        dir: 'desc',
      })
    })

    it('un sentido que no existe se ignora en vez de romper el orden', () => {
      expect(deParams({ dir: 'lo-que-sea' }).dir).toBeUndefined()
    })

    it('una página que no es número cae en la primera', () => {
      expect(deParams({ page: 'abc' }).page).toBe(1)
    })
  })
})
