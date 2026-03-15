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

    this.isExpandedSource = new BehaviorSubject<boolean>(initialState)
    this.isExpanded$ = this.isExpandedSource.asObservable()
  }

  toggleSidenav() {
    const newState = !this.isExpandedSource.value
    this.isExpandedSource.next(newState)
    // Guardar el estado en localStorage
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(newState))
  }

  setExpanded(expanded: boolean) {
    this.isExpandedSource.next(expanded)
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(expanded))
  }

  getCurrentState(): boolean {
    return this.isExpandedSource.value
  }
}
