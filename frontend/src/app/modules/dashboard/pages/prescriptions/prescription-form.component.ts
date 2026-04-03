import { Component, ElementRef, inject, signal } from '@angular/core'
import {
  AbstractControl,
  FormArray,
  FormControl,
  FormGroup,
  ValidationErrors,
  Validators,
} from '@angular/forms'
import { ActivatedRoute, Router } from '@angular/router'
import { AlertService } from '@core/services/alert.service'
import { Observable, Subject } from 'rxjs'
import { ClinicsService } from '../admin/clinics/services/clinics.service'
import { PatientsService } from '../patients/services/patients.service'
import { UsersService } from '../admin/users/users.service'
import { ClinicContextService } from '../../../clinics/services/clinic-context.service'
import { PrescriptionsService } from './prescriptions.service'
import { DrugSearchService } from './drug-search.service'

// Validators
function dateFormatValidator(control: AbstractControl): ValidationErrors | null {
  const value = control.value
  if (!value) return null

  // Validar formato YYYY-MM-DD
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/
  if (!dateRegex.test(value)) {
    return { invalidDate: true }
  }

  // Validar que sea una fecha válida
  const date = new Date(value)
  if (isNaN(date.getTime())) {
    return { invalidDate: true }
  }

  return null
}

function dateOrderValidator(group: AbstractControl): ValidationErrors | null {
  const start = group.get('prescriptionDate')?.value
  const end = group.get('expiryDate')?.value
  if (!start || !end) return null
  const s = new Date(start)
  const e = new Date(end)
  return e >= s ? null : { dateOrder: true }
}


@Component({
  selector: 'app-prescription-form',
  templateUrl: './prescription-form.component.html',
  styleUrls: ['./prescription-form.component.css'],
})
export class PrescriptionFormComponent {
  route = inject(ActivatedRoute)
  router = inject(Router)
  private svc = inject(PrescriptionsService)
  private alert = inject(AlertService)
  private patientsService = inject(PatientsService)
  private usersService = inject(UsersService)
  private clinicsService = inject(ClinicsService)
  private drugSearchService = inject(DrugSearchService)
  private clinicCtx = inject(ClinicContextService)
  private elRef = inject(ElementRef)

  // Drug autocomplete: one Subject + Observable per medication item
  drugInputSubjects: Subject<string>[] = []
  drugSuggestions$: Observable<string[]>[] = []

