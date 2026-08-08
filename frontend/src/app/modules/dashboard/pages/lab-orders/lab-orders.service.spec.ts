import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing'
import { TestBed } from '@angular/core/testing'
import { AlertService } from '@core/services/alert.service'
import { ErrorService } from '../../../../shared/components/services/error.service'
import { environment } from '../../../../environments/environments'
import { createSpyObj, SpyObj } from '../../../../../testing/spy'
import {
  LAB_MODULE_CONFIG,
  LabModuleConfig,
  LABORATORY_MODULE_CONFIG,
  SPECIAL_STUDIES_MODULE_CONFIG,
} from './lab-module.config'
import { LabOrdersService } from './lab-orders.service'

const BASE = environment.baseUrl

/**
 * Lo que separa laboratorio de estudios especiales en el frontend es que cada
 * módulo pega contra su propia ruta. Si el servicio dejara de leer la
 * configuración, los dos módulos mostrarían lo mismo —los análisis clínicos del
 * paciente incluidos— y nada más lo delataría.
 */
describe('LabOrdersService', () => {
  let httpMock: HttpTestingController
  let errorService: SpyObj<ErrorService>
  let alert: SpyObj<AlertService>

  const setup = (config: LabModuleConfig): LabOrdersService => {
    errorService = createSpyObj('ErrorService', ['handleError'])
    alert = createSpyObj('AlertService', ['success'])

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        LabOrdersService,
        { provide: LAB_MODULE_CONFIG, useValue: config },
        { provide: ErrorService, useValue: errorService },
        { provide: AlertService, useValue: alert },
      ],
    })

    httpMock = TestBed.inject(HttpTestingController)
    return TestBed.inject(LabOrdersService)
  }

  afterEach(() => {
    httpMock.verify()
    TestBed.resetTestingModule()
  })

  it('laboratorio consulta /lab-orders', () => {
    const service = setup(LABORATORY_MODULE_CONFIG)
    service.list(1, 20).subscribe()

    const req = httpMock.expectOne(r => r.url === `${BASE}/lab-orders`)
    expect(req.request.method).toBe('GET')
    req.flush({ items: [] })
  })

  it('estudios especiales consulta /special-studies', () => {
    const service = setup(SPECIAL_STUDIES_MODULE_CONFIG)
    service.list(1, 20).subscribe()

    const req = httpMock.expectOne(r => r.url === `${BASE}/special-studies`)
    expect(req.request.method).toBe('GET')
    req.flush({ items: [] })
  })

  it('el resto de rutas cuelga de la misma raíz', () => {
    const service = setup(SPECIAL_STUDIES_MODULE_CONFIG)

    service.get('order-1').subscribe()
    httpMock.expectOne(`${BASE}/special-studies/order-1`).flush({})

    service.setStatus('order-1', 'in_progress').subscribe()
    httpMock.expectOne(`${BASE}/special-studies/order-1/status`).flush({})

    service.enterResult('order-1', 'item-1', { resultValue: '80' }).subscribe()
    httpMock.expectOne(`${BASE}/special-studies/order-1/items/item-1/result`).flush({})

    service.getResultsPdf('order-1').subscribe()
    httpMock.expectOne(`${BASE}/special-studies/order-1/results/pdf`).flush(new Blob())
  })

  it('las dos configuraciones no comparten ruta ni catálogo', () => {
    expect(LABORATORY_MODULE_CONFIG.apiPath).not.toBe(SPECIAL_STUDIES_MODULE_CONFIG.apiPath)
    expect(LABORATORY_MODULE_CONFIG.routeBase).not.toBe(SPECIAL_STUDIES_MODULE_CONFIG.routeBase)
    expect(LABORATORY_MODULE_CONFIG.serviceCategory).not.toBe(
      SPECIAL_STUDIES_MODULE_CONFIG.serviceCategory,
    )
  })
})
