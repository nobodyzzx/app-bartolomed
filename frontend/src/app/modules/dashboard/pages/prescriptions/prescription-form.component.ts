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
import { ClinicsService } from '../clinics/services/clinics.service'
import { PatientsService } from '../patients/services/patients.service'
import { UsersService } from '../users/users.service'
import { PrescriptionsService } from './prescriptions.service'

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

function daysBetween(a: Date, b: Date): number {
  const ms = 1000 * 60 * 60 * 24
  const start = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime()
  const end = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime()
  return Math.ceil((end - start) / ms)
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
  private elRef = inject(ElementRef)

  private docClickListener: any = null

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
  isEdit = signal(false)

  patients: any[] = []
  doctors: any[] = []
  clinics: any[] = []
  // Autocomplete filters
  patientFilter = ''
  doctorFilter = ''
  filteredPatients: any[] = []
  filteredDoctors: any[] = []
  // Control de visibilidad de dropdowns
  showPatientDropdown = false
  showDoctorDropdown = false
  // Objetos seleccionados para mostrar chips
  selectedPatient: any = null
  selectedDoctor: any = null

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id')
    this.loadOptions()
    // No agregar item por defecto, dejar que el usuario lo agregue manualmente
    if (!id) {
      this.autoGenerateNumber()
    }
    // Revalidar items cuando cambian fechas
    this.form
      .get('prescriptionDate')
      ?.valueChanges.subscribe(() => this.updateItemsDurationValidators())
    this.form.get('expiryDate')?.valueChanges.subscribe(() => this.updateItemsDurationValidators())
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
          this.updateItemsDurationValidators()
          // Mostrar nombres seleccionados en los campos typeahead cuando se abre en modo edición
          this.patientFilter = pres.patient
            ? `${pres.patient.firstName || ''} ${pres.patient.lastName || ''}`.trim()
            : ''
          this.doctorFilter = pres.doctor
            ? `${pres.doctor.personalInfo?.firstName || ''} ${pres.doctor.personalInfo?.lastName || ''}`.trim()
            : ''
          // Guardar objetos seleccionados para mostrar chips
          if (pres.patient) {
            this.selectedPatient = pres.patient
          }
          if (pres.doctor) {
            this.selectedDoctor = pres.doctor
          }
        },
        error: () => (this.loading = false),
      })
    }

    // Cerrar dropdowns al hacer click fuera
    this.docClickListener = (ev: any) => {
      try {
        if (!this.elRef?.nativeElement?.contains(ev.target)) {
          this.showPatientDropdown = false
          this.showDoctorDropdown = false
        }
      } catch {
        // ignore
      }
    }
    document.addEventListener('click', this.docClickListener)
  }

  ngOnDestroy(): void {
    if (this.docClickListener) document.removeEventListener('click', this.docClickListener)
  }

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

  addItem(data?: any) {
    const group = new FormGroup({
      medicationName: new FormControl(data?.medicationName || '', Validators.required),
      strength: new FormControl(data?.strength || '', Validators.required),
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
    this.updateItemsDurationValidators()
  }

  removeItem(i: number) {
    this.items.removeAt(i)
  }

  private loadOptions() {
    // Pacientes
    this.patientsService.findAll().subscribe({
      next: list => {
        this.patients = list
        this.filteredPatients = list ? list.slice() : []
      },
      error: () => (this.patients = []),
    })
    // Médicos (filtrar usuarios con rol doctor)
    this.usersService.getUsers().subscribe({
      next: users => {
        this.doctors = (users || []).filter((u: any) => (u.roles || []).includes('doctor'))
        this.filteredDoctors = this.doctors.slice()
      },
      error: () => (this.doctors = []),
    })
    // Clínicas
    this.clinicsService.findAll(true).subscribe({
      next: cs => (this.clinics = cs || []),
      error: () => (this.clinics = []),
      complete: () => {
        // Preseleccionar primera clínica si no hay una seleccionada
        const current = this.form.get('clinicId')?.value
        if (!current && this.clinics && this.clinics.length > 0) {
          this.form.get('clinicId')?.setValue(this.clinics[0].id)
        }
      },
    })
  }

  // --- Autocomplete helpers ---
  onPatientFilter(val: string) {
    this.patientFilter = val || ''
    this.showPatientDropdown = true
    this.selectedPatient = null
    const q = this.patientFilter.trim().toLowerCase()
    if (!q) {
      this.filteredPatients = this.patients.slice()
      return
    }
    this.filteredPatients = (this.patients || []).filter((p: any) => {
      const name = `${p.firstName || ''} ${p.lastName || ''}`.toLowerCase()
      return name.includes(q) || (p.documentNumber || '').toLowerCase().includes(q)
    })
  }

  selectPatient(p: any) {
    if (!p) return
    this.form.get('patientId')?.setValue(p.id)
    this.patientFilter = `${p.firstName || ''} ${p.lastName || ''}`.trim()
    this.selectedPatient = p
    this.showPatientDropdown = false
  }

  clearPatient() {
    this.form.get('patientId')?.setValue('')
    this.patientFilter = ''
    this.selectedPatient = null
    this.showPatientDropdown = true
    this.filteredPatients = this.patients.slice()
  }

  onDoctorFilter(val: string) {
    this.doctorFilter = val || ''
    this.showDoctorDropdown = true
    this.selectedDoctor = null
    const q = this.doctorFilter.trim().toLowerCase()
    if (!q) {
      this.filteredDoctors = this.doctors.slice()
      return
    }
    this.filteredDoctors = (this.doctors || []).filter((d: any) => {
      const name =
        `${d.personalInfo?.firstName || ''} ${d.personalInfo?.lastName || ''}`.toLowerCase()
      return name.includes(q) || (d.email || '').toLowerCase().includes(q)
    })
  }

  selectDoctor(d: any) {
    if (!d) return
    this.form.get('doctorId')?.setValue(d.id)
    this.doctorFilter =
      `${d.personalInfo?.firstName || ''} ${d.personalInfo?.lastName || ''}`.trim()
    this.selectedDoctor = d
    this.showDoctorDropdown = false
  }

  clearDoctor() {
    this.form.get('doctorId')?.setValue('')
    this.doctorFilter = ''
    this.selectedDoctor = null
    this.showDoctorDropdown = true
    this.filteredDoctors = this.doctors.slice()
  }

  getDoctorName(doctor: any): string {
    const firstName = doctor.personalInfo?.firstName || ''
    const lastName = doctor.personalInfo?.lastName || ''
    return `${firstName} ${lastName}`.trim() || doctor.email
  }

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched()
      return
    }

    const v = this.form.value as any

    // Convertir fechas a formato ISO (YYYY-MM-DD)
    const prescriptionDate =
      v.prescriptionDate instanceof Date
        ? v.prescriptionDate.toISOString().slice(0, 10)
        : v.prescriptionDate
    const expiryDate =
      v.expiryDate instanceof Date ? v.expiryDate.toISOString().slice(0, 10) : v.expiryDate

    const payload = {
      prescriptionNumber: v.prescriptionNumber,
      prescriptionDate,
      expiryDate,
      patientId: v.patientId,
      doctorId: v.doctorId,
      clinicId: v.clinicId,
      items: (v.items || []).map((it: any) => ({
        medicationName: it.medicationName,
        strength: it.strength,
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

    this.loading = true
    const id = this.form.get('id')?.value
    const obs = id ? this.svc.update(id, payload) : this.svc.create(payload)
    obs.subscribe({
      next: () => {
        this.loading = false
        const msg = id ? 'Receta actualizada' : 'Receta creada'
        this.alert.success(msg, 'Operación exitosa').then(() => {
          this.router.navigate(['../list'])
        })
      },
      error: () => (this.loading = false),
    })
  }

  // Recalcula validadores de duración por item en base al rango de fechas
  updateItemsDurationValidators() {
    const startVal = this.form.get('prescriptionDate')?.value
    const endVal = this.form.get('expiryDate')?.value
    if (!startVal || !endVal) return
    const maxDays = daysBetween(new Date(startVal), new Date(endVal))
    for (let i = 0; i < this.items.length; i++) {
      const ctrl = this.items.at(i) as FormGroup
      const duration = ctrl.get('duration') as FormControl
      duration.setValidators([
        (c: AbstractControl) => {
          const v = c.value
          if (v == null || v === '') return null
          if (typeof v !== 'number') return { durationType: true }
          if (v < 1) return { min: true }
          if (maxDays > 0 && v > maxDays) return { durationExceedsExpiry: true, maxDays }
          return null
        },
      ])
      duration.updateValueAndValidity({ emitEvent: false })
    }
  }
}
