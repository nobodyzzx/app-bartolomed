import { Location } from '@angular/common'
import { Component, DestroyRef, ElementRef, inject, OnInit, signal } from '@angular/core'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { FormBuilder, FormGroup, Validators } from '@angular/forms'
import { ActivatedRoute, Router } from '@angular/router'
import { AlertService } from '@core/services/alert.service'
import {
  CreateSupplierDto,
  SupplierType,
  UpdateSupplierDto,
} from '../../interfaces/pharmacy.interfaces'
import { SuppliersService } from '../../services/suppliers.service'

interface Country {
  code: string
  name: string
  states: string[]
}

const COUNTRIES: Country[] = [
  {
    code: 'BO',
    name: 'Bolivia',
    states: [
      'Chuquisaca',
      'La Paz',
      'Cochabamba',
      'Oruro',
      'Potosí',
      'Tarija',
      'Santa Cruz',
      'Beni',
      'Pando',
    ],
  },
  {
    code: 'MX',
    name: 'México',
    states: [
      'Aguascalientes',
      'Baja California',
      'Baja California Sur',
      'Campeche',
      'Chiapas',
      'Chihuahua',
      'Ciudad de México',
      'Coahuila',
      'Colima',
      'Durango',
      'Guanajuato',
      'Guerrero',
      'Hidalgo',
      'Jalisco',
      'México',
      'Michoacán',
      'Morelos',
      'Nayarit',
      'Nuevo León',
      'Oaxaca',
      'Puebla',
      'Querétaro',
      'Quintana Roo',
      'San Luis Potosí',
      'Sinaloa',
      'Sonora',
      'Tabasco',
      'Tamaulipas',
      'Tlaxcala',
      'Veracruz',
      'Yucatán',
      'Zacatecas',
    ],
  },
  {
    code: 'US',
    name: 'Estados Unidos',
    states: ['California', 'Texas', 'Florida', 'New York', 'Illinois'],
  },
  {
    code: 'CO',
    name: 'Colombia',
    states: ['Bogotá D.C.', 'Antioquia', 'Valle del Cauca', 'Cundinamarca', 'Atlántico'],
  },
  { code: 'AR', name: 'Argentina', states: ['Buenos Aires', 'Córdoba', 'Santa Fe', 'Mendoza'] },
  { code: 'CL', name: 'Chile', states: ['Santiago', 'Valparaíso', 'Concepción'] },
  { code: 'PE', name: 'Perú', states: ['Lima', 'Arequipa', 'Cusco'] },
  { code: 'ES', name: 'España', states: ['Madrid', 'Barcelona', 'Valencia'] },
]

