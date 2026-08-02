import { Location } from '@angular/common'
import { Component, DestroyRef, ElementRef, inject, OnInit, signal } from '@angular/core'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { FormBuilder, FormGroup, Validators } from '@angular/forms'
import { ActivatedRoute, Router } from '@angular/router'
import { AlertService } from '@core/services/alert.service'
import { scrollToFirstInvalidField } from '@shared/utils/form-errors.util'
import { VALIDATION_PATTERNS } from '@shared/validators/validation-patterns'
import {
  CreateSupplierDto,
  SupplierType,
  UpdateSupplierDto,
} from '../../interfaces/pharmacy.interfaces'
import { SuppliersService } from '../../services/suppliers.service'

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

  // País y departamento — mismo catálogo y patrón que patient-form (app de alcance
  // nacional, Bolivia por defecto). Ciudad queda como texto libre siempre: a
  // diferencia de pacientes, los proveedores no se limitan a La Paz/Yungas.
  protected readonly departmentOptions = [
    'La Paz', 'Cochabamba', 'Santa Cruz', 'Oruro', 'Potosí', 'Chuquisaca', 'Tarija', 'Beni', 'Pando',
  ]
  protected readonly countryOptions = [
    'Bolivia', 'Perú', 'Chile', 'Argentina', 'Brasil', 'Paraguay', 'Colombia', 'Ecuador',
  ]

  filteredCountries(): string[] {
    return this.filterOptions(this.countryOptions, this.supplierForm?.get('country')?.value)
  }

  /**
   * Si el valor actual ya coincide exacto con una opción (recién seleccionada, o el
   * default sin tocar), devuelve la lista completa — así el usuario ve todas las
   * opciones al abrir el panel sin tener que borrar lo que ya está escrito. Solo
   * filtra por coincidencia parcial mientras está escribiendo texto nuevo.
   */
  private filterOptions(options: string[], rawValue: unknown): string[] {
    const v = String(rawValue ?? '').toLowerCase()
    if (!v || options.some(o => o.toLowerCase() === v)) return options
    return options.filter(o => o.toLowerCase().includes(v))
  }

  // El select de Departamento solo tiene sentido para Bolivia — fuera de ahí no hay
  // lista curada, así que se muestra como texto libre para no sugerir opciones erróneas.
  isBoliviaSelected(): boolean {
    return this.supplierForm?.get('country')?.value === 'Bolivia'
  }

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

    this.watchLocationChanges()
  }

  /**
   * Limpia Departamento/Ciudad cuando el país deja de ser Bolivia — evita dejar un
   * valor "huérfano" visible como texto libre que no corresponde a la nueva
   * selección. No dispara durante loadSupplier() porque ese patchValue usa
   * { emitEvent: false }.
   */
  private watchLocationChanges(): void {
    this.supplierForm.get('country')!.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(country => {
        if (country !== 'Bolivia') {
          this.supplierForm.patchValue({ state: '', city: '' }, { emitEvent: false })
        }
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
      phone: ['', [Validators.pattern(VALIDATION_PATTERNS.phoneBolivia)]],
      country: ['Bolivia', Validators.required],
      state: [''],
      city: [''],
      address: [''],
      notes: [''],
    })
  }

  loadSupplier(): void {
    if (!this.supplierId) return
    this.loading.set(true)
    this.suppliersService.getById(this.supplierId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: supplier => {
        // emitEvent: false — no debe disparar watchLocationChanges() (limpiaría
        // state/city recién asignados si el proveedor no es de Bolivia).
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
          notes: supplier.notes || '',
        }, { emitEvent: false })
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
      state: formValue.state || undefined,
      city: formValue.city || undefined,
      address: formValue.address || undefined,
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
    scrollToFirstInvalidField(this.elRef.nativeElement as HTMLElement)
  }

  // Badges de error por sección — cuentan controles inválidos+touched de los campos
  // de cada tarjeta visual (un único FormGroup, sin subgrupos por sección).
  fiscalInfoErrorCount(): number {
    return this.countSectionErrors(['nombreComercial', 'razonSocial', 'idTributario', 'tipoProveedor'])
  }

  contactErrorCount(): number {
    return this.countSectionErrors(['contactPerson', 'email', 'phone'])
  }

  locationErrorCount(): number {
    return this.countSectionErrors(['country', 'state', 'city', 'address'])
  }

  notesErrorCount(): number {
    return this.countSectionErrors(['notes'])
  }

  private countSectionErrors(fieldNames: string[]): number {
    return fieldNames.filter(name => {
      const c = this.supplierForm.get(name)
      return !!c && c.invalid && c.touched
    }).length
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
