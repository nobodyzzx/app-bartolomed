import { Injectable } from '@angular/core'
import { AlertService } from '@core/services/alert.service'

@Injectable({ providedIn: 'root' })
export class MedicalRecordDraftService {
  readonly DRAFT_KEY = 'medical-record:new:draft:v1'

  private memoryFallback: string | null = null
  private warnedAboutStorage = false

  constructor(private alert: AlertService) {}

  save(data: unknown): void {
    const serialized = JSON.stringify(data)
    try {
      localStorage.setItem(this.DRAFT_KEY, serialized)
      this.memoryFallback = null
    } catch (err) {
      // Cuota llena, modo privado, permisos: caemos a memoria y avisamos una vez
      this.memoryFallback = serialized
      this.notifyStorageFailure(err, 'guardar')
    }
  }

  clear(): void {
    this.memoryFallback = null
    try {
      localStorage.removeItem(this.DRAFT_KEY)
    } catch (err) {
      this.notifyStorageFailure(err, 'limpiar')
    }
  }

  tryRestore(
    onRestore: (draft: Record<string, unknown>) => void,
    currentPatientId?: string,
  ): void {
    let raw: string | null = null
    try {
      raw = localStorage.getItem(this.DRAFT_KEY) ?? this.memoryFallback
    } catch (err) {
      raw = this.memoryFallback
      this.notifyStorageFailure(err, 'leer')
    }

    if (!raw) return

    let draft: unknown
    try {
      draft = JSON.parse(raw)
    } catch {
      // Borrador corrupto: descartar silenciosamente
      this.clear()
      return
    }

    if (!draft || typeof draft !== 'object') return

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
          onRestore(draft as Record<string, unknown>)
        } else {
          this.clear()
        }
      })
  }

  private notifyStorageFailure(err: unknown, action: string): void {
    console.warn(`[MedicalRecordDraft] No se pudo ${action} el borrador en localStorage`, err)
    if (this.warnedAboutStorage) return
    this.warnedAboutStorage = true
    this.alert
      .fire({
        title: 'Advertencia',
        text: 'No se pudo persistir el borrador del expediente. Se mantendrá en memoria mientras no recargues la página.',
        icon: 'warning',
      })
      .catch(() => undefined)
  }
}
