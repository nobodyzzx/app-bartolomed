import { Injectable } from '@angular/core'
import { BehaviorSubject } from 'rxjs'

@Injectable({
  providedIn: 'root',
})
export class SidenavService {
  private readonly STORAGE_KEY = 'sidenav-expanded'
  private isExpandedSource: BehaviorSubject<boolean>
  isExpanded$

  constructor() {
    // Leer el estado del localStorage o usar true por defecto
    const savedState = localStorage.getItem(this.STORAGE_KEY)
    const initialState = savedState !== null ? JSON.parse(savedState) : true

    console.log('[SidenavService] Inicializando con estado:', initialState)

    this.isExpandedSource = new BehaviorSubject<boolean>(initialState)
    this.isExpanded$ = this.isExpandedSource.asObservable()
  }

  toggleSidenav() {
    const newState = !this.isExpandedSource.value
    console.log('[SidenavService] Toggle:', this.isExpandedSource.value, '→', newState)
    this.isExpandedSource.next(newState)
    // Guardar el estado en localStorage
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(newState))
  }

  setExpanded(expanded: boolean) {
    console.log('[SidenavService] setExpanded:', expanded)
    this.isExpandedSource.next(expanded)
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(expanded))
  }

  getCurrentState(): boolean {
    return this.isExpandedSource.value
  }
}
