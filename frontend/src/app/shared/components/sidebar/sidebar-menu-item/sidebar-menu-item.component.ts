import { Component, EventEmitter, inject, Input, Output } from '@angular/core'
import { Router } from '@angular/router'
import { MenuItem } from '@core/interfaces/menu-item.interface'

@Component({
  selector: 'sidebar-menu-item',
  templateUrl: './sidebar-menu-item.component.html',
})
export class SidebarMenuItemComponent {
  @Input() item!: MenuItem
  @Input() isExpanded = true
  @Input() isDemo = false
  @Output() demoClick = new EventEmitter<void>()

  private router = inject(Router)

  get hasChildren(): boolean {
    return !!this.item.children?.length
  }

  trackByLabel(_index: number, item: MenuItem): string {
    return item.label
  }

  get isParentActive(): boolean {
    if (!this.hasChildren) return false
    const url = this.router.url
    return this.item.children!.some(child => child.route && url.startsWith(child.route))
  }
}
