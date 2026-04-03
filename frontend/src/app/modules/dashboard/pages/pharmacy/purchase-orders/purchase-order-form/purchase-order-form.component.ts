import { Location } from '@angular/common'
import { Component, DestroyRef, ElementRef, inject, OnInit, signal } from '@angular/core'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms'
import { ActivatedRoute, Router } from '@angular/router'
import { AlertService } from '@core/services/alert.service'
import { Medication, Supplier } from '../../interfaces/pharmacy.interfaces'
import { InventoryService } from '../../services/inventory.service'
import { PurchaseOrdersService } from '../../services/purchase-orders.service'
import { SuppliersService } from '../../services/suppliers.service'

@Component({
  selector: 'app-purchase-order-form',
  templateUrl: './purchase-order-form.component.html',
  styleUrls: ['./purchase-order-form.component.css'],
})
export class PurchaseOrderFormComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef)

  orderForm!: FormGroup
  loading = signal(false)
  isEditMode = false
  orderId: string | null = null

  suppliers = signal<Supplier[]>([])
  medications = signal<Medication[]>([])
  selectedSupplier = signal<Supplier | null>(null)

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private ordersService: PurchaseOrdersService,
    private suppliersService: SuppliersService,
    private inventoryService: InventoryService,
    private alertService: AlertService,
    private elRef: ElementRef,
  ) {}

  ngOnInit(): void {
    this.initForm()

    // Determinar modo antes de cargar catálogos
    this.orderId = this.route.snapshot.paramMap.get('id')
    this.isEditMode = !!this.orderId

    this.loadSuppliers()
    this.loadMedications()

    // Observar cambios en el proveedor
    this.orderForm.get('supplierId')?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(supplierId => {
      const supplier = this.suppliers().find(s => s.id === supplierId)
      this.selectedSupplier.set(supplier || null)
    })
  }

  initForm(): void {
    this.orderForm = this.fb.group({
      supplierId: ['', Validators.required],
      orderDate: [new Date().toISOString().split('T')[0], Validators.required],
      expectedDeliveryDate: ['', Validators.required],
      notes: [''],
      items: this.fb.array([]),
    })
  }

  get items(): FormArray {
    return this.orderForm.get('items') as FormArray
  }

  get totalAmount(): number {
    return this.items.controls.reduce((sum, item) => {
      const qty = Number(item.get('quantity')?.value) || 0
      const price = Number(item.get('unitPrice')?.value) || 0
      return sum + qty * price
    }, 0)
  }

  get totalItems(): number {
    return this.items.length
  }

  get totalUnits(): number {
    return this.items.controls.reduce((sum, item) => {
      const qty = Number(item.get('quantity')?.value) || 0
      return sum + qty
    }, 0)
  }

  createItemFormGroup(): FormGroup {
    return this.fb.group({
      medicationId: ['', Validators.required],
      quantity: [null, [Validators.required, Validators.min(1)]],
      unitPrice: [null, [Validators.required, Validators.min(0.01)]],
      notes: [''],
    })
  }

  addItem(): void {
    this.items.push(this.createItemFormGroup())
  }

  removeItem(index: number): void {
    if (this.items.length > 1) {
      this.items.removeAt(index)
    } else {
      this.alertService.warning('Atención', 'Debe haber al menos un ítem en la orden')
    }
  }

  getItemTotal(index: number): number {
    const item = this.items.at(index)
    const qty = Number(item.get('quantity')?.value) || 0
    const price = Number(item.get('unitPrice')?.value) || 0
    return qty * price
  }

  loadSuppliers(): void {
    this.suppliersService.getAll().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: list => this.suppliers.set(list.filter(s => s.status === 'active' || s.isActive)),
      error: () => this.alertService.error('Error', 'No se pudieron cargar los proveedores'),
    })
  }

  loadMedications(): void {
    this.inventoryService.getAllMedications().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: result => {
        this.medications.set(result.data)
        // Una vez cargados los medicamentos, cargamos la orden (edición) o agregamos item inicial
        if (this.isEditMode && this.orderId) {
          this.loadOrder()
        } else if (!this.isEditMode && this.items.length === 0) {
          this.addItem()
        }
      },
      error: () => this.alertService.error('Error', 'No se pudieron cargar los medicamentos'),
    })
  }

  loadOrder(): void {
    if (!this.orderId) return
    this.loading.set(true)

    this.ordersService.getById(this.orderId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: order => {
        this.orderForm.patchValue({
          supplierId: order.supplierId,
          orderDate: order.orderDate ? new Date(order.orderDate).toISOString().split('T')[0] : '',
          expectedDeliveryDate: order.expectedDeliveryDate
            ? new Date(order.expectedDeliveryDate).toISOString().split('T')[0]
            : '',
          notes: order.notes,
        })

        // Cargar items
        if (order.items && order.items.length > 0) {
          this.items.clear()
          order.items.forEach(item => {
            const medId =
              item.medicationId ||
              this.findMedicationIdByName(item.medicationName || item.productName)
            this.items.push(
              this.fb.group({
                medicationId: [medId || '', Validators.required],
                quantity: [item.quantity, [Validators.required, Validators.min(1)]],
                unitPrice: [item.unitPrice, [Validators.required, Validators.min(0.01)]],
                notes: [item.notes || ''],
              }),
            )
          })
        }

        this.loading.set(false)
      },
      error: () => {
        this.alertService.error('Error', 'No se pudo cargar la orden')
        this.loading.set(false)
        this.goBack()
      },
    })
  }

  async onSubmit(): Promise<void> {
    if (this.orderForm.invalid) {
      this.orderForm.markAllAsTouched()
      this.scrollToFirstError()
      return
    }

    if (this.items.length === 0) {
      this.alertService.error('Validación', 'Debe agregar al menos un ítem')
      return
    }

    const formValue = this.orderForm.value

    const dto = {
      supplierId: formValue.supplierId,
      orderDate: formValue.orderDate,
      expectedDeliveryDate: formValue.expectedDeliveryDate,
      notes: formValue.notes || undefined,
      items: formValue.items.map((item: any) => {
        const medication = this.medications().find(m => m.id === item.medicationId)
        return {
          productName: medication?.name || 'Producto sin nombre',
          medicationId: item.medicationId,
          medicationName: medication?.name,
          brand: medication?.brandName,
          productCode: medication?.code,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
          notes: item.notes || undefined,
        }
      }),
    }

    this.loading.set(true)

    if (this.isEditMode && this.orderId) {
      this.ordersService.update(this.orderId, dto).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => {
          this.alertService.success('Actualizado', 'Orden actualizada correctamente')
          this.router.navigate(['/dashboard/pharmacy/purchase-orders'])
        },
        error: err => {
          const errorMsg = Array.isArray(err?.error?.message)
            ? err.error.message.join(', ')
            : err?.error?.message || 'No se pudo actualizar la orden'
          this.alertService.error('Error', errorMsg)
          this.loading.set(false)
        },
      })
    } else {
      this.ordersService.create(dto).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => {
          this.alertService.success('Creado', 'Orden creada correctamente')
          this.router.navigate(['/dashboard/pharmacy/purchase-orders'])
        },
        error: err => {
          const errorMsg = Array.isArray(err?.error?.message)
            ? err.error.message.join(', ')
            : err?.error?.message || 'No se pudo crear la orden'
          this.alertService.error('Error', errorMsg)
          this.loading.set(false)
        },
      })
    }
  }

  private scrollToFirstError(): void {
    requestAnimationFrame(() => {
      const el = this.elRef.nativeElement.querySelector('.mat-form-field-invalid')
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }

  goBack(): void {
    this.location.back()
  }

  cancel(): void {
    this.router.navigate(['/dashboard/pharmacy/purchase-orders'])
  }

  getMedicationName(medicationId: string): string {
    const med = this.medications().find(m => m.id === medicationId)
    return med ? `${med.name} ${med.brandName ? '- ' + med.brandName : ''}` : ''
  }

  private findMedicationIdByName(name?: string): string {
    if (!name) return ''
    const normalized = name.trim().toLowerCase()
    const found = this.medications().find(
      m =>
        m.name.trim().toLowerCase() === normalized ||
        m.brandName?.trim().toLowerCase() === normalized,
    )
    return found?.id || ''
  }
}
