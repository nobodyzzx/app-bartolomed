import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing'
import { TestBed } from '@angular/core/testing'
import { AlertService } from '@core/services/alert.service'
import { ErrorService } from '../../../../shared/components/services/error.service'
import { environment } from '../../../../environments/environments'
import { BillingService, InvoiceDto, PaymentDto } from './billing.service'

const BASE = environment.baseUrl

describe('BillingService', () => {
  let service: BillingService
  let httpMock: HttpTestingController
  let errorService: jasmine.SpyObj<ErrorService>
  let alert: jasmine.SpyObj<AlertService>

  const invoiceDto: InvoiceDto = {
    invoiceNumber: 'INV-0001',
    issueDate: '2026-01-01',
    dueDate: '2026-01-31',
    patientId: 'patient-1',
    clinicId: 'clinic-1',
    items: [{ description: 'Consulta', quantity: 1, unitPrice: 100 }],
  }

  const paymentDto: PaymentDto = {
    paymentNumber: 'PAY-0001',
    amount: 100,
    method: 'cash',
    paymentDate: '2026-01-01',
    invoiceId: 'inv-1',
  }

  beforeEach(() => {
    errorService = jasmine.createSpyObj('ErrorService', ['handleError'])
    alert = jasmine.createSpyObj('AlertService', ['success'])

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        BillingService,
        { provide: ErrorService, useValue: errorService },
        { provide: AlertService, useValue: alert },
      ],
    })

    service = TestBed.inject(BillingService)
    httpMock = TestBed.inject(HttpTestingController)
  })

  afterEach(() => httpMock.verify())

  describe('listInvoices', () => {
    it('arma page/pageSize por defecto y omite filtros undefined/null', () => {
      service.listInvoices().subscribe()

      const req = httpMock.expectOne(
        r => r.url === `${BASE}/billing/invoices` && r.method === 'GET',
      )
      expect(req.request.params.get('page')).toBe('1')
      expect(req.request.params.get('pageSize')).toBe('20')
      req.flush({ data: [], total: 0 })
    })

    it('agrega solo los filtros con valor definido', () => {
      service.listInvoices(2, 10, { status: 'paid', clinicId: undefined, patientId: null }).subscribe()

      const req = httpMock.expectOne(r => r.url === `${BASE}/billing/invoices`)
      expect(req.request.params.get('page')).toBe('2')
      expect(req.request.params.get('pageSize')).toBe('10')
      expect(req.request.params.get('status')).toBe('paid')
      expect(req.request.params.has('clinicId')).toBeFalse()
      expect(req.request.params.has('patientId')).toBeFalse()
      req.flush({ data: [], total: 0 })
    })

    it('en error, delega a errorService.handleError y repropaga', done => {
      service.listInvoices().subscribe({
        error: err => {
          expect(errorService.handleError).toHaveBeenCalled()
          expect(err.status).toBe(500)
          done()
        },
      })

      httpMock.expectOne(`${BASE}/billing/invoices?page=1&pageSize=20`).flush(null, { status: 500, statusText: 'Server Error' })
    })
  })

  it('getInvoice hace GET a /billing/invoices/:id', () => {
    service.getInvoice('inv-1').subscribe(res => expect(res.id).toBe('inv-1'))
    const req = httpMock.expectOne(`${BASE}/billing/invoices/inv-1`)
    expect(req.request.method).toBe('GET')
    req.flush({ id: 'inv-1' })
  })


  it('updateInvoice hace PATCH y muestra alerta de éxito', () => {
    service.updateInvoice('inv-1', { notes: 'x' }).subscribe()
    const req = httpMock.expectOne(`${BASE}/billing/invoices/inv-1`)
    expect(req.request.method).toBe('PATCH')
    expect(req.request.body).toEqual({ notes: 'x' })
    req.flush({})
    expect(alert.success).toHaveBeenCalledWith('Éxito', 'Factura actualizada correctamente')
  })

  it('setInvoiceStatus hace PATCH al endpoint de status', () => {
    service.setInvoiceStatus('inv-1', 'paid').subscribe()
    const req = httpMock.expectOne(`${BASE}/billing/invoices/inv-1/status`)
    expect(req.request.method).toBe('PATCH')
    expect(req.request.body).toEqual({ status: 'paid' })
    req.flush({})
    expect(alert.success).toHaveBeenCalledWith('Éxito', 'Estado actualizado correctamente')
  })

  it('deleteInvoice hace DELETE y muestra alerta de éxito', () => {
    service.deleteInvoice('inv-1').subscribe()
    const req = httpMock.expectOne(`${BASE}/billing/invoices/inv-1`)
    expect(req.request.method).toBe('DELETE')
    req.flush({})
    expect(alert.success).toHaveBeenCalledWith('Éxito', 'Factura eliminada correctamente')
  })

  it('addPayment hace POST y muestra alerta de éxito', () => {
    service.addPayment(paymentDto).subscribe()
    const req = httpMock.expectOne(`${BASE}/billing/payments`)
    expect(req.request.method).toBe('POST')
    expect(req.request.body).toEqual(paymentDto)
    req.flush({ id: 'pay-1' })
    expect(alert.success).toHaveBeenCalledWith('Éxito', 'Pago registrado correctamente')
  })

  it('getPaymentsByInvoice hace GET sin alerta de éxito', () => {
    service.getPaymentsByInvoice('inv-1').subscribe()
    const req = httpMock.expectOne(`${BASE}/billing/payments/invoice/inv-1`)
    expect(req.request.method).toBe('GET')
    req.flush([])
    expect(alert.success).not.toHaveBeenCalled()
  })

  it('confirmPayment hace PATCH y muestra alerta de éxito', () => {
    service.confirmPayment('pay-1').subscribe()
    const req = httpMock.expectOne(`${BASE}/billing/payments/pay-1/confirm`)
    expect(req.request.method).toBe('PATCH')
    req.flush({})
    expect(alert.success).toHaveBeenCalledWith('Éxito', 'Pago confirmado correctamente')
  })

  it('cancelPayment hace PATCH y muestra alerta de éxito', () => {
    service.cancelPayment('pay-1').subscribe()
    const req = httpMock.expectOne(`${BASE}/billing/payments/pay-1/cancel`)
    expect(req.request.method).toBe('PATCH')
    req.flush({})
    expect(alert.success).toHaveBeenCalledWith('Éxito', 'Pago cancelado correctamente')
  })

  describe('getStatistics', () => {
    it('sin clinicId, no agrega el param', () => {
      service.getStatistics().subscribe()
      const req = httpMock.expectOne(r => r.url === `${BASE}/billing/statistics`)
      expect(req.request.params.has('clinicId')).toBeFalse()
      req.flush({})
    })

    it('con clinicId, lo agrega como query param', () => {
      service.getStatistics('clinic-1').subscribe()
      const req = httpMock.expectOne(r => r.url === `${BASE}/billing/statistics`)
      expect(req.request.params.get('clinicId')).toBe('clinic-1')
      req.flush({})
    })
  })

  it('generateInvoiceNumber hace GET con responseType text', () => {
    service.generateInvoiceNumber().subscribe(res => expect(res).toBe('INV-0002'))
    const req = httpMock.expectOne(`${BASE}/billing/generate/invoice-number`)
    expect(req.request.method).toBe('GET')
    req.flush('INV-0002')
  })

  it('generatePaymentNumber hace GET con responseType text', () => {
    service.generatePaymentNumber().subscribe(res => expect(res).toBe('PAY-0002'))
    const req = httpMock.expectOne(`${BASE}/billing/generate/payment-number`)
    expect(req.request.method).toBe('GET')
    req.flush('PAY-0002')
  })
})