@Component({
    selector: 'app-supplier-form',
    templateUrl: './supplier-form.component.html',
    styleUrls: ['./supplier-form.component.css'],
    standalone: false
})
export class SupplierFormComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef)

  supplierForm!: FormGroup
  loading = signal(false)
  isEditMode = false
  supplierId: string | null = null

  readonly supplierTypes = Object.values(SupplierType)
  readonly countries = COUNTRIES
  availableStates = signal<string[]>([])

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private suppliersService: SuppliersService,
    private alertService: AlertService,
    private elRef: ElementRef,
  ) {}

  ngOnInit(): void {
    this.initForm()

    this.supplierId = this.route.snapshot.paramMap.get('id')
    if (this.supplierId) {
      this.isEditMode = true
      this.loadSupplier()
    }

    this.supplierForm.get('country')?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(countryCode => {
      this.onCountryChange(countryCode)
    })
  }

  initForm(): void {
    this.supplierForm = this.fb.group({
      nombreComercial: ['', [Validators.required, Validators.minLength(3)]],
      razonSocial: ['', Validators.required],
      idTributario: ['', Validators.required],
      tipoProveedor: [SupplierType.MEDICAMENTOS, Validators.required],
      contactPerson: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      phone: [''],
      country: ['', Validators.required],
      state: [{ value: '', disabled: true }, Validators.required],
      city: [''],
      address: [''],
      postalCode: [''],
      notes: [''],
    })
  }

  onCountryChange(countryCode: string): void {
    const country = this.countries.find(c => c.code === countryCode)
    const stateControl = this.supplierForm.get('state')

    if (country && country.states.length > 0) {
      this.availableStates.set(country.states)
      stateControl?.enable()
      stateControl?.setValue('')
    } else {
      this.availableStates.set([])
      stateControl?.disable()
      stateControl?.setValue('')
    }
  }

  loadSupplier(): void {
    if (!this.supplierId) return
    this.loading.set(true)
    this.suppliersService.getById(this.supplierId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: supplier => {
        this.supplierForm.patchValue({
          nombreComercial: supplier.nombreComercial,
          razonSocial: supplier.razonSocial || '',
          idTributario: supplier.idTributario || '',
          tipoProveedor: supplier.tipoProveedor || 'medicamentos',
          contactPerson: supplier.contactPerson || '',
          email: supplier.email,
          phone: supplier.phone || '',
          country: supplier.country || '',
          state: supplier.state || '',
          city: supplier.city || '',
          address: supplier.address || '',
          postalCode: supplier.postalCode || '',
          notes: supplier.notes || '',
        })
        // Actualizar estados disponibles si hay país seleccionado
        if (supplier.country) {
          this.onCountryChange(supplier.country)
        }
        this.loading.set(false)
      },
      error: () => {
        this.alertService.error('Error', 'No se pudo cargar el proveedor')
        this.loading.set(false)
        this.goBack()
      },
    })
  }

  async onSubmit(): Promise<void> {
    if (this.supplierForm.invalid) {
      this.supplierForm.markAllAsTouched()
      this.scrollToFirstError()
      return
    }

    const formValue = this.supplierForm.getRawValue() // Obtener todos los valores incluyendo disabled

    const dto: CreateSupplierDto = {
      nombreComercial: formValue.nombreComercial,
      razonSocial: formValue.razonSocial,
      idTributario: formValue.idTributario,
      tipoProveedor: formValue.tipoProveedor,
      contactPerson: formValue.contactPerson,
      email: formValue.email,
      phone: formValue.phone || undefined,
      country: formValue.country,
      state: formValue.state,
      city: formValue.city || undefined,
      address: formValue.address || undefined,
      postalCode: formValue.postalCode || undefined,
      notes: formValue.notes || undefined,
    }

    this.loading.set(true)

    if (this.isEditMode && this.supplierId) {
      const upd: UpdateSupplierDto = dto
      this.suppliersService.update(this.supplierId, upd).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => {
          this.alertService.success('Actualizado', 'Proveedor modificado correctamente')
          this.router.navigate(['/dashboard/pharmacy/suppliers'])
        },
        error: () => {
          this.alertService.error('Error', 'No se pudo actualizar el proveedor')
          this.loading.set(false)
        },
      })
    } else {
      this.suppliersService.create(dto).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => {
          this.alertService.success('Creado', 'Proveedor creado correctamente')
          this.router.navigate(['/dashboard/pharmacy/suppliers'])
        },
        error: err => {
          const errorMsg = Array.isArray(err?.error?.message)
            ? err.error.message.join(', ')
            : err?.error?.message || 'No se pudo crear el proveedor'
          this.alertService.error('Error', errorMsg)
          this.loading.set(false)
        },
      })
    }
  }

  goBack(): void {
    this.location.back()
  }

  cancel(): void {
    this.router.navigate(['/dashboard/pharmacy/suppliers'])
  }

  private scrollToFirstError(): void {
    requestAnimationFrame(() => {
      const el = this.elRef.nativeElement.querySelector('.mat-form-field-invalid')
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }

  getSupplierTypeLabel(type: SupplierType): string {
    const labels: Record<SupplierType, string> = {
      [SupplierType.MEDICAMENTOS]: 'Medicamentos',
      [SupplierType.INSUMOS]: 'Insumos',
      [SupplierType.SERVICIOS]: 'Servicios',
    }
    return labels[type] || type
  }
}
