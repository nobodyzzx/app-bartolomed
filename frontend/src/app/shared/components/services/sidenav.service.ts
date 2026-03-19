import { Injectable, signal } from '@angular/core'
import { toObservable } from '@angular/core/rxjs-interop'

@Injectable({
  providedIn: 'root',
})
export class SidenavService {
  private readonly STORAGE_KEY = 'sidenav-expanded'

  private _isExpanded = signal<boolean>(this.loadState())

  /** Signal nativo — preferir este en componentes nuevos. */
  public isExpanded = this._isExpanded.asReadonly()

  /** Observable para compatibilidad con componentes que aún usan subscribe(). */
  public isExpanded$ = toObservable(this._isExpanded)

  toggleSidenav(): void {
    this._isExpanded.update(v => !v)
    this.saveState()
  }

  setExpanded(expanded: boolean): void {
    this._isExpanded.set(expanded)
    this.saveState()
  }

  getCurrentState(): boolean {
    return this._isExpanded()
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
