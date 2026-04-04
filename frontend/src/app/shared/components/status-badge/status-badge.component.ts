import { CommonModule } from '@angular/common'
import { Component, Input } from '@angular/core'

export type BadgeColor = 'blue' | 'green' | 'red' | 'amber' | 'purple' | 'slate' | 'indigo' | 'pink' | 'orange'

// Clases completas para que el scanner de Tailwind las detecte
const BADGE_CLASSES: Record<BadgeColor, string> = {
  blue:   'bg-blue-100 text-blue-800',
  green:  'bg-green-100 text-green-800',
  red:    'bg-red-100 text-red-800',
  amber:  'bg-amber-100 text-amber-800',
  purple: 'bg-purple-100 text-purple-800',
  slate:  'bg-slate-100 text-slate-700',
  indigo: 'bg-indigo-100 text-indigo-800',
  pink:   'bg-pink-100 text-pink-800',
  orange: 'bg-orange-100 text-orange-800',
}

@Component({
    selector: 'app-status-badge',
    imports: [CommonModule],
    templateUrl: './status-badge.component.html'
})
export class StatusBadgeComponent {
  @Input() label = ''
  @Input() color: BadgeColor = 'slate'
  @Input() icon = ''

  get badgeClass(): string {
    return `inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${BADGE_CLASSES[this.color]}`
  }
}