  form = new FormGroup(
    {
      id: new FormControl<string | null>(null),
      prescriptionNumber: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required],
      }),
      patientId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
      doctorId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
      clinicId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
      prescriptionDate: new FormControl(new Date(), {
        nonNullable: true,
        validators: [Validators.required],
      }),
      expiryDate: new FormControl<Date | null>(null, {
        validators: [Validators.required],
      }),
      notes: new FormControl(''),
      items: new FormArray<FormGroup<any>>([]),
    },
    { validators: [dateOrderValidator] },
  )

  loading = false
  printLoading = false
  isEdit = signal(false)

  patients: any[] = []
  doctors: any[] = []
  clinics: any[] = []

  goBack(): void {
    this.router.navigate(['/dashboard/prescriptions'])
  }

  printPdf(): void {
    const id = this.form.get('id')?.value
    if (!id) return
    this.printLoading = true
    this.svc.getPdf(id).subscribe({
      next: blob => {
        this.printLoading = false
        const url = URL.createObjectURL(blob)
        window.open(url, '_blank')
        setTimeout(() => URL.revokeObjectURL(url), 60000)
      },
      error: () => (this.printLoading = false),
    })
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id')
    this.loadOptions()
    // No agregar item por defecto, dejar que el usuario lo agregue manualmente
    if (!id) {
      this.autoGenerateNumber()
    }
    if (id) {
      this.isEdit.set(true)
      this.form.get('id')?.setValue(id)
      this.loading = true
      this.svc.get(id).subscribe({
        next: (pres: any) => {
          this.loading = false
          // Patch básicos - Convertir las fechas de string a Date para el datepicker
          this.form.patchValue({
            prescriptionNumber: pres.prescriptionNumber,
            patientId: pres.patient?.id,
            doctorId: pres.doctor?.id,
            clinicId: pres.clinic?.id,
            prescriptionDate: pres.prescriptionDate ? new Date(pres.prescriptionDate) : undefined,
            expiryDate: pres.expiryDate ? new Date(pres.expiryDate) : undefined,
            notes: pres.notes || '',
          })
          // Items
          this.items.clear()
          ;(pres.items || []).forEach((it: any) => this.addItem(it))
        },
        error: () => (this.loading = false),
      })
    }
  }

  ngOnDestroy(): void {}

  // Autogenerar número de receta con patrón RX-YYYYMMDD-HHMMSS
  autoGenerateNumber() {
    const now = new Date()
    const pad = (n: number) => n.toString().padStart(2, '0')
    const value = `RX-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
    this.form.get('prescriptionNumber')?.setValue(value)
  }

  get items() {
    return this.form.get('items') as FormArray
  }

  private parseStrength(raw: string): { value: string; unit: string } {
    if (!raw) return { value: '', unit: 'mg' }
    const knownUnits = ['mg', 'g', 'mcg', 'ml', 'UI', '%', 'mEq', 'mmol']
    const parts = raw.trim().split(/\s+/)
    const lastPart = parts[parts.length - 1]
    if (parts.length >= 2 && knownUnits.includes(lastPart)) {
      return { value: parts.slice(0, -1).join(' '), unit: lastPart }
    }
    return { value: raw, unit: 'mg' }
  }

  addItem(data?: any) {
    const { value: strengthValue, unit: strengthUnit } = this.parseStrength(data?.strength || '')
    const group = new FormGroup({
      medicationName: new FormControl(data?.medicationName || '', Validators.required),
      strengthValue: new FormControl(strengthValue, Validators.required),
      strengthUnit: new FormControl(strengthUnit, Validators.required),
      dosageForm: new FormControl(data?.dosageForm || 'tableta', Validators.required),
      quantity: new FormControl(data?.quantity || '1', [
        Validators.required,
        Validators.pattern('^[0-9]+$'),
      ]),
      dosage: new FormControl(data?.dosage || '', Validators.required),
      frequency: new FormControl(data?.frequency || 'cada 8 horas', Validators.required),
      route: new FormControl(data?.route || 'oral'),
      duration: new FormControl<number | null>(data?.duration ?? null),
      instructions: new FormControl(data?.instructions || ''),
    })
    this.items.push(group)

    const subject = new Subject<string>()
    this.drugInputSubjects.push(subject)
    this.drugSuggestions$.push(this.drugSearchService.searchAsStream(subject.asObservable()))
  }

  removeItem(i: number) {
    this.items.removeAt(i)
    this.drugInputSubjects.splice(i, 1)
    this.drugSuggestions$.splice(i, 1)
  }

  onDrugInput(index: number, value: string) {
    this.drugInputSubjects[index]?.next(value)
  }

  selectDrug(index: number, name: string) {
    const ctrl = (this.items.at(index) as FormGroup).get('medicationName')
    ctrl?.setValue(name)
    ctrl?.markAsTouched()
  }

  private loadOptions() {
    // Pacientes
    this.patientsService.findAll().subscribe({
      next: result => (this.patients = result.data || []),
      error: () => (this.patients = []),
    })
    // Médicos (filtrar usuarios con rol doctor)
    this.usersService.getUsers().subscribe({
      next: result => (this.doctors = (result.data || []).filter((u: any) => (u.roles || []).includes('doctor'))),
      error: () => (this.doctors = []),
    })
    // Clínicas
    this.clinicsService.findAll(true).subscribe({
      next: cs => (this.clinics = cs || []),
      error: () => (this.clinics = []),
      complete: () => {
        const current = this.form.get('clinicId')?.value
        if (!current && this.clinics && this.clinics.length > 0) {
          const ctxId = this.clinicCtx.clinicId
          const match = ctxId && this.clinics.find((c: any) => c.id === ctxId)
          this.form.get('clinicId')?.setValue(match ? ctxId : this.clinics[0].id)
        }
      },
    })
  }

  getDoctorName(doctor: any): string {
    const firstName = doctor.personalInfo?.firstName || ''
    const lastName = doctor.personalInfo?.lastName || ''
    return `${firstName} ${lastName}`.trim() || doctor.email
  }

  submitDraft() {
    this.doSubmit('draft')
  }

  submit() {
    this.doSubmit(this.isEdit() ? undefined : 'active')
  }

  private doSubmit(status?: string) {
    if (this.form.invalid) {
      this.form.markAllAsTouched()
      this.scrollToFirstError()
      return
    }

    const v = this.form.value as any

    const prescriptionDate =
      v.prescriptionDate instanceof Date
        ? v.prescriptionDate.toISOString().slice(0, 10)
        : v.prescriptionDate
    const expiryDate =
      v.expiryDate instanceof Date ? v.expiryDate.toISOString().slice(0, 10) : v.expiryDate

    const payload: any = {
      prescriptionNumber: v.prescriptionNumber,
      prescriptionDate,
      expiryDate,
      patientId: v.patientId,
      doctorId: v.doctorId,
      clinicId: v.clinicId,
      items: (v.items || []).map((it: any) => ({
        medicationName: it.medicationName,
        strength: it.strengthValue && it.strengthUnit ? `${it.strengthValue} ${it.strengthUnit}` : (it.strengthValue || ''),
        dosageForm: it.dosageForm,
        quantity: it.quantity,
        dosage: it.dosage,
        frequency: it.frequency,
        route: it.route || undefined,
        duration: it.duration || undefined,
        instructions: it.instructions || undefined,
      })),
      notes: v.notes || undefined,
    }

    if (status) payload.status = status

    this.loading = true
    const id = this.form.get('id')?.value
    const obs = id ? this.svc.update(id, payload) : this.svc.create(payload)
    obs.subscribe({
      next: (res: any) => {
        this.loading = false
        const savedId = res?.id ?? id
        const msg = id ? 'Receta actualizada' : status === 'draft' ? 'Borrador guardado' : 'Receta creada'
        this.alert.success(msg, 'Operación exitosa').then(() => {
          if (savedId) {
            this.router.navigate(['/dashboard/prescriptions', savedId])
          } else {
            this.router.navigate(['../list'])
          }
        })
      },
      error: () => (this.loading = false),
    })
  }

  private scrollToFirstError(): void {
    requestAnimationFrame(() => {
      const el = this.elRef.nativeElement.querySelector('.mat-form-field-invalid')
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }

}
