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

  tryRestore(
    onRestore: (draft: Record<string, unknown>) => void,
    currentPatientId?: string,
  ): void {
    try {
      const raw = localStorage.getItem(this.DRAFT_KEY)
      if (!raw) return
      const draft = JSON.parse(raw)
      if (!draft || typeof draft !== 'object') return

      // Si hay un paciente preseleccionado y el borrador es de otro paciente, descartarlo
      const draftPatientId = (draft as Record<string, unknown>)['patientId']
      if (currentPatientId && draftPatientId !== currentPatientId) {
        this.clear()
        return
      }

      this.alert
        .fire({
          title: 'Restaurar borrador',
          text: 'Encontramos un borrador sin enviar. ¿Desea restaurarlo?',
          icon: 'question',
          showCancelButton: true,
          confirmButtonText: 'Sí, restaurar',
          cancelButtonText: 'No, descartar',
        })
        .then(res => {
          if (res.isConfirmed) {
            onRestore(draft)
          } else {
            this.clear()
          }
        })
    } catch (_) {
      // ignorar
    }
  }
}
