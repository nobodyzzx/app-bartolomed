import { Injectable, signal, Signal } from '@angular/core'
import { toSignal } from '@angular/core/rxjs-interop'
import { SidenavService } from '../../shared/components/services/sidenav.services'
import { MENU_ITEMS } from '../constants/menu-items'
import { MenuItem } from '../interfaces/menu-item.interface'

@Injectable({ providedIn: 'root' })
export class SidebarService {
  // Exponer estado de expansión como signal
  public isExpanded!: Signal<boolean>

  // Menú completo como signal
  public menuItems = signal<MenuItem[]>(MENU_ITEMS)

  constructor(private sidenavService: SidenavService) {
    this.isExpanded = toSignal(this.sidenavService.isExpanded$, { initialValue: true })
  }
}
