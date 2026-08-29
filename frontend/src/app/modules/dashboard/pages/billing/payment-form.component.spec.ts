import { ElementRef } from '@angular/core'
import { TestBed } from '@angular/core/testing'
import { ActivatedRoute, Router } from '@angular/router'
import { AlertService } from '@core/services/alert.service'
import { of, throwError } from 'rxjs'
import { ErrorService } from '../../../../shared/components/services/error.service'
import { PaymentFormComponent } from './payment-form.component'
import { BillingService, InvoiceResponse } from './billing.service'
import { createSpyObj, SpyObj } from '../../../../../testing/spy'

/**
 * Antes esta pantalla no tenía un solo test — consistente con que nada en la
 * app enlazaba a ella (ver el comentario en payment-form.component.ts). Se
 * llega siempre con :invoiceId; sin él (o si la factura ya no debe nada) la
 * pantalla redirige, no muestra un formulario roto.
 */
describe('PaymentFormComponent', () => {
  let component: PaymentFormComponent
  let billingService: SpyObj<BillingService>
  let alert: SpyObj<AlertService>
  let errorService: SpyObj<ErrorService>
  let router: SpyObj<Router>

  const makeInvoice = (overrides: Partial<InvoiceResponse> = {}): InvoiceResponse =>
    ({
      id: 'inv-1',
      invoiceNumber: 'FAC-000001',
      status: 'partially_paid',
      totalAmount: 150,
      paidAmount: 100,
      remainingAmount: 50,
      patient: { id: 'pat-1', firstName: 'Juan', lastName: 'Perez' },
      items: [],
      ...overrides,
    }) as InvoiceResponse

  const createComponent = (invoiceIdParam: string | null = 'inv-1') => {
    TestBed.resetTestingModule()
    TestBed.configureTestingModule({
      providers: [
        PaymentFormComponent,
        { provide: Router, useValue: router },
        { provide: AlertService, useValue: alert },
        { provide: BillingService, useValue: billingService },
        { provide: ErrorService, useValue: errorService },
        { provide: ElementRef, useValue: new ElementRef(document.createElement('div')) },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => invoiceIdParam } } } },
      ],
    })
    return TestBed.inject(PaymentFormComponent)
  }

  beforeEach(() => {
    billingService = createSpyObj('BillingService', ['getInvoice', 'generatePaymentNumber', 'addPayment'])
    alert = createSpyObj('AlertService', ['error', 'warning', 'success'])
    errorService = createSpyObj('ErrorService', ['handleError'])
    router = createSpyObj('Router', ['navigate'])
  })

  it('sin :invoiceId, avisa y vuelve al listado sin llamar al backend', () => {
    component = createComponent(null)
    component.ngOnInit()

    expect(alert.error).toHaveBeenCalled()
    expect(router.navigate).toHaveBeenCalledWith(['/dashboard/billing'])
    expect(billingService.getInvoice).not.toHaveBeenCalled()
  })

  it('precarga el monto con el saldo pendiente, no con el total', () => {
    billingService.getInvoice.mockReturnValue(of(makeInvoice({ totalAmount: 150, remainingAmount: 50 })))
    billingService.generatePaymentNumber.mockReturnValue(of('PAG-0001'))
    component = createComponent()

    component.ngOnInit()

    expect(component.form.get('amount')?.value).toBe(50)
    expect(component.remainingAmount).toBe(50)
    expect(component.loading).toBe(false)
  })

  it('si la factura ya no debe nada, avisa y vuelve — no deja un formulario para pagar Bs 0', () => {
    billingService.getInvoice.mockReturnValue(of(makeInvoice({ remainingAmount: 0, status: 'paid' })))
    billingService.generatePaymentNumber.mockReturnValue(of('PAG-0001'))
    component = createComponent()

    component.ngOnInit()

    expect(alert.warning).toHaveBeenCalled()
    expect(router.navigate).toHaveBeenCalledWith(['/dashboard/billing'])
  })

  /**
   * El backend rechaza un pago que supere el saldo (BadRequestException) —
   * se valida también en el formulario para no hacer ir y volver a alguien
   * que escribió de más solo para que se lo rebote un 400.
   */
  it('rechaza un monto mayor al saldo pendiente', () => {
    billingService.getInvoice.mockReturnValue(of(makeInvoice({ remainingAmount: 50 })))
    billingService.generatePaymentNumber.mockReturnValue(of('PAG-0001'))
    component = createComponent()
    component.ngOnInit()

    component.form.get('amount')?.setValue(60)

    expect(component.form.get('amount')?.hasError('max')).toBe(true)
  })

  it('submit no manda patientId ni clinicId: CreatePaymentDto no los declara', () => {
    billingService.getInvoice.mockReturnValue(of(makeInvoice({ remainingAmount: 50 })))
    billingService.generatePaymentNumber.mockReturnValue(of('PAG-0001'))
    billingService.addPayment.mockReturnValue(of({ id: 'pay-1', paymentNumber: 'PAG-0001' } as any))
    component = createComponent()
    component.ngOnInit()

    component.form.patchValue({ method: 'cash' })
    component.submit()

    const payload = billingService.addPayment.mock.calls[0][0] as unknown as Record<string, unknown>
    expect(payload).not.toHaveProperty('patientId')
    expect(payload).not.toHaveProperty('clinicId')
    expect(payload['invoiceId']).toBe('inv-1')
    expect(payload['amount']).toBe(50)
    expect(router.navigate).toHaveBeenCalledWith(['/dashboard/billing'])
  })

  it('no llama al backend con el formulario inválido, y marca los campos tocados', () => {
    billingService.getInvoice.mockReturnValue(of(makeInvoice({ remainingAmount: 50 })))
    billingService.generatePaymentNumber.mockReturnValue(of('PAG-0001'))
    component = createComponent()
    component.ngOnInit()

    component.form.get('amount')?.setValue(-5)
    component.submit()

    expect(billingService.addPayment).not.toHaveBeenCalled()
    expect(component.form.get('amount')?.touched).toBe(true)
  })

  it('delega el error al ErrorService si addPayment falla', () => {
    billingService.getInvoice.mockReturnValue(of(makeInvoice({ remainingAmount: 50 })))
    billingService.generatePaymentNumber.mockReturnValue(of('PAG-0001'))
    billingService.addPayment.mockReturnValue(throwError(() => new Error('boom')))
    component = createComponent()
    component.ngOnInit()

    component.submit()

    expect(errorService.handleError).toHaveBeenCalled()
    expect(component.submitting).toBe(false)
  })
})
