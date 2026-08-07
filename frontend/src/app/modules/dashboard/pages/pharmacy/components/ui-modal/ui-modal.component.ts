import { Component, EventEmitter, Input, Output } from '@angular/core'

/**
 * Componente modal unificado (sin SweetAlert) para formularios y diálogos.
 * Patrón visual alineado con GUIA-DISENO-UI.md
 */
@Component({
    selector: 'pharmacy-ui-modal',
    templateUrl: './ui-modal.component.html',
    styleUrls: ['./ui-modal.component.css'],
    standalone: false
})
export class UiModalComponent {
  @Input() open = false
  @Input() title = ''
  @Input() subtitle?: string
  @Input() size: 'sm' | 'md' | 'lg' | 'xl' = 'md'
  @Input() loading = false
  @Input() disableClose = false
  @Input() showFooter = true
  @Input() confirmText = 'Guardar'
  @Input() cancelText = 'Cancelar'

  @Output() closed = new EventEmitter<void>()
  @Output() submitted = new EventEmitter<void>()

  close(): void {
    if (this.disableClose) return
    this.closed.emit()
  }

  submit(): void {
    if (this.loading) return
    this.submitted.emit()
  }

  get widthClass(): string {
    switch (this.size) {
      case 'sm':
        return 'max-w-sm'
      case 'md':
        return 'max-w-md'
      case 'lg':
        return 'max-w-2xl'
      case 'xl':
        return 'max-w-4xl'
    }
  }
}
