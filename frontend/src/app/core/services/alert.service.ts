import { Injectable } from '@angular/core'
import Swal from 'sweetalert2'

@Injectable({ providedIn: 'root' })
export class AlertService {
  private readonly swal = Swal.mixin({
    buttonsStyling: false,
    customClass: {
      popup: 'rounded-xl shadow-2xl',
      title: 'text-slate-900 font-semibold text-xl',
      htmlContainer: 'text-slate-600 leading-relaxed',
      actions: 'gap-3',
      // Confirm: azul sólido, sin borde negro ni outline
      confirmButton:
        'inline-flex items-center gap-2 rounded-full h-10 px-5 bg-blue-600 text-white hover:bg-blue-700 shadow-md hover:shadow-lg border-0 outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 focus-visible:ring-offset-1',
      // Cancel: igual al botón Cancelar del header, con borde del color correspondiente (rojo suave)
      cancelButton:
        'inline-flex items-center gap-2 rounded-full h-10 px-5 bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 hover:text-red-700 hover:border-red-300 outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200 focus-visible:ring-offset-1',
      // Deny/terciario: neutro con borde gris suave (sin borde negro)
      denyButton:
        'inline-flex items-center gap-2 rounded-full h-10 px-5 bg-slate-50 text-slate-700 border border-slate-300 hover:bg-slate-100 hover:border-slate-400 outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-200 focus-visible:ring-offset-1',
    },
    didOpen: (el: HTMLElement) => {
      const confirm = el.querySelector<HTMLButtonElement>('.swal2-confirm')
      const cancel = el.querySelector<HTMLButtonElement>('.swal2-cancel')
      const deny = el.querySelector<HTMLButtonElement>('.swal2-deny')

      // Quitar cualquier borde/outline/box-shadow heredado
      ;[confirm, cancel, deny].forEach(btn => {
        if (!btn) return
        btn.style.boxShadow = 'none'
        btn.style.outline = 'none'
      })

      // Forzar bordes correctos
      if (confirm) {
        confirm.style.border = '0'
      }
      if (cancel) {
        cancel.style.borderWidth = '1px'
        cancel.style.borderStyle = 'solid'
        cancel.style.borderColor = '#fecaca' // red-200
      }
      if (deny) {
        deny.style.borderWidth = '1px'
        deny.style.borderStyle = 'solid'
        deny.style.borderColor = '#cbd5e1' // slate-300
      }
    },
  })

  fire(options: any): Promise<any> {
    return this.swal.fire(options as any)
  }

  confirm(options: any = {}) {
    return this.swal.fire({
      icon: 'question',
      showCancelButton: true,
      reverseButtons: true,
      ...(options || {}),
    } as any)
  }

  success(title: string, text?: string) {
    return this.swal.fire({ icon: 'success', title, text } as any)
  }

  error(title: string, text?: string, options: any = {}) {
    return this.swal.fire({ icon: 'error', title, text, ...(options || {}) } as any)
  }

  warning(title: string, text?: string, options: any = {}) {
    return this.swal.fire({ icon: 'warning', title, text, ...(options || {}) } as any)
  }
}
