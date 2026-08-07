import { Injectable, inject } from '@angular/core'
import { MatDialog } from '@angular/material/dialog'
import { firstValueFrom } from 'rxjs'
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component'
import { NotificationService } from '../../shared/services/notification.service'
import { AlertOptions, AlertResult } from '../interfaces/alert.interfaces'

@Injectable({ providedIn: 'root' })
export class AlertService {
  private dialog = inject(MatDialog)
  private notifications = inject(NotificationService)

  /**
   * Drop-in replacement for Swal.fire().
   * - With showCancelButton → opens ConfirmDialogComponent, returns Promise<{isConfirmed}>
   * - Without showCancelButton → shows a toast notification
   */
  fire(options: AlertOptions): Promise<AlertResult> {
    if (options?.showCancelButton) {
      return this._openConfirmDialog(options)
    }

    // Informational alert → toast
    const message = options?.title
      ? options.text || options.html
        ? `${options.title} · ${this._stripHtml(options.text ?? options.html ?? '')}`
        : options.title
      : options?.text ?? options?.html ?? ''

    const type =
      options?.icon === 'error'
        ? 'error'
        : options?.icon === 'warning'
          ? 'warning'
          : options?.icon === 'success'
            ? 'success'
            : 'info'

    this.notifications.show(type, message)
    return Promise.resolve({ isConfirmed: false, isDismissed: true })
  }

  confirm(options: Partial<AlertOptions> = {}): Promise<AlertResult> {
    return this._openConfirmDialog({
      showCancelButton: true,
      reverseButtons: true,
      ...(options || {}),
    })
  }

  success(title: string, text?: string): Promise<AlertResult> {
    const message = text ? `${title} · ${text}` : title
    this.notifications.success(message)
    return Promise.resolve({ isConfirmed: false })
  }

  error(title: string, text?: string): Promise<AlertResult> {
    const message = text ? `${title} · ${text}` : title
    this.notifications.error(message)
    return Promise.resolve({ isConfirmed: false })
  }

  warning(title: string, text?: string): Promise<AlertResult> {
    const message = text ? `${title} · ${text}` : title
    this.notifications.warning(message)
    return Promise.resolve({ isConfirmed: false })
  }

  // Diálogo Material (ConfirmDialogComponent en modo input) en vez de
  // window.prompt() nativo — bloqueaba el hilo del navegador y rompía con el
  // resto del sistema de diseño (Material, sin dialogs nativos del SO).
  prompt(options: {
    title?: string
    inputLabel?: string
    inputPlaceholder?: string
    confirmButtonText?: string
    cancelButtonText?: string
    inputValidator?: (value: string) => string | null
  }): Promise<AlertResult> {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '480px',
      maxWidth: '95vw',
      data: {
        title: options.title ?? 'Ingrese un valor',
        message: '',
        confirmText: options.confirmButtonText ?? 'Confirmar',
        cancelText: options.cancelButtonText ?? 'Cancelar',
        inputLabel: options.inputLabel ?? 'Valor',
        inputPlaceholder: options.inputPlaceholder,
        inputRequired: true,
      },
    })

    return firstValueFrom(dialogRef.afterClosed()).then(result => {
      if (!result || result === false) return { isConfirmed: false, isDismissed: true }

      const value = (result as { value: string }).value
      if (options.inputValidator) {
        const error = options.inputValidator(value)
        if (error) {
          this.notifications.error(error)
          return { isConfirmed: false, isDismissed: true }
        }
      }
      return { isConfirmed: true, value }
    })
  }

  private _openConfirmDialog(options: AlertOptions): Promise<AlertResult> {
    const isDestructive =
      options.isDestructive === true ||
      options.icon === 'warning' ||
      /elimin|borrar|remov|delet/i.test(options.confirmButtonText ?? '')

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '480px',
      maxWidth: '95vw',
      data: {
        title: options.title ?? 'Confirmar',
        message: options.text ?? this._stripHtml(options.html ?? ''),
        confirmText: options.confirmButtonText ?? 'Confirmar',
        cancelText: options.cancelButtonText ?? 'Cancelar',
        isDestructive,
      },
    })

    return firstValueFrom(dialogRef.afterClosed()).then(result => ({
      isConfirmed: result === true,
      isDenied: false,
      isDismissed: result !== true,
    }))
  }

  /**
   * El diálogo muestra texto plano, así que el HTML se aplana. Los cierres de
   * bloque y los `<br>` se convierten en salto de línea **antes** de quitar las
   * etiquetas: sin eso, `</p><p>` colapsaba a nada y los párrafos salían
   * pegados ("...Bs 155.00Descuento: Bs 10.00..."), que es como se veía la
   * confirmación del punto de cobro.
   */
  private _stripHtml(html: string): string {
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, '\n')
      .replace(/<[^>]*>/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]+/g, ' ')
      .split('\n')
      .map(line => line.trim())
      .join('\n')
      .trim()
  }
}
