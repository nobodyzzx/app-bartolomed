import { Component, Input } from '@angular/core'

/** Badge rojo con cantidad de errores, para el header de una tarjeta de sección de formulario. */
@Component({
  selector: 'app-section-error-badge',
  imports: [],
  template: `
    @if (count > 0) {
      <span
        class="ml-1 inline-flex items-center justify-center min-w-[1.375rem] h-[1.375rem] px-1.5
               rounded-full bg-red-500 text-white text-xs font-bold leading-none animate-badge-pop"
        [attr.aria-label]="count + ' campo(s) con error en esta sección'"
      >
        {{ count }}
      </span>
    }
  `,
})
export class SectionErrorBadgeComponent {
  @Input() count = 0
}
