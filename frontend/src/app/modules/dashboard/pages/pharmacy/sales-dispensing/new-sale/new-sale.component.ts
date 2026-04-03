import { Location } from '@angular/common'
import { Component, computed, DestroyRef, ElementRef, inject, OnInit, signal, ViewChild } from '@angular/core'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { FormBuilder, FormGroup, Validators } from '@angular/forms'
import { Router } from '@angular/router'
import { AlertService } from '@core/services/alert.service'
import { ClinicContextService } from '../../../../../clinics/services/clinic-context.service'
import { Patient } from '../../../patients/interfaces/patient.interface'
import { PatientsService } from '../../../patients/services/patients.service'
import { PrescriptionsService } from '../../../prescriptions/prescriptions.service'
import { CreateSaleDto, MedicationStock, PaymentMethod, PrescriptionListItem } from '../../interfaces/pharmacy.interfaces'
import { InventoryService } from '../../services/inventory.service'
import { SalesDispensingService } from '../../services/sales-dispensing.service'
import { CartItem, SaleCartService } from './sale-cart.service'

@Component({
  selector: 'app-new-sale',
  templateUrl: './new-sale.component.html',
  providers: [SaleCartService],
})
export class NewSaleComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef)
  readonly cart = inject(SaleCartService)

  @ViewChild('patientInput') patientInput?: ElementRef<HTMLInputElement>
  form: FormGroup
  loading = signal(false)
  loadingStocks = signal(false)
  loadingPatients = signal(false)

  selectedPatientName = signal<string>('')
  patientSearchTerm = signal<string>('')
  patientOptions = signal<Patient[]>([])
  patientSearchLoading = signal<boolean>(false)
  private patientSearchTimer?: ReturnType<typeof setTimeout>

  prescriptions = signal<PrescriptionListItem[]>([])
  loadingPrescriptions = signal<boolean>(false)

  // Mostrar nombre del medicamento en el input del autocomplete en lugar del UUID
  stockDisplayWithFn = (stockId: string | null): string => {
    if (!stockId) return ''
    const s = this.cart.stocks().find(s => s.id === stockId)
    return s ? this.getStockDisplay(s) : ''
  }

  // Mostrar nombre en el input del autocomplete en lugar del ID
  patientDisplayWith = (value: string | Patient | null): string => {
    if (!value) return ''
    if (typeof value !== 'string') {
      return `${value.firstName || ''} ${value.lastName || ''}`.trim()
    }
    const p = this.patientOptions().find(x => x.id === value)
    if (p) return `${p.firstName || ''} ${p.lastName || ''}`.trim()
    return this.selectedPatientName() || ''
  }

  // Payment method options
  paymentMethods = [
    { value: PaymentMethod.CASH, label: 'Efectivo', icon: 'payments' },
    { value: PaymentMethod.CARD, label: 'Tarjeta', icon: 'credit_card' },
    { value: PaymentMethod.TRANSFER, label: 'Transferencia', icon: 'account_balance' },
    { value: PaymentMethod.QR, label: 'QR', icon: 'qr_code' },
  ]

  // Computed totals (dependen de form + cart)
  taxRate = computed(() => this.form?.get('taxRate')?.value || 0.13)
  discountAmount = computed(() => this.form?.get('discountAmount')?.value || 0)
  taxAmount = computed(() => 0) // desactivado temporalmente
  totalAmount = computed(() => this.cart.subtotal() - this.discountAmount())
  amountPaid = signal(0)
  changeAmount = computed(() => {
    const change = this.amountPaid() - this.totalAmount()
    return change > 0 ? change : 0
  })

  selectedStockId = signal<string | null>(null)
  selectedStock = computed(() => {
    const id = this.selectedStockId()
    return id ? this.cart.stocks().find(s => s.id === id) || null : null
  })

  constructor(
    private fb: FormBuilder,
    private salesService: SalesDispensingService,
    private inventoryService: InventoryService,
    private clinicContext: ClinicContextService,
    private alert: AlertService,
    private router: Router,
    private location: Location,
    private patientsService: PatientsService,
    private prescriptionsService: PrescriptionsService,
  ) {
    this.form = this.fb.group({
      patientId: [''],
      paymentMethod: [PaymentMethod.CASH, Validators.required],
      taxRate: [0.13, [Validators.required, Validators.min(0), Validators.max(1)]],
      discountAmount: [0, [Validators.min(0)]],
      amountPaid: [0, [Validators.required, Validators.min(0)]],
      notes: [''],
      prescriptionNumber: [''],
      // Item form
      tempStockId: [''],
      tempQuantity: [1, [Validators.min(1)]],
      tempUnitPrice: [0, [Validators.min(0)]],
      tempDiscountPercent: [0, [Validators.min(0), Validators.max(100)]],
    })
  }

  ngOnInit(): void {
    const clinicId = this.clinicContext.clinicId

    if (!clinicId) {
      this.alert.warning('Clínica no detectada', 'No se puede crear una venta sin contexto de clínica')
      this.goBack()
      return
    }

    this.loadStocks(clinicId)

    // Auto-cargar precio de venta al seleccionar stock
    this.form.get('tempStockId')?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(stockId => {
      this.selectedStockId.set(stockId)
      const stock = this.selectedStock()
      if (stock) {
        this.form.patchValue({ tempUnitPrice: stock.sellingPrice || stock.unitCost || 0 })
      }
    })

    // Sincronizar amountPaid signal con el form field
    this.form.get('amountPaid')?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(value => {
      this.amountPaid.set(value || 0)
    })
  }

  onPatientInput(value: string): void {
    this.patientSearchTerm.set(value)
    if (this.patientSearchTimer) clearTimeout(this.patientSearchTimer)
    const term = (value || '').trim()
    if (!term || term.length < 2) {
      this.patientOptions.set([])
      return
    }
    this.patientSearchTimer = setTimeout(() => {
      const clinicId = this.clinicContext.clinicId || undefined
      this.patientSearchLoading.set(true)
      this.patientsService.searchPatients(term, clinicId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: patients => {
          this.patientOptions.set(patients || [])
          this.patientSearchLoading.set(false)
        },
        error: () => {
          this.patientOptions.set([])
          this.patientSearchLoading.set(false)
        },
      })
    }, 250)
  }

  onPatientSelected(id: string): void {
    if (!id) {
      this.form.get('patientId')?.setValue('')
      this.selectedPatientName.set('')
      this.prescriptions.set([])
      setTimeout(() => this.patientInput?.nativeElement.focus(), 0)
      return
    }
    this.form.get('patientId')?.setValue(id)
    const found = this.patientOptions().find(p => p.id === id)
    if (found) {
      this.selectedPatientName.set(`${found.firstName || ''} ${found.lastName || ''}`.trim())
      this.loadPatientPrescriptions(id)
      return
    }
    this.loadingPatients.set(true)
    this.patientsService.getPatientById(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: patient => {
        this.selectedPatientName.set(`${patient.firstName || ''} ${patient.lastName || ''}`.trim())
        this.loadingPatients.set(false)
        this.loadPatientPrescriptions(id)
      },
      error: () => {
        this.selectedPatientName.set('')
        this.loadingPatients.set(false)
        this.prescriptions.set([])
      },
    })
  }

  clearPatient(): void {
    this.form.get('patientId')?.setValue('')
    this.selectedPatientName.set('')
    this.prescriptions.set([])
    setTimeout(() => this.patientInput?.nativeElement.focus(), 0)
  }

  loadPatientPrescriptions(patientId: string): void {
    if (!patientId) {
      this.prescriptions.set([])
      return
    }
    const clinicId = this.clinicContext.clinicId || undefined
    this.loadingPrescriptions.set(true)
    this.prescriptionsService.list(1, 50, { patientId, clinicId, status: 'active' }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response: any) => {
        const items = response?.items || []
        const now = new Date()
        this.prescriptions.set(
          items.filter((p: PrescriptionListItem) => {
            if (!p.expiryDate) return true
            return new Date(p.expiryDate) >= now
          }),
        )
        this.loadingPrescriptions.set(false)
      },
      error: () => {
        this.prescriptions.set([])
        this.loadingPrescriptions.set(false)
      },
    })
  }

  onPrescriptionSelected(prescriptionId: string): void {
    if (!prescriptionId) {
      this.form.patchValue({ prescriptionNumber: '' })
      return
    }
    const pr = this.prescriptions().find(p => p.id === prescriptionId)
    if (!pr) return
    this.form.patchValue({ prescriptionNumber: pr.prescriptionNumber || '' })
    this.applyPrescription(pr)
  }

  applyPrescription(p: PrescriptionListItem): void {
    if (!p || !p.items || p.items.length === 0) {
      this.alert.warning('Receta vacía', 'Esta receta no tiene ítems para cargar')
      return
    }

    this.form.patchValue({ prescriptionNumber: p.prescriptionNumber || '' })

    const missing: string[] = []
    const insufficient: string[] = []
    const added: string[] = []
    let addedLines = 0

    for (const it of p.items) {
      const name = (it.medicationName || '').trim().toLowerCase()
      if (!name) continue
      const requested = Number(parseFloat(String(it.quantity))) || 1
      let remaining = requested

      const candidates = this.cart.stocks()
        .filter(
          s =>
            (s.medication?.name || '').trim().toLowerCase() === name &&
            (s.availableQuantity || 0) > 0,
        )
        .sort((a, b) => {
          const da = a.expiryDate ? new Date(a.expiryDate).getTime() : Infinity
          const db = b.expiryDate ? new Date(b.expiryDate).getTime() : Infinity
          return da - db
        })

      if (candidates.length === 0) {
        missing.push(`${it.medicationName} (${requested})`)
        continue
      }

      for (const stock of candidates) {
        if (remaining <= 0) break
        const avail = stock.availableQuantity || 0
        if (avail <= 0) continue
        const take = Math.min(avail, remaining)
        this.cart.addOrUpdate(stock, take, stock.sellingPrice || stock.unitCost || 0, 0)
        remaining -= take
        if (take > 0) {
          addedLines += 1
          added.push(`${it.medicationName} (${take})`)
        }
      }

      if (remaining > 0) insufficient.push(`${it.medicationName} (faltan ${remaining})`)
    }

    if (addedLines > 0) {
      this.alert.success('Receta aplicada', `Se agregaron ${addedLines} líneas desde la receta ${p.prescriptionNumber || p.id}`)
    } else {
      this.alert.warning('Sin cambios', 'No se pudo agregar ningún producto de esta receta')
    }

    if (missing.length > 0 || insufficient.length > 0) {
      const msgParts: string[] = []
      if (missing.length > 0) msgParts.push(`❌ No encontrados: ${missing.join(', ')}`)
      if (insufficient.length > 0) msgParts.push(`⚠️ Stock insuficiente: ${insufficient.join(', ')}`)
      this.alert.fire({
        icon: 'warning',
        title: 'Aviso de inventario',
        html: `<div class="text-left text-sm">${msgParts.join('<br>')}</div>`,
        confirmButtonText: 'Entendido',
      })
    }
  }

  loadStocks(clinicId: string): void {
    this.loadingStocks.set(true)
    this.inventoryService.getAllStock(clinicId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (stocks: MedicationStock[]) => {
        this.cart.setStocks(
          stocks.filter(s => (s.clinicId || s.clinic?.id) === clinicId && (s.availableQuantity || 0) > 0),
        )
        this.loadingStocks.set(false)
      },
      error: () => {
        this.loadingStocks.set(false)
        this.alert.error('Error', 'No se pudo cargar el inventario')
      },
    })
  }

  addItem(): void {
    const stockId = this.form.get('tempStockId')?.value
    const quantity = this.form.get('tempQuantity')?.value
    const unitPrice = this.form.get('tempUnitPrice')?.value
    const discountPercent = this.form.get('tempDiscountPercent')?.value || 0

    if (!stockId || quantity <= 0 || unitPrice < 0) {
      this.alert.warning('Datos incompletos', 'Complete todos los campos del producto')
      return
    }

    const stock = this.cart.stocks().find(s => s.id === stockId)
    if (!stock) {
      this.alert.error('Error', 'Producto no encontrado')
      return
    }

    // Validar stock disponible
    const availableQty = stock.availableQuantity || 0
    const existingItem = this.cart.items().find(it => it.medicationStock.id === stockId)
    const alreadyInCart = existingItem?.quantity || 0

    if (alreadyInCart + quantity > availableQty) {
      this.alert.error(
        'Stock insuficiente',
        `Solo hay ${availableQty} unidades disponibles (${alreadyInCart > 0 ? `ya tiene ${alreadyInCart} en la venta` : 'disponibles'})`,
      )
      return
    }

    // Validar fecha de expiración (solo para ítems nuevos)
    if (!existingItem && stock.expiryDate) {
      const daysUntilExpiry = Math.ceil(
        (new Date(stock.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      )
      if (daysUntilExpiry < 0) {
        this.alert.error('Producto vencido', 'No se puede vender un producto vencido')
        return
      }
      if (daysUntilExpiry <= 30) {
        this.alert.warning('Producto próximo a vencer', `Este producto vence en ${daysUntilExpiry} días`)
      }
    }

    const err = this.cart.addOrUpdate(stock, quantity, unitPrice, discountPercent)
    if (!err) {
      if (existingItem) {
        this.alert.success('Cantidad actualizada', `Nueva cantidad: ${existingItem.quantity + quantity} unidades`)
      }
    }

    // Reset temp fields
    this.form.patchValue({ tempStockId: '', tempQuantity: 1, tempUnitPrice: 0, tempDiscountPercent: 0 })
    this.selectedStockId.set(null)
  }

  removeItem(index: number): void {
    this.cart.removeItem(index)
  }

  updateItemQuantity(index: number, newQuantity: number): void {
    if (newQuantity <= 0) {
      this.alert.warning('Cantidad inválida', 'La cantidad debe ser mayor a 0')
      return
    }
    const err = this.cart.updateQuantity(index, newQuantity)
    if (err) this.alert.error('Stock insuficiente', err)
  }

  updateItemDiscount(index: number, newDiscountPercent: number): void {
    if (newDiscountPercent < 0 || newDiscountPercent > 100) {
      this.alert.warning('Descuento inválido', 'El descuento debe estar entre 0% y 100%')
      return
    }
    this.cart.updateDiscount(index, newDiscountPercent)
  }

  getStockDisplay(stock: MedicationStock): string {
    return `${stock.medication?.name || 'N/A'} - Lote: ${stock.batchNumber} (${stock.availableQuantity || 0} disp.)`
  }

  getPaymentMethodIcon(method: PaymentMethod): string {
    return this.paymentMethods.find(pm => pm.value === method)?.icon || 'payment'
  }

  getPaymentMethodLabel(method: PaymentMethod): string {
    return this.paymentMethods.find(pm => pm.value === method)?.label || 'Desconocido'
  }

  async submit(): Promise<void> {
    if (this.cart.items().length === 0) {
      this.alert.warning('Venta vacía', 'Agregue al menos un producto a la venta')
      return
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched()
      this.alert.warning('Formulario inválido', 'Complete los campos requeridos')
      return
    }

    const total = this.totalAmount()
    const paid = this.amountPaid()

    const hasLowPriceItems = this.cart.items().some(
      item => item.unitPrice < (item.medicationStock.unitCost || 0),
    )

    if (hasLowPriceItems) {
      const result = await this.alert.fire({
        icon: 'warning',
        title: 'Precio por debajo del costo',
        text: 'Algunos productos tienen precio de venta menor al costo. ¿Desea continuar?',
        showCancelButton: true,
        confirmButtonText: 'Continuar',
        cancelButtonText: 'Revisar',
      })
      if (!result.isConfirmed) return
    }

    if (paid < total) {
      const result = await this.alert.fire({
        icon: 'warning',
        title: 'Pago insuficiente',
        html: `
          <div class="text-left">
            <p class="mb-2">El monto pagado es menor al total:</p>
            <div class="bg-slate-100 p-3 rounded">
              <p class="mb-1"><strong>Total:</strong> Bs ${total.toFixed(2)}</p>
              <p class="mb-1"><strong>Pagado:</strong> Bs ${paid.toFixed(2)}</p>
              <p class="text-red-600"><strong>Falta:</strong> Bs ${(total - paid).toFixed(2)}</p>
            </div>
            <p class="mt-3">La venta se registrará como deuda pendiente de cobro. ¿Continuar?</p>
          </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Continuar',
        cancelButtonText: 'Cancelar',
      })
      if (!result.isConfirmed) return
    }

    const confirmation = await this.alert.fire({
      icon: 'question',
      title: 'Confirmar venta',
      html: `
        <div class="text-left">
          <p class="mb-3">Resumen de la venta:</p>
          <div class="bg-blue-50 p-3 rounded mb-3">
            <p class="mb-1"><strong>Productos:</strong> ${this.cart.items().length} (${this.cart.totalUnits()} unidades)</p>
            <p class="mb-1"><strong>Subtotal:</strong> Bs ${this.cart.subtotal().toFixed(2)}</p>
            ${this.discountAmount() > 0 ? `<p class="mb-1"><strong>Descuento:</strong> -Bs ${this.discountAmount().toFixed(2)}</p>` : ''}
            <p class="mb-1"><strong>Impuestos:</strong> Bs ${this.taxAmount().toFixed(2)}</p>
            <p class="text-lg"><strong>Total:</strong> Bs ${total.toFixed(2)}</p>
          </div>
          <p class="mb-1"><strong>Método de pago:</strong> ${this.getPaymentMethodLabel(this.form.value.paymentMethod)}</p>
          <p class="mb-1"><strong>Monto pagado:</strong> Bs ${paid.toFixed(2)}</p>
          ${paid > total ? `<p class="text-green-600"><strong>Cambio:</strong> Bs ${this.changeAmount().toFixed(2)}</p>` : ''}
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Registrar venta',
      cancelButtonText: 'Cancelar',
    })

    if (!confirmation.isConfirmed) return

    const createDto: CreateSaleDto = {
      patientId: this.form.value.patientId || undefined,
      patientName: this.selectedPatientName() || undefined,
      clinicId: this.clinicContext.clinicId!,
      paymentMethod: this.form.value.paymentMethod,
      taxRate: Number(this.form.value.taxRate),
      discountAmount: Number(this.form.value.discountAmount),
      amountPaid: Number(this.form.value.amountPaid),
      notes: this.form.value.notes,
      prescriptionNumber: this.form.value.prescriptionNumber,
      items: this.cart.items().map((item: CartItem) => ({
        medicationStockId: item.medicationStock.id,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        discountPercent: Number(item.discountPercent) || 0,
        batchNumber: item.medicationStock.batchNumber,
        expiryDate: item.medicationStock.expiryDate,
      })),
    }

    this.loading.set(true)
    this.salesService.createSale(createDto).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: sale => {
        this.alert.success('Venta completada', `Venta ${sale.saleNumber} registrada y stock actualizado`)
        this.router.navigate(['/dashboard/pharmacy/sales-dispensing'])
      },
      error: () => {
        this.loading.set(false)
      },
    })
  }

  goBack(): void {
    this.location.back()
  }
}
