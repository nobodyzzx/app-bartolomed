import { Location } from '@angular/common'
import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms'
import { ActivatedRoute, Router } from '@angular/router'
import { AlertService } from '@core/services/alert.service'
import { PurchaseOrder, ReceiveItemForm } from '../../interfaces/pharmacy.interfaces'
import { PurchaseOrdersService } from '../../services/purchase-orders.service'

@Component({
    selector: 'app-purchase-order-receive',
    templateUrl: './purchase-order-receive.component.html',
    styleUrls: ['./purchase-order-receive.component.css'],
    standalone: false
})
export class PurchaseOrderReceiveComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef)

  order = signal<PurchaseOrder | null>(null)
  loading = signal(false)
  orderId: string = ''
  receiveForm: FormGroup

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private fb: FormBuilder,
    private ordersService: PurchaseOrdersService,
    private alert: AlertService,
  ) {
    this.receiveForm = this.fb.group({
      items: this.fb.array([]),
      notes: [''],
    })
  }

  ngOnInit(): void {
    this.orderId = this.route.snapshot.paramMap.get('id') || ''
    if (this.orderId) {
      this.loadOrder()
    }
  }

  get items(): FormArray {
    return this.receiveForm.get('items') as FormArray
  }

  loadOrder(): void {
    this.loading.set(true)
    this.ordersService.getById(this.orderId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (order: PurchaseOrder) => {
        this.order.set(order)
        this.initializeForm(order)
        this.loading.set(false)
      },
      error: () => {
        this.loading.set(false)
        this.alert.error('Error', 'No se pudo cargar la orden')
        this.goBack()
      },
    })
  }

  initializeForm(order: PurchaseOrder): void {
    this.items.clear()
    order.items.forEach(item => {
      const remainingQty = item.quantity - (item.receivedQuantity || 0)
      this.items.push(
        this.fb.group({
          itemId: [item.id],
          productName: [item.productName],
          orderedQuantity: [item.quantity],
          previouslyReceived: [item.receivedQuantity || 0],
          receivingQuantity: [
            remainingQty,
            [Validators.required, Validators.min(0), Validators.max(remainingQty)],
          ],
          notes: [''],
          batchNumber: [''],
          expiryDate: [''],
        }),
      )
    })
  }

  goBack(): void {
    this.location.back()
  }

  getTotalReceiving(): number {
    return this.items.controls.reduce((sum, control) => {
      return sum + (Number(control.get('receivingQuantity')?.value) || 0)
    }, 0)
  }

  getItemsFullyReceived(): number {
    return this.items.controls.filter(control => {
      const ordered = control.get('orderedQuantity')?.value || 0
      const previous = control.get('previouslyReceived')?.value || 0
      const receiving = control.get('receivingQuantity')?.value || 0
      return previous + receiving >= ordered
    }).length
  }

  getItemsPartiallyReceived(): number {
    return this.items.controls.filter(control => {
      const ordered = control.get('orderedQuantity')?.value || 0
      const previous = control.get('previouslyReceived')?.value || 0
      const receiving = control.get('receivingQuantity')?.value || 0
      return previous + receiving > 0 && previous + receiving < ordered
    }).length
  }

  isFullyReceived(): boolean {
    return this.items.controls.every(control => {
      const ordered = control.get('orderedQuantity')?.value || 0
      const previous = control.get('previouslyReceived')?.value || 0
      const receiving = control.get('receivingQuantity')?.value || 0
      return previous + receiving >= ordered
    })
  }

  receiveAll(): void {
    this.items.controls.forEach(control => {
      const ordered = control.get('orderedQuantity')?.value || 0
      const previous = control.get('previouslyReceived')?.value || 0
      const remaining = ordered - previous
      control.patchValue({ receivingQuantity: remaining })
    })
  }

  clearAll(): void {
    this.items.controls.forEach(control => {
      control.patchValue({ receivingQuantity: 0 })
    })
  }

  async submit(): Promise<void> {
    if (this.receiveForm.invalid) {
      this.receiveForm.markAllAsTouched()
      this.alert.warning('Formulario inválido', 'Por favor revise los campos marcados')
      return
    }

    const totalReceiving = this.getTotalReceiving()
    if (totalReceiving === 0) {
      this.alert.warning('Sin productos', 'Debe recibir al menos un producto')
      return
    }

    const result = await this.alert.confirm({
      title: '¿Confirmar recepción?',
      text: `Se recibirán ${totalReceiving} productos en total`,
      confirmButtonText: 'Confirmar',
      cancelButtonText: 'Cancelar',
    })

    if (!result.isConfirmed) return

    this.loading.set(true)

    const itemsPayload = this.items.controls
      .map(control => ({
        itemId: control.get('itemId')?.value as string,
        receivingQuantity: Number(control.get('receivingQuantity')?.value) || 0,
        notes: control.get('notes')?.value || undefined,
        batchNumber: (control.get('batchNumber')?.value || '').trim() || undefined,
        expiryDate: (control.get('expiryDate')?.value || '').trim() || undefined,
      }))
      .filter(it => it.receivingQuantity > 0)

    const payload = {
      items: itemsPayload,
      notes: this.receiveForm.get('notes')?.value || undefined,
    }

    this.ordersService.receive(this.orderId, payload).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.alert.success('Recepción completada', 'Los productos han sido recibidos correctamente')
        this.router.navigate(['/dashboard/pharmacy/purchase-orders', this.orderId])
      },
      error: () => {
        this.loading.set(false)
        this.alert.error('Error', 'No se pudo completar la recepción')
      },
    })
  }

  getItemFormGroup(index: number): FormGroup {
    return this.items.at(index) as FormGroup
  }

  getRemainingQuantity(index: number): number {
    const control = this.items.at(index)
    const ordered = control.get('orderedQuantity')?.value || 0
    const previous = control.get('previouslyReceived')?.value || 0
    return ordered - previous
  }

  getNewTotal(index: number): number {
    const control = this.items.at(index)
    const previous = control.get('previouslyReceived')?.value || 0
    const receiving = control.get('receivingQuantity')?.value || 0
    return previous + receiving
  }

  getProgressPercentage(index: number): number {
    const control = this.items.at(index)
    const ordered = control.get('orderedQuantity')?.value || 0
    const newTotal = this.getNewTotal(index)
    return ordered > 0 ? (newTotal / ordered) * 100 : 0
  }
}
