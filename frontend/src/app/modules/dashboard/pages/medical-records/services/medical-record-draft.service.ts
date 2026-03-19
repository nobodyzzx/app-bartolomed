import { Injectable } from '@angular/core'
import { AlertService } from '@core/services/alert.service'

@Injectable({ providedIn: 'root' })
export class MedicalRecordDraftService {
  readonly DRAFT_KEY = 'medical-record:new:draft:v1'

  constructor(private alert: AlertService) {}

  save(data: unknown): void {
    try {
      localStorage.setItem(this.DRAFT_KEY, JSON.stringify(data))
    } catch (_) {
      // almacenamiento puede fallar por cuota; ignorar
    }
  }

  clear(): void {
    try {
      localStorage.removeItem(this.DRAFT_KEY)
    } catch (_) {
      // ignorar
    }
  }

  tryRestore(onRestore: (draft: Record<string, unknown>) => void): void {
    try {
      const raw = localStorage.getItem(this.DRAFT_KEY)
      if (!raw) return
      const draft = JSON.parse(raw)
      if (!draft || typeof draft !== 'object') return

      this.alert
        .fire({
          title: 'Restaurar borrador',
          text: 'Encontramos un borrador sin enviar. ¿Desea restaurarlo?',
          icon: 'question',
          showCancelButton: true,
          showDenyButton: false,
          showCloseButton: false,
          confirmButtonText: 'Sí, restaurar',
          cancelButtonText: 'No, descartar',
          reverseButtons: true,
          allowOutsideClick: false,
          didOpen: (popup: HTMLElement) => {
            // TODO: El botón gris "deny" de SweetAlert2 aparece a pesar de showDenyButton: false
            const denyBtn = popup.querySelector('.swal2-deny')
            if (denyBtn) {
              ;(denyBtn as HTMLElement).style.display = 'none'
            }
          },
        })
        .then(res => {
          if (res.isConfirmed) {
            onRestore(draft)
          }
        })
    } catch (_) {
      // ignorar
    }
  }
}
