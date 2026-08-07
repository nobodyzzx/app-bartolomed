import { Injectable, signal } from '@angular/core'

@Injectable({ providedIn: 'root' })
export class ClinicContextService {
  private readonly STORAGE_KEY = 'bartolomed_clinic_context'
  private _clinicId = signal<string | null>(this.loadFromStorage())

  get clinicId() {
    return this._clinicId()
  }

  setClinic(clinicId: string | null) {
    this._clinicId.set(clinicId)
    if (clinicId) {
      localStorage.setItem(this.STORAGE_KEY, clinicId)
    } else {
      localStorage.removeItem(this.STORAGE_KEY)
    }
  }

  private loadFromStorage(): string | null {
    try {
      return localStorage.getItem(this.STORAGE_KEY)
    } catch {
      return null
    }
  }
}
