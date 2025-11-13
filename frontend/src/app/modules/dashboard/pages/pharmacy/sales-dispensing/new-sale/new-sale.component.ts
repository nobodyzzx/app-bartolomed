import { Location } from '@angular/common'
import { Component, computed, ElementRef, OnInit, signal, ViewChild } from '@angular/core'
import { FormBuilder, FormGroup, Validators } from '@angular/forms'
import { Router } from '@angular/router'
import { AlertService } from '@core/services/alert.service'
import { ClinicContextService } from '../../../../../clinics/services/clinic-context.service'
import { Patient } from '../../../patients/interfaces/patient.interface'
import { PatientsService } from '../../../patients/services/patients.service'
import { PrescriptionsService } from '../../../prescriptions/prescriptions.service'
import { CreateSaleDto, MedicationStock, PaymentMethod } from '../../interfaces/pharmacy.interfaces'
import { InventoryService } from '../../services/inventory.service'
import { SalesDispensingService } from '../../services/sales-dispensing.service'

interface SaleItem {
  medicationStock: MedicationStock
  quantity: number
  unitPrice: number
  discountPercent: number
  subtotal: number
}

interface PrescriptionListItem {
  id: string
  prescriptionNumber: string
  prescriptionDate: string
  expiryDate: string
  status?: string
  items: Array<{
    medicationName: string
    quantity: string
    strength?: string
  }>
  patient?: any
  doctor?: any
}

@Component({
  selector: 'app-new-sale',
  templateUrl: './new-sale.component.html',
})
export class NewSaleComponent implements OnInit {
  @ViewChild('patientInput') patientInput?: ElementRef<HTMLInputElement>
  form: FormGroup
  loading = signal(false)
  loadingStocks = signal(false)
  loadingPatients = signal(false)

  stocks = signal<MedicationStock[]>([])
  saleItems = signal<SaleItem[]>([])
  searchTerm = signal<string>('')
  selectedPatientName = signal<string>('')
  patientSearchTerm = signal<string>('')
  patientOptions = signal<Patient[]>([])
  patientSearchLoading = signal<boolean>(false)
  private patientSearchTimer?: any

  prescriptions = signal<PrescriptionListItem[]>([])
  loadingPrescriptions = signal<boolean>(false)

  // Mostrar nombre en el input del autocomplete en lugar del ID
  patientDisplayWith = (value: string | Patient | null): string => {
    if (!value) return ''
    if (typeof value !== 'string') {
      const full = `${value.firstName || ''} ${value.lastName || ''}`.trim()
      return full || ''
    }
    const p = this.patientOptions().find(x => x.id === value)
    if (p) {
      const full = `${p.firstName || ''} ${p.lastName || ''}`.trim()
      return full || ''
    }
    // Fallback a nombre ya cargado
    if (this.selectedPatientName()) return this.selectedPatientName()
    return ''
  }

  // Filtered stocks based on search
  filteredStocks = computed(() => {
    const term = this.searchTerm().toLowerCase()
    if (!term) return this.stocks()

    return this.stocks().filter(
      stock =>
        stock.medication?.name?.toLowerCase().includes(term) ||
        stock.batchNumber?.toLowerCase().includes(term) ||
        stock.medication?.activeIngredients?.toLowerCase().includes(term),
    )
  })

  // Payment method options
  paymentMethods = [
    { value: PaymentMethod.CASH, label: 'Efectivo', icon: 'payments' },
    { value: PaymentMethod.CARD, label: 'Tarjeta', icon: 'credit_card' },
    { value: PaymentMethod.TRANSFER, label: 'Transferencia', icon: 'account_balance' },
  ]

  // Computed totals
  subtotal = computed(() => {
    return this.saleItems().reduce((sum, item) => sum + item.subtotal, 0)
  })

  taxRate = computed(() => this.form?.get('taxRate')?.value || 0.13)

  discountAmount = computed(() => this.form?.get('discountAmount')?.value || 0)

