import { Injectable, signal } from '@angular/core'

@Injectable({ providedIn: 'root' })
export class ClinicContextService {
  private _clinicId = signal<string | null>(null)

  get clinicId() {
    return this._clinicId()
  }

  setClinic(clinicId: string | null) {
    this._clinicId.set(clinicId)
  }
}
