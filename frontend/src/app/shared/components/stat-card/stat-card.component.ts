import { CommonModule } from '@angular/common'
import { Component, EventEmitter, Input, Output } from '@angular/core'

export type StatCardColor =
  | 'blue' | 'indigo' | 'pink' | 'green'
  | 'amber' | 'red' | 'purple' | 'slate' | 'orange'

// Todas las clases escritas completas → Tailwind JIT las detecta en el scanner
const COLOR_MAP: Record<StatCardColor, {
  card: string; label: string; value: string; sub: string; icon: string; ring: string
}> = {
  blue:   { card: 'bg-blue-50 border-blue-500',    label: 'text-sm font-semibold text-blue-600',   value: 'text-3xl font-bold mt-1 text-blue-900',   sub: 'text-xs mt-1 text-blue-500',   icon: 'material-symbols-outlined msz-40 text-blue-300',   ring: 'ring-blue-400' },
  indigo: { card: 'bg-indigo-50 border-indigo-500', label: 'text-sm font-semibold text-indigo-600', value: 'text-3xl font-bold mt-1 text-indigo-900', sub: 'text-xs mt-1 text-indigo-500', icon: 'material-symbols-outlined msz-40 text-indigo-300', ring: 'ring-indigo-400' },
  pink:   { card: 'bg-pink-50 border-pink-500',    label: 'text-sm font-semibold text-pink-600',   value: 'text-3xl font-bold mt-1 text-pink-900',   sub: 'text-xs mt-1 text-pink-500',   icon: 'material-symbols-outlined msz-40 text-pink-300',   ring: 'ring-pink-400' },
  green:  { card: 'bg-green-50 border-green-500',   label: 'text-sm font-semibold text-green-600',  value: 'text-3xl font-bold mt-1 text-green-900',  sub: 'text-xs mt-1 text-green-500',  icon: 'material-symbols-outlined msz-40 text-green-300',  ring: 'ring-green-400' },
  amber:  { card: 'bg-amber-50 border-amber-500',   label: 'text-sm font-semibold text-amber-600',  value: 'text-3xl font-bold mt-1 text-amber-900',  sub: 'text-xs mt-1 text-amber-500',  icon: 'material-symbols-outlined msz-40 text-amber-300',  ring: 'ring-amber-400' },
  red:    { card: 'bg-red-50 border-red-500',      label: 'text-sm font-semibold text-red-600',    value: 'text-3xl font-bold mt-1 text-red-900',    sub: 'text-xs mt-1 text-red-500',    icon: 'material-symbols-outlined msz-40 text-red-300',    ring: 'ring-red-400' },
  purple: { card: 'bg-purple-50 border-purple-500', label: 'text-sm font-semibold text-purple-600', value: 'text-3xl font-bold mt-1 text-purple-900', sub: 'text-xs mt-1 text-purple-500', icon: 'material-symbols-outlined msz-40 text-purple-300', ring: 'ring-purple-400' },
  slate:  { card: 'bg-slate-50 border-slate-400',   label: 'text-sm font-semibold text-slate-600',  value: 'text-3xl font-bold mt-1 text-slate-800',  sub: 'text-xs mt-1 text-slate-500',  icon: 'material-symbols-outlined msz-40 text-slate-300',  ring: 'ring-slate-400' },
  orange: { card: 'bg-orange-50 border-orange-500', label: 'text-sm font-semibold text-orange-600', value: 'text-3xl font-bold mt-1 text-orange-900', sub: 'text-xs mt-1 text-orange-500', icon: 'material-symbols-outlined msz-40 text-orange-300', ring: 'ring-orange-400' },
}

@Component({
  selector: 'app-stat-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './stat-card.component.html',
})
export class StatCardComponent {
  @Input() label = ''
  @Input() value: string | number = 0
  @Input() sublabel = ''
  @Input() icon = 'info'
  @Input() color: StatCardColor = 'blue'
  @Input() active = false
  @Input() clickable = false

  @Output() cardClick = new EventEmitter<void>()

  get c() { return COLOR_MAP[this.color] }

  get cardClass(): string {
    return [
      'p-5 rounded-2xl border-l-4 shadow-md hover:shadow-lg transition-all select-none',
      this.c.card,
      this.active ? `ring-2 ring-offset-0 ${this.c.ring}` : '',
      this.clickable ? 'cursor-pointer' : '',
    ].filter(Boolean).join(' ')
  }

  onClick(): void {
    if (this.clickable) this.cardClick.emit()
  }
}
