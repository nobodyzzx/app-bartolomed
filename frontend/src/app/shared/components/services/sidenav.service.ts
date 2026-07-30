import { Injectable, signal } from '@angular/core'
import { toObservable } from '@angular/core/rxjs-interop'

/** Debe coincidir con el breakpoint `md` de Tailwind (768px), usado en dashboard-layout/navbar/sidebar. */
const DESKTOP_BREAKPOINT_PX = 768

@Injectable({
  providedIn: 'root',
})
export class SidenavService {
  private readonly STORAGE_KEY = 'sidenav-expanded'

  /** Desktop (md+): expandido (ancho completo) vs colapsado (solo iconos). Persistido. */
  private _isExpanded = signal<boolean>(this.loadState())

  /** Mobile (<md): drawer oculto vs abierto. No persistido — cada sesión arranca oculto. */
  private _isMobileOpen = signal<boolean>(false)

  /** Signal nativo — preferir este en componentes nuevos. */
  public isExpanded = this._isExpanded.asReadonly()
  public isMobileOpen = this._isMobileOpen.asReadonly()

  /** Observable para compatibilidad con componentes que aún usan subscribe(). */
  public isExpanded$ = toObservable(this._isExpanded)

  constructor() {
    // Si la ventana cruza a desktop mientras el drawer mobile está abierto, ciérralo
    // para no dejarlo "abierto" de forma inconsistente si vuelve a mobile después.
    window.addEventListener('resize', () => {
      if (this.isDesktopViewport() && this._isMobileOpen()) {
        this._isMobileOpen.set(false)
      }
    })
  }

  /** Alterna el estado relevante según el viewport actual: colapsar (desktop) o abrir/cerrar el drawer (mobile). */
  toggleSidenav(): void {
    if (this.isDesktopViewport()) {
      this._isExpanded.update(v => !v)
      this.saveState()
    } else {
      this._isMobileOpen.update(v => !v)
    }
  }

  setExpanded(expanded: boolean): void {
    this._isExpanded.set(expanded)
    this.saveState()
  }

  closeMobile(): void {
    this._isMobileOpen.set(false)
  }

  getCurrentState(): boolean {
    return this._isExpanded()
  }

  private isDesktopViewport(): boolean {
    return window.innerWidth >= DESKTOP_BREAKPOINT_PX
  }

  private loadState(): boolean {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY)
      return saved !== null ? JSON.parse(saved) : true
    } catch {
      return true
    }
  }

  private saveState(): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this._isExpanded()))
  }
}
