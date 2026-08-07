import { Component, ElementRef, inject, signal } from '@angular/core'
import { AbstractControl, FormArray, FormControl, FormGroup, Validators } from '@angular/forms'
import { ActivatedRoute, Router } from '@angular/router'
import { AlertService } from '@core/services/alert.service'
import { countInvalidFields, scrollToFirstInvalidField } from '../../../../shared/utils/form-errors.util'
import { ClinicsService } from '../admin/clinics/services/clinics.service'
import { PatientsService } from '../patients/services/patients.service'
import { UsersService } from '../admin/users/users.service'
import { ClinicContextService } from '../../../clinics/services/clinic-context.service'
import { CanComponentDeactivate, confirmDiscardChanges } from '../../../../core/guards/can-deactivate.guard'
import { LaboratoryService } from './laboratory.service'
import {
  ServiceCategory,
  ServicePriceCatalogItem,
  ServicePricesService,
} from '../service-prices/service-prices.service'

@Component({
    selector: 'app-lab-order-form',
    templateUrl: './lab-order-form.component.html',
    standalone: false
})
export class LabOrderFormComponent implements CanComponentDeactivate {
  private allowNavigationOnce = false
  route = inject(ActivatedRoute)
  router = inject(Router)
  private svc = inject(LaboratoryService)
  private alert = inject(AlertService)
  private patientsService = inject(PatientsService)
  private usersService = inject(UsersService)
  private clinicsService = inject(ClinicsService)
  private clinicCtx = inject(ClinicContextService)
  private servicePricesService = inject(ServicePricesService)
  private elRef = inject(ElementRef)

  form = new FormGroup({
    orderNumber: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    patientId: new FormControl({ value: '', disabled: true }, { nonNullable: true, validators: [Validators.required] }),
    doctorId: new FormControl({ value: '', disabled: true }, { nonNullable: true, validators: [Validators.required] }),
    clinicId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    orderDate: new FormControl(new Date(), { nonNullable: true, validators: [Validators.required] }),
    isUrgent: new FormControl(false, { nonNullable: true }),
    clinicalNotes: new FormControl(''),
    items: new FormArray<FormGroup<any>>([]),
  })

  loading = false
  isEdit = signal(false)

  patients: any[] = []
  doctors: any[] = []
  clinics: any[] = []
  labCatalog: ServicePriceCatalogItem[] = []

  goBack(): void {
    this.router.navigate(['/dashboard/laboratory'])
  }

  async canDeactivate(): Promise<boolean> {
    if (this.allowNavigationOnce) {
      this.allowNavigationOnce = false
      return true
    }
    if (!this.form?.dirty) return true
    return confirmDiscardChanges(this.alert)
  }

  ngOnInit(): void {
    this.loadOptions()
    this.autoGenerateNumber()
    // Sin modo edición: una vez creada, la orden solo se modifica vía estado/resultado
    // (ver LabOrdersService.update — no permite editar órdenes completadas/canceladas,
    // y los ítems no se reemplazan tras la creación).
    if (this.items.length === 0) this.addItem()
  }

  autoGenerateNumber() {
    const now = new Date()
    const pad = (n: number) => n.toString().padStart(2, '0')
    const value = `LAB-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
    this.form.get('orderNumber')?.setValue(value)
  }

  get items() {
    return this.form.get('items') as FormArray
  }

  addItem() {
    const group = new FormGroup({
      // El estudio se elige del tarifario en vez de escribirse: con texto libre,
      // cualquier nombre que no calzara exactamente con el catálogo dejaba la
      // orden sin precio y, por tanto, sin cargo — en silencio.
      servicePriceId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
      testName: new FormControl('', { nonNullable: true }),
      category: new FormControl('blood', { nonNullable: true, validators: [Validators.required] }),
      specimenType: new FormControl(''),
    })
    this.items.push(group)
  }

  /** Copia el nombre del catálogo al ítem: la orden guarda con qué se pidió. */
  onTestSelected(group: AbstractControl, servicePriceId: string) {
    const chosen = this.labCatalog.find(item => item.id === servicePriceId)
    group.get('testName')?.setValue(chosen?.name ?? '')
  }

  removeItem(i: number) {
    this.items.removeAt(i)
  }

  private loadOptions() {
    this.patientsService.findAll().subscribe({
      next: result => {
        this.patients = result.data || []
        this.updateSelectControlDisabled('patientId', this.patients.length)
      },
      error: () => {
        this.patients = []
        this.updateSelectControlDisabled('patientId', 0)
      },
    })
    this.usersService.getClinicalStaff().subscribe({
      next: staff => {
        this.doctors = (staff || []).filter(u => (u.roles || []).includes('doctor'))
        this.updateSelectControlDisabled('doctorId', this.doctors.length)
      },
      error: () => {
        this.doctors = []
        this.updateSelectControlDisabled('doctorId', 0)
      },
    })
    this.servicePricesService.catalog(ServiceCategory.LABORATORY).subscribe({
      next: catalog => (this.labCatalog = catalog || []),
      error: () => (this.labCatalog = []),
    })
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

  private updateSelectControlDisabled(controlName: string, optionsLength: number): void {
    const control = this.form.get(controlName)
    if (!control) return
    if (optionsLength > 0) {
      control.enable({ emitEvent: false })
    } else {
      control.disable({ emitEvent: false })
    }
  }

  getDoctorName(doctor: any): string {
    const firstName = doctor.personalInfo?.firstName || ''
    const lastName = doctor.personalInfo?.lastName || ''
    return `${firstName} ${lastName}`.trim() || doctor.email
  }

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched()
      scrollToFirstInvalidField(this.elRef.nativeElement as HTMLElement)
      return
    }

    const v = this.form.getRawValue()
    const orderDate = v.orderDate instanceof Date ? v.orderDate.toISOString().slice(0, 10) : v.orderDate

    const payload: any = {
      orderNumber: v.orderNumber,
      orderDate,
      patientId: v.patientId,
      doctorId: v.doctorId,
      clinicId: v.clinicId,
      isUrgent: v.isUrgent,
      clinicalNotes: v.clinicalNotes || undefined,
      items: (v.items || []).map((it: any) => ({
        servicePriceId: it.servicePriceId,
        testName: it.testName,
        category: it.category,
        specimenType: it.specimenType || undefined,
      })),
    }

    this.loading = true
    this.svc.create(payload).subscribe({
      next: (res: any) => {
        this.loading = false
        this.allowNavigationOnce = true
        this.alert.success('Orden creada', 'La orden de laboratorio fue registrada').then(() => {
          this.router.navigate(['/dashboard/laboratory', res.id])
        })
      },
      error: () => (this.loading = false),
    })
  }

  infoErrorCount(): number {
    return countInvalidFields(this.form, ['clinicId', 'orderNumber', 'patientId', 'doctorId', 'orderDate'])
  }

  itemsErrorCount(): number {
    return this.items.controls.reduce((total, item) => total + countInvalidFields(item as FormGroup), 0)
  }
}
