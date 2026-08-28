import { Component, Input } from '@angular/core'
import { MatMenuModule } from '@angular/material/menu'

/** Una descarga concreta (un formato) dentro de una tarjeta de reporte. */
export interface ReportDownloadFormat {
  label: string
  /** Símbolo de Material Symbols; por defecto usa el de la tarjeta. */
  icon?: string
  /** Clave única del formato, solo para `track` en el `@for` del menú. */
  key: string
  downloading?: boolean
  action: () => void
}

export type ReportDownloadColor =
  | 'blue' | 'green' | 'orange' | 'purple' | 'teal' | 'indigo' | 'amber' | 'cyan' | 'emerald'

// Clases completas (no interpoladas) para que el JIT de Tailwind las detecte.
const ICON_COLOR: Record<ReportDownloadColor, string> = {
  blue: 'text-blue-600',
  green: 'text-green-600',
  orange: 'text-orange-500',
  purple: 'text-purple-600',
  teal: 'text-teal-600',
  indigo: 'text-indigo-600',
  amber: 'text-amber-700',
  cyan: 'text-cyan-600',
  emerald: 'text-emerald-600',
}

/**
 * Reemplaza el patrón "fila de botones PDF + fila de botones Excel" repetido
 * en toda la pantalla de Reportes: un solo botón por reporte que, si tiene
 * más de un formato, abre un menú (PDF / Excel) en vez de ocupar dos casilleros
 * del grid con el mismo nombre.
 */
@Component({
  selector: 'app-report-download-button',
  standalone: true,
  imports: [MatMenuModule],
  templateUrl: './report-download-button.component.html',
})
export class ReportDownloadButtonComponent {
  @Input({ required: true }) label!: string
  @Input({ required: true }) formats!: ReportDownloadFormat[]
  @Input() color: ReportDownloadColor = 'blue'
  @Input() defaultIcon = 'download'

  get iconColorClass(): string {
    return ICON_COLOR[this.color]
  }

  get isBusy(): boolean {
    return this.formats.some(f => f.downloading)
  }

  get primaryIcon(): string {
    if (this.isBusy) return 'hourglass_top'
    return this.formats.length === 1 ? (this.formats[0].icon ?? this.defaultIcon) : this.defaultIcon
  }

  onSingleClick(): void {
    if (this.formats.length === 1 && !this.isBusy) this.formats[0].action()
  }
}
