import { Location } from '@angular/common'
import { Component, computed, DestroyRef, ElementRef, inject, OnInit, signal, ViewChild } from '@angular/core'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { FormBuilder, FormGroup, Validators } from '@angular/forms'
import { Router } from '@angular/router'
import { AlertService } from '@core/services/alert.service'
import { ClinicContextService } from '../../../../../clinics/services/clinic-context.service'
import { Patient } from '../../../patients/interfaces/patient.interface'
import { CreateSaleDto, MedicationStock, PaymentMethod, PrescriptionListItem } from '../../interfaces/pharmacy.interfaces'
import { InventoryService } from '../../services/inventory.service'
import { SalesDispensingService } from '../../services/sales-dispensing.service'
import { PAYMENT_METHODS } from '../../../checkout/checkout.service'
import { CartItem, SaleCartService } from './sale-cart.service'
import { SalePatientService } from './sale-patient.service'

@Component({
    selector: 'app-new-sale',
    templateUrl: './new-sale.component.html',
    providers: [SaleCartService, SalePatientService],
    standalone: false
})
export class NewSaleComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef)
  readonly cart = inject(SaleCartService)
  readonly patient = inject(SalePatientService)

  @ViewChild('patientInput') patientInput?: ElementRef<HTMLInputElement>
  form: FormGroup
  loading = signal(false)
  loadingStocks = signal(false)



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
    const p = this.patient.options().find(x => x.id === value)
    if (p) return `${p.firstName || ''} ${p.lastName || ''}`.trim()
    return this.patient.selectedName() || ''
  }

  /**
   * Efectivo y QR son las únicas formas de pago que la clínica maneja. Se
   * derivan de `PAYMENT_METHODS`, la lista compartida con el punto de cobro:
   * tenerla por duplicado fue lo que dejó a farmacia ofreciendo tarjeta y
   * transferencia mientras la caja general ni siquiera ofrecía QR.
   *
   * El enum de farmacia usa sus propios valores (`cash`/`qr` coinciden con los
   * de la caja general, que son justo los dos que quedan).
   */
  paymentMethods = PAYMENT_METHODS.map(m => ({
    value: m.value as PaymentMethod,
    label: m.label,
    icon: m.icon,
  }))

  // Computed totals (dependen de form + cart)
  // Sin IVA: el precio del tarifario es el precio final (decisión del 2026-08-08).
  // Antes la pantalla calculaba el total así —sin impuesto— pero mandaba
  // `taxRate: 0.13` al backend, que sí lo aplicaba: se cobraba 20,00 y la venta
  // quedaba registrada en 22,60.
  // `computed` solo reacciona a señales: leer `form.get(...).value` directamente
  // nunca recalcularía. Los valores del formulario se espejan en señales.
  private readonly formValue = signal<any>({})
  discountAmount = computed(() => Number(this.formValue().discountAmount) || 0)
  discountReasonValue = computed(() => String(this.formValue().discountReason ?? ''))
  totalAmount = computed(() => this.cart.subtotal() - this.discountAmount())
  amountPaid = signal(0)
  changeAmount = computed(() => {
    const change = this.amountPaid() - this.totalAmount()
    return change > 0 ? change : 0
  })

  /**
   * "A cuenta" deja el importe como cargo pendiente del paciente, para que lo
   * cobre la caja general en vez de farmacia. El backend solo lo acepta con
   * receta y paciente registrado: una venta de mostrador se cobra aquí y punto.
   * Si el farmacéutico quita la receta o el paciente, la casilla se apaga sola
   * en vez de dejar el formulario en un estado que el servidor rechazará.
   */
  /**
   * Por qué no se puede registrar la venta todavía; `null` si se puede.
   *
   * Mismo criterio que el punto de cobro: un descuento sin motivo no se registra,
   * porque el motivo es lo único que queda para revisar después una rebaja
   * indebida. Y se dice cuál falta, en vez de dejar el botón gris sin explicación.
   */
  blockingReason = computed<string | null>(() => {
    if (this.cart.items().length === 0) return 'Agrega al menos un producto a la venta.'
    if (this.cart.linesMissingReason() > 0) {
      return 'Falta el motivo de un descuento de la tabla. Un descuento sin motivo no se registra.'
    }
    if (this.discountAmount() > 0 && !this.discountReasonValue().trim()) {
      return 'Falta el motivo del descuento sobre el total.'
    }
    if (this.discountAmount() > this.cart.subtotal()) {
      return 'El descuento supera el importe de los productos.'
    }
    return null
  })

  get canChargeToAccount(): boolean {
    return !!this.form?.get('patientId')?.value && !!this.patient.selectedPrescriptionId()
  }

  get chargeToAccount(): boolean {
    return this.canChargeToAccount && !!this.form?.get('chargeToAccount')?.value
  }

  /**
   * Reactive forms gobierna el estado deshabilitado de sus controles, así que un
   * `[disabled]` en la plantilla se ignora: hay que moverlo desde aquí. Al
   * quedarse sin paciente o sin receta la casilla se apaga y se bloquea, en vez
   * de dejar marcado algo que el backend rechazaría.
   */
  private syncChargeToAccountControl(): void {
    const control = this.form?.get('chargeToAccount')
    if (!control) return

    if (this.canChargeToAccount) {
      if (control.disabled) control.enable({ emitEvent: false })
      return
    }
    if (control.value) control.setValue(false, { emitEvent: false })
    if (control.enabled) control.disable({ emitEvent: false })
  }

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
  ) {
    this.form = this.fb.group({
      patientId: [''],
      chargeToAccount: [false],
      paymentMethod: [PaymentMethod.CASH, Validators.required],
      discountAmount: [0, [Validators.min(0)]],
      discountReason: [''],
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

    this.form
      .get('patientId')
      ?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.syncChargeToAccountControl())

    this.form.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(v => this.formValue.set(v))
    this.formValue.set(this.form.value)

    this.syncChargeToAccountControl()
  }

  // Paciente y recetas viven en `SalePatientService`; aquí solo queda enlazar la
  // selección con el formulario y con el carrito.
  onPatientInput(value: string): void {
    this.patient.search(value)
  }

  onPatientSelected(id: string): void {
    this.patient.select(id)
    this.form.get('patientId')?.setValue(id || '')
    if (!id) {
      this.syncChargeToAccountControl()
      setTimeout(() => this.patientInput?.nativeElement.focus(), 0)
    }
  }

  clearPatient(): void {
    this.patient.clear()
    this.form.get('patientId')?.setValue('')
    this.syncChargeToAccountControl()
    setTimeout(() => this.patientInput?.nativeElement.focus(), 0)
  }

  onPrescriptionSelected(prescriptionId: string): void {
    if (!prescriptionId) {
      this.form.patchValue({ prescriptionNumber: '' })
      this.patient.selectPrescription(null)
      this.syncChargeToAccountControl()
      return
    }

    const pr = this.patient.findPrescription(prescriptionId)
    if (!pr) return

    this.form.patchValue({ prescriptionNumber: pr.prescriptionNumber || '' })
    this.patient.selectPrescription(pr.id)
    this.syncChargeToAccountControl()
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
      next: result => {
        this.cart.setStocks(
          result.data.filter(s => (s.clinicId || s.clinic?.id) === clinicId && (s.availableQuantity || 0) > 0),
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

    if (paid < total && !this.chargeToAccount) {
      await this.alert.fire({
        icon: 'error',
        title: 'Pago insuficiente',
        html: `
          <div class="text-left">
            <p class="mb-2">El monto pagado no cubre el total de la venta:</p>
            <div class="bg-slate-100 p-3 rounded">
              <p class="mb-1"><strong>Total:</strong> Bs ${total.toFixed(2)}</p>
              <p class="mb-1"><strong>Pagado:</strong> Bs ${paid.toFixed(2)}</p>
              <p class="text-red-600 font-semibold"><strong>Falta:</strong> Bs ${(total - paid).toFixed(2)}</p>
            </div>
            <p class="mt-3 text-slate-600">Ingrese el monto completo para registrar la venta.</p>
          </div>
        `,
        confirmButtonText: 'Entendido',
      })
      return
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
            <p class="text-lg"><strong>Total:</strong> Bs ${total.toFixed(2)}</p>
          </div>
          ${
            this.chargeToAccount
              ? `<p class="mb-1 text-amber-700"><strong>No se cobra en farmacia:</strong> queda como cargo pendiente en la cuenta del paciente.</p>`
              : `<p class="mb-1"><strong>Método de pago:</strong> ${this.getPaymentMethodLabel(this.form.value.paymentMethod)}</p>
          <p class="mb-1"><strong>Monto pagado:</strong> Bs ${paid.toFixed(2)}</p>
          ${paid > total ? `<p class="text-green-600"><strong>Cambio:</strong> Bs ${this.changeAmount().toFixed(2)}</p>` : ''}`
          }
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Registrar venta',
      cancelButtonText: 'Cancelar',
    })

    if (!confirmation.isConfirmed) return

    const createDto: CreateSaleDto = {
      patientId: this.form.value.patientId || undefined,
      patientName: this.patient.selectedName() || undefined,
      clinicId: this.clinicContext.clinicId!,
      paymentMethod: this.form.value.paymentMethod,
      discountAmount: Number(this.form.value.discountAmount),
      discountReason: this.form.value.discountReason?.trim() || undefined,
      amountPaid: Number(this.form.value.amountPaid),
      notes: this.form.value.notes,
      prescriptionNumber: this.form.value.prescriptionNumber,
      prescriptionId: this.patient.selectedPrescriptionId() || undefined,
      chargeToAccount: this.chargeToAccount,
      items: this.cart.items().map((item: CartItem) => ({
        medicationStockId: item.medicationStock.id,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        discountPercent: Number(item.discountPercent) || 0,
        discountReason: item.discountReason?.trim() || undefined,
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
