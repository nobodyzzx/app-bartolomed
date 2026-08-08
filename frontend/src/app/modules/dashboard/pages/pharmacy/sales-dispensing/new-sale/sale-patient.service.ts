import { DestroyRef, inject, Injectable, computed, signal } from '@angular/core'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { ClinicContextService } from '../../../../../clinics/services/clinic-context.service'
import { PatientsService } from '../../../patients/services/patients.service'
import { Patient } from '../../../patients/interfaces'
import { PrescriptionsService } from '../../../prescriptions/prescriptions.service'
import { PrescriptionListItem } from '../../interfaces/pharmacy.interfaces'

/**
 * Búsqueda del paciente y sus recetas activas para la venta de farmacia.
 *
 * Vive aparte del componente por lo mismo que `SaleCartService`: son dos
 * responsabilidades distintas —quién compra y qué se le vende— y juntas dejaban
 * un componente de 585 líneas donde costaba ver dónde empezaba cada flujo.
 * Se provee a nivel de componente, no en `root`: el estado es de una venta
 * concreta y tiene que morir con la pantalla.
 */
@Injectable()
export class SalePatientService {
  private readonly destroyRef = inject(DestroyRef)
  private readonly patientsService = inject(PatientsService)
  private readonly prescriptionsService = inject(PrescriptionsService)
  private readonly clinicContext = inject(ClinicContextService)

  private searchTimer: any

  readonly searchTerm = signal<string>('')
  readonly options = signal<Patient[]>([])
  readonly searching = signal<boolean>(false)
  readonly loadingPatient = signal<boolean>(false)

  readonly selectedId = signal<string>('')
  readonly selectedName = signal<string>('')

  readonly prescriptions = signal<PrescriptionListItem[]>([])
  readonly loadingPrescriptions = signal<boolean>(false)
  readonly selectedPrescriptionId = signal<string | null>(null)

  /** El backend solo deja dejar "a cuenta" con paciente registrado Y receta. */
  readonly canChargeToAccount = computed(() => !!this.selectedId() && !!this.selectedPrescriptionId())

  /** Debounce de 250 ms y mínimo 2 caracteres, para no consultar por tecla. */
  search(value: string): void {
    this.searchTerm.set(value)
    if (this.searchTimer) clearTimeout(this.searchTimer)

    const term = (value || '').trim()
    if (term.length < 2) {
      this.options.set([])
      return
    }

    this.searchTimer = setTimeout(() => {
      this.searching.set(true)
      this.patientsService
        .searchPatients(term, this.clinicContext.clinicId || undefined)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: patients => {
            this.options.set(patients || [])
            this.searching.set(false)
          },
          error: () => {
            this.options.set([])
            this.searching.set(false)
          },
        })
    }, 250)
  }

  /**
   * Si el paciente no está entre las opciones ya buscadas se pide por id. Ese
   * endpoint necesitó `PharmacyDispense` para no devolver 403 a farmacia.
   */
  select(id: string): void {
    if (!id) {
      this.clear()
      return
    }

    this.selectedId.set(id)

    const found = this.options().find(p => p.id === id)
    if (found) {
      this.selectedName.set(this.fullName(found))
      this.loadPrescriptions(id)
      return
    }

    this.loadingPatient.set(true)
    this.patientsService
      .getPatientById(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: patient => {
          this.selectedName.set(this.fullName(patient))
          this.loadingPatient.set(false)
          this.loadPrescriptions(id)
        },
        error: () => {
          this.selectedName.set('')
          this.loadingPatient.set(false)
          this.prescriptions.set([])
        },
      })
  }

  clear(): void {
    this.selectedId.set('')
    this.selectedName.set('')
    this.prescriptions.set([])
    this.selectedPrescriptionId.set(null)
  }

  selectPrescription(id: string | null): void {
    this.selectedPrescriptionId.set(id || null)
  }

  findPrescription(id: string): PrescriptionListItem | undefined {
    return this.prescriptions().find(p => p.id === id)
  }

  /** Solo recetas activas y no vencidas: dispensar una vencida no tiene sentido. */
  private loadPrescriptions(patientId: string): void {
    if (!patientId) {
      this.prescriptions.set([])
      return
    }

    this.loadingPrescriptions.set(true)
    this.prescriptionsService
      .list(1, 50, { patientId, clinicId: this.clinicContext.clinicId || undefined, status: 'active' })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response: any) => {
          const now = new Date()
          this.prescriptions.set(
            (response?.items ?? []).filter(
              (p: PrescriptionListItem) => !p.expiryDate || new Date(p.expiryDate) >= now,
            ),
          )
          this.loadingPrescriptions.set(false)
        },
        error: () => {
          this.prescriptions.set([])
          this.loadingPrescriptions.set(false)
        },
      })
  }

  private fullName(p: Patient): string {
    return `${p.firstName || ''} ${p.lastName || ''}`.trim()
  }
}