  taxAmount = computed(() => {
    // Desactivado temporalmente el cálculo de impuesto (13%)
    // const base = this.subtotal() - this.discountAmount()
    // return base * this.taxRate()
    return 0
  })

  totalAmount = computed(() => {
    // Desactivado temporalmente el cálculo de impuesto (13%)
    // return this.subtotal() - this.discountAmount() + this.taxAmount()
    return this.subtotal() - this.discountAmount()
  })

  amountPaid = signal(0)

  changeAmount = computed(() => {
    const change = this.amountPaid() - this.totalAmount()
    return change > 0 ? change : 0
  })

  totalUnits = computed(() => {
    return this.saleItems().reduce((sum, item) => sum + item.quantity, 0)
  })

  // Selected stock for adding
  selectedStockId = signal<string | null>(null)
  selectedStock = computed(() => {
    const id = this.selectedStockId()
    return id ? this.stocks().find(s => s.id === id) || null : null
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
    console.log('🚀 Iniciando NewSaleComponent')
    const clinicId = this.clinicContext.clinicId
    console.log('🏥 Clinic ID obtenido:', clinicId)

    if (!clinicId) {
      console.error('❌ No hay clinic ID disponible')
      this.alert.warning(
        'Clínica no detectada',
        'No se puede crear una venta sin contexto de clínica',
      )
      this.goBack()
      return
    }

    console.log('📞 Llamando a loadStocks con clinicId:', clinicId)
    this.loadStocks(clinicId)

    // Update unit price when stock is selected
    this.form.get('tempStockId')?.valueChanges.subscribe(stockId => {
      this.selectedStockId.set(stockId)
      const stock = this.selectedStock()
      if (stock) {
        // Auto-load selling price from stock
        this.form.patchValue({
          tempUnitPrice: stock.sellingPrice || stock.unitCost || 0,
        })
      }
    })

    // Update amountPaid signal when form field changes
    this.form.get('amountPaid')?.valueChanges.subscribe(value => {
      this.amountPaid.set(value || 0)
    })

    // Nota: La selección del paciente se maneja por evento optionSelected
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
      this.patientsService.searchPatients(term, clinicId).subscribe({
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
    // Permitir venta genérica cuando id es vacío
    if (!id) {
      this.form.get('patientId')?.setValue('')
      this.selectedPatientName.set('')
      this.prescriptions.set([])
      setTimeout(() => this.patientInput?.nativeElement.focus(), 0)
      return
    }
    this.form.get('patientId')?.setValue(id)
    // Buscar en opciones actuales para evitar otra llamada
    const found = this.patientOptions().find(p => p.id === id)
    if (found) {
      const fullName = `${found.firstName || ''} ${found.lastName || ''}`.trim()
      this.selectedPatientName.set(fullName)
      this.loadPatientPrescriptions(id)
      return
    }
    // Fallback: cargar por ID
    this.loadingPatients.set(true)
    this.patientsService.getPatientById(id).subscribe({
      next: patient => {
        const fullName = `${patient.firstName || ''} ${patient.lastName || ''}`.trim()
        this.selectedPatientName.set(fullName)
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
    // Solo cargar recetas activas que no hayan expirado
    this.prescriptionsService.list(1, 50, { patientId, clinicId, status: 'active' }).subscribe({
      next: (response: any) => {
        const items = response?.items || []
        // Filtrar adicional: solo recetas no vencidas
        const now = new Date()
        const validPrescriptions = items.filter((p: PrescriptionListItem) => {
          if (!p.expiryDate) return true
          const expiry = new Date(p.expiryDate)
          return expiry >= now
        })
        this.prescriptions.set(validPrescriptions)
        this.loadingPrescriptions.set(false)
      },
      error: () => {
        this.prescriptions.set([])
        this.loadingPrescriptions.set(false)
      },
    })
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

      const candidates = this.stocks()
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
        this.addOrUpdateSaleItem(stock, take)
        remaining -= take
        if (take > 0) {
          addedLines += 1
          added.push(`${it.medicationName} (${take})`)
        }
      }

      if (remaining > 0) {
        insufficient.push(`${it.medicationName} (faltan ${remaining})`)
      }
    }

    if (addedLines > 0) {
      this.alert.success(
        '✅ Receta aplicada',
        `Se agregaron ${addedLines} líneas a la venta desde la receta ${p.prescriptionNumber || p.id}`,
      )
    } else {
      this.alert.warning('Sin cambios', 'No se pudo agregar ningún producto de esta receta')
    }

    if (missing.length > 0 || insufficient.length > 0) {
      const msgParts = [] as string[]
      if (missing.length > 0) msgParts.push(`❌ No encontrados: ${missing.join(', ')}`)
      if (insufficient.length > 0)
        msgParts.push(`⚠️ Stock insuficiente: ${insufficient.join(', ')}`)
      this.alert.fire({
        icon: 'warning',
        title: 'Aviso de inventario',
        html: `<div class="text-left text-sm">${msgParts.join('<br>')}</div>`,
        confirmButtonText: 'Entendido',
      })
    }
  }

  private addOrUpdateSaleItem(stock: MedicationStock, quantity: number): void {
    if (quantity <= 0) return

    const defaultUnitPrice = stock.sellingPrice || stock.unitCost || 0
    const defaultDiscountPercent = 0

    const existingIndex = this.saleItems().findIndex(item => item.medicationStock.id === stock.id)
    if (existingIndex >= 0) {
      const existingItem = this.saleItems()[existingIndex]
      const newQuantity = existingItem.quantity + quantity
      const availableQty = stock.availableQuantity || 0
      const unitPrice = existingItem.unitPrice
      const discountPercent = existingItem.discountPercent

      if (newQuantity > availableQty) {
        const allowed = Math.max(availableQty - existingItem.quantity, 0)
        if (allowed > 0) {
          const updatedQty = existingItem.quantity + allowed
          const discountAmount = (updatedQty * unitPrice * discountPercent) / 100
          const subtotal = updatedQty * unitPrice - discountAmount
          this.saleItems.update(items =>
            items.map((it, i) =>
              i === existingIndex ? { ...it, quantity: updatedQty, subtotal } : it,
            ),
          )
        }
      } else {
        const discountAmount = (newQuantity * unitPrice * discountPercent) / 100
        const subtotal = newQuantity * unitPrice - discountAmount
        this.saleItems.update(items =>
          items.map((it, i) =>
            i === existingIndex ? { ...it, quantity: newQuantity, subtotal } : it,
          ),
        )
      }
    } else {
      const availableQty = stock.availableQuantity || 0
      const take = Math.min(quantity, availableQty)
      if (take <= 0) return
      const unitPrice = defaultUnitPrice
      const discountPercent = defaultDiscountPercent
      const discountAmount = (take * unitPrice * discountPercent) / 100
      const subtotal = take * unitPrice - discountAmount
      const newItem: SaleItem = {
        medicationStock: stock,
        quantity: take,
        unitPrice,
        discountPercent,
        subtotal,
      }
      this.saleItems.update(items => [...items, newItem])
    }
  }

  loadStocks(clinicId: string): void {
    this.loadingStocks.set(true)
    console.log('🔍 Cargando inventario para clínica:', clinicId)
    this.inventoryService.getAllStock(clinicId).subscribe({
      next: (stocks: MedicationStock[]) => {
        console.log('📦 Stocks recibidos del servidor:', stocks.length, stocks)

        // Log each stock to see what we have
        stocks.forEach((s, i) => {
          console.log(`  Stock ${i + 1}:`, {
            id: s.id,
            medication: s.medication?.name,
            batch: s.batchNumber,
            clinicId: s.clinicId || s.clinic?.id,
            availableQty: s.availableQuantity,
            matches: (s.clinicId || s.clinic?.id) === clinicId && (s.availableQuantity || 0) > 0,
          })
        })

        // Filter by clinic and only show stocks with available quantity
        const availableStocks = stocks.filter(
          s => (s.clinicId || s.clinic?.id) === clinicId && (s.availableQuantity || 0) > 0,
        )
        console.log(
          '✅ Stocks disponibles después del filtro:',
          availableStocks.length,
          availableStocks,
        )
        this.stocks.set(availableStocks)
        this.loadingStocks.set(false)
      },
      error: err => {
        console.error('❌ Error al cargar inventario:', err)
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

    const stock = this.stocks().find(s => s.id === stockId)
    if (!stock) {
      this.alert.error('Error', 'Producto no encontrado')
      return
    }

    // Check if stock already in items - allow updating quantity
    const existingIndex = this.saleItems().findIndex(item => item.medicationStock.id === stockId)
    if (existingIndex >= 0) {
      const existingItem = this.saleItems()[existingIndex]
      const newQuantity = existingItem.quantity + quantity

      // Check available quantity for update
      const availableQty = stock.availableQuantity || 0
      if (newQuantity > availableQty) {
        this.alert.error(
          'Stock insuficiente',
          `Solo hay ${availableQty} unidades disponibles (ya tiene ${existingItem.quantity} en la venta)`,
        )
        return
      }

      // Update existing item
      const discountAmount = (newQuantity * unitPrice * discountPercent) / 100
      const subtotal = newQuantity * unitPrice - discountAmount

      this.saleItems.update(items =>
        items.map((item, i) =>
          i === existingIndex ? { ...item, quantity: newQuantity, subtotal } : item,
        ),
      )

      this.alert.success(
        'Cantidad actualizada',
        `Se actualizó la cantidad a ${newQuantity} unidades`,
      )
    } else {
      // Check available quantity for new item
      const availableQty = stock.availableQuantity || 0
      if (quantity > availableQty) {
        this.alert.error('Stock insuficiente', `Solo hay ${availableQty} unidades disponibles`)
        return
      }

      // Check expiration date
      if (stock.expiryDate) {
        const expiryDate = new Date(stock.expiryDate)
        const today = new Date()
        const daysUntilExpiry = Math.ceil(
          (expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
        )

        if (daysUntilExpiry < 0) {
          this.alert.error('Producto vencido', 'No se puede vender un producto vencido')
          return
        }

        if (daysUntilExpiry <= 30) {
          this.alert.warning(
            'Producto próximo a vencer',
            `Este producto vence en ${daysUntilExpiry} días`,
          )
        }
      }

      const discountAmount = (quantity * unitPrice * discountPercent) / 100
      const subtotal = quantity * unitPrice - discountAmount

      const newItem: SaleItem = {
        medicationStock: stock,
        quantity,
        unitPrice,
        discountPercent,
        subtotal,
      }

      this.saleItems.update(items => [...items, newItem])
    }

    // Reset temp fields
    this.form.patchValue({
      tempStockId: '',
      tempQuantity: 1,
      tempUnitPrice: 0,
      tempDiscountPercent: 0,
    })
    this.selectedStockId.set(null)
  }

  removeItem(index: number): void {
    this.saleItems.update(items => items.filter((_, i) => i !== index))
  }

  updateItemQuantity(index: number, newQuantity: number): void {
    if (newQuantity <= 0) {
      this.alert.warning('Cantidad inválida', 'La cantidad debe ser mayor a 0')
      return
    }

    const item = this.saleItems()[index]
    const availableQty = item.medicationStock.availableQuantity || 0

    if (newQuantity > availableQty) {
      this.alert.error('Stock insuficiente', `Solo hay ${availableQty} unidades disponibles`)
      return
    }

    const discountAmount = (newQuantity * item.unitPrice * item.discountPercent) / 100
    const subtotal = newQuantity * item.unitPrice - discountAmount

    this.saleItems.update(items =>
      items.map((it, i) => (i === index ? { ...it, quantity: newQuantity, subtotal } : it)),
    )
  }

  updateItemDiscount(index: number, newDiscountPercent: number): void {
    if (newDiscountPercent < 0 || newDiscountPercent > 100) {
      this.alert.warning('Descuento inválido', 'El descuento debe estar entre 0% y 100%')
      return
    }

    const item = this.saleItems()[index]
    const discountAmount = (item.quantity * item.unitPrice * newDiscountPercent) / 100
    const subtotal = item.quantity * item.unitPrice - discountAmount

    this.saleItems.update(items =>
      items.map((it, i) =>
        i === index ? { ...it, discountPercent: newDiscountPercent, subtotal } : it,
      ),
    )
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
    if (this.saleItems().length === 0) {
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

    // Validar que el precio de venta no sea menor al costo
    const hasLowPriceItems = this.saleItems().some(
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
              <p class="mb-1"><strong>Total:</strong> $${total.toFixed(2)}</p>
              <p class="mb-1"><strong>Pagado:</strong> $${paid.toFixed(2)}</p>
              <p class="text-red-600"><strong>Falta:</strong> $${(total - paid).toFixed(2)}</p>
            </div>
            <p class="mt-3">La venta quedará como <strong>PENDIENTE</strong>. ¿Continuar?</p>
          </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Continuar',
        cancelButtonText: 'Cancelar',
      })

      if (!result.isConfirmed) return
    }

    // Confirmación final
    const itemsCount = this.saleItems().length
    const unitsCount = this.totalUnits()

    const confirmation = await this.alert.fire({
      icon: 'question',
      title: 'Confirmar venta',
      html: `
        <div class="text-left">
          <p class="mb-3">Resumen de la venta:</p>
          <div class="bg-blue-50 p-3 rounded mb-3">
            <p class="mb-1"><strong>Productos:</strong> ${itemsCount} (${unitsCount} unidades)</p>
            <p class="mb-1"><strong>Subtotal:</strong> $${this.subtotal().toFixed(2)}</p>
            ${this.discountAmount() > 0 ? `<p class="mb-1"><strong>Descuento:</strong> -$${this.discountAmount().toFixed(2)}</p>` : ''}
            <p class="mb-1"><strong>Impuestos:</strong> $${this.taxAmount().toFixed(2)}</p>
            <p class="text-lg"><strong>Total:</strong> $${total.toFixed(2)}</p>
          </div>
          <p class="mb-1"><strong>Método de pago:</strong> ${this.getPaymentMethodLabel(this.form.value.paymentMethod)}</p>
          <p class="mb-1"><strong>Monto pagado:</strong> $${paid.toFixed(2)}</p>
          ${paid > total ? `<p class="text-green-600"><strong>Cambio:</strong> $${this.changeAmount().toFixed(2)}</p>` : ''}
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Registrar venta',
      cancelButtonText: 'Cancelar',
    })

    if (!confirmation.isConfirmed) return

    const createDto: CreateSaleDto = {
      patientId: this.form.value.patientId || undefined,
      clinicId: this.clinicContext.clinicId!,
      paymentMethod: this.form.value.paymentMethod,
      taxRate: Number(this.form.value.taxRate),
      discountAmount: Number(this.form.value.discountAmount),
      amountPaid: Number(this.form.value.amountPaid),
      notes: this.form.value.notes,
      prescriptionNumber: this.form.value.prescriptionNumber,
      items: this.saleItems().map(item => ({
        medicationStockId: item.medicationStock.id,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        discountPercent: Number(item.discountPercent) || 0,
        batchNumber: item.medicationStock.batchNumber,
        expiryDate: item.medicationStock.expiryDate,
      })),
    }

    this.loading.set(true)
    this.salesService.createSale(createDto).subscribe({
      next: sale => {
        this.alert.success('Venta creada', `Venta ${sale.saleNumber} registrada exitosamente`)
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
