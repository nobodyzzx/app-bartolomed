import { Component, EventEmitter, inject, Input, OnInit, Output } from '@angular/core'
import { Router } from '@angular/router'
import { MenuItem } from '@core/interfaces/menu-item.interface'

@Component({
    selector: 'sidebar-menu-item',
    templateUrl: './sidebar-menu-item.component.html',
    standalone: false
})
export class SidebarMenuItemComponent implements OnInit {
  @Input() item!: MenuItem
  @Input() isExpanded = true
  @Input() isDemo = false
  @Output() demoClick = new EventEmitter<void>()

  private router = inject(Router)

  /** Grupo abierto/cerrado (modo expandido). Arranca abierto solo si contiene la ruta activa. */
  isOpen = false

  ngOnInit(): void {
    this.isOpen = this.isParentActive
  }

  toggleGroup(): void {
    this.isOpen = !this.isOpen
  }

  get hasChildren(): boolean {
    return !!this.item.children?.length
  }

  trackByLabel(_index: number, item: MenuItem): string {
    return item.label
  }

  get isLeafActive(): boolean {
    if (this.hasChildren) return false
    return !!this.item.route && this.router.url.startsWith(this.item.route)
  }

  get isParentActive(): boolean {
    if (!this.hasChildren) return false
    const url = this.router.url
    return this.item.children!.some(child => child.route && url.startsWith(child.route))
  }

  isChildActive(child: MenuItem): boolean {
    return !!child.route && this.router.url.startsWith(child.route)
  }
}
