import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing'
import { TestBed } from '@angular/core/testing'
import { AlertService } from '@core/services/alert.service'
import { ErrorService } from '../../../../../shared/components/services/error.service'
import { environment } from '../../../../../environments/environments'
import { createSpyObj, SpyObj } from '../../../../../../testing/spy'
import { MedicalRecord, RecordStatus } from '../interfaces'
import { MedicalRecordsService } from './medical-records.service'

const URL = `${environment.baseUrl}/medical-records`

function expediente(n: number): MedicalRecord {
  return { id: `mr-${n}`, chiefComplaint: `Motivo ${n}` } as MedicalRecord
}

/** `n` expedientes, como los devolvería una página del backend. */
function pagina(desde: number, cuantos: number, total: number) {
  return {
    data: Array.from({ length: cuantos }, (_, i) => expediente(desde + i)),
    total,
  }
}

describe('MedicalRecordsService', () => {
  let service: MedicalRecordsService
  let httpMock: HttpTestingController

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        MedicalRecordsService,
        { provide: ErrorService, useValue: createSpyObj<ErrorService>('ErrorService', ['handleError']) },
        { provide: AlertService, useValue: createSpyObj<AlertService>('AlertService', ['success', 'error']) },
      ],
    })

    service = TestBed.inject(MedicalRecordsService)
    httpMock = TestBed.inject(HttpTestingController)
  })

  afterEach(() => httpMock.verify())

  describe('getAllMedicalRecords', () => {
    /**
     * El fallo que motivó este método: el backend pagina por defecto a diez y
     * el listado nunca pedía página ni límite, así que la pantalla filtraba,
     * ordenaba y paginaba en cliente sobre diez expedientes mientras el
     * contador anunciaba el total de verdad. El resto era inalcanzable.
     */
    it('pide páginas explícitas y no se queda con el límite del backend', () => {
      let recibido = 0
      service.getAllMedicalRecords().subscribe(r => { recibido = r.data.length })

      const primera = httpMock.expectOne(r => r.url === URL)
      expect(primera.request.params.get('page')).toBe('1')
      expect(primera.request.params.get('limit')).toBe('100')
      primera.flush(pagina(1, 100, 100))

      expect(recibido).toBe(100)
    })

    it('trae las páginas que falten y las junta en orden', () => {
      let datos: MedicalRecord[] = []
      let total = 0
      service.getAllMedicalRecords().subscribe(r => { datos = r.data; total = r.total })

      httpMock.expectOne(r => r.params.get('page') === '1').flush(pagina(1, 100, 250))
      httpMock.expectOne(r => r.params.get('page') === '2').flush(pagina(101, 100, 250))
      httpMock.expectOne(r => r.params.get('page') === '3').flush(pagina(201, 50, 250))

      expect(datos.length).toBe(250)
      expect(datos[0].id).toBe('mr-1')
      expect(datos[100].id).toBe('mr-101')
      expect(datos[249].id).toBe('mr-250')
      expect(total).toBe(250)
    })

    it('con una sola página no dispara una segunda petición', () => {
      service.getAllMedicalRecords().subscribe()

      httpMock.expectOne(r => r.url === URL).flush(pagina(1, 8, 8))

      httpMock.verify()
    })

    /**
     * El total sigue siendo el del servidor aunque el tope de páginas recorte:
     * es lo que permite a la pantalla avisar de que no los tiene todos.
     */
    it('no baja del tope de 20 páginas y conserva el total real', () => {
      let datos: MedicalRecord[] = []
      let total = 0
      service.getAllMedicalRecords().subscribe(r => { datos = r.data; total = r.total })

      httpMock.expectOne(r => r.params.get('page') === '1').flush(pagina(1, 100, 5000))
      for (let p = 2; p <= 20; p++) {
        httpMock.expectOne(r => r.params.get('page') === String(p)).flush(pagina((p - 1) * 100 + 1, 100, 5000))
      }

      expect(datos.length).toBe(2000)
      expect(total).toBe(5000)
    })

    it('arrastra los filtros a todas las páginas', () => {
      service.getAllMedicalRecords({ status: RecordStatus.DRAFT }).subscribe()

      const primera = httpMock.expectOne(r => r.params.get('page') === '1')
      expect(primera.request.params.get('status')).toBe(RecordStatus.DRAFT)
      primera.flush(pagina(1, 100, 150))

      const segunda = httpMock.expectOne(r => r.params.get('page') === '2')
      expect(segunda.request.params.get('status')).toBe(RecordStatus.DRAFT)
      segunda.flush(pagina(101, 50, 150))
    })
  })

  describe('getMedicalRecords', () => {
    it('sin página ni límite no los manda, para no pisar el criterio de quien llama', () => {
      service.getMedicalRecords().subscribe()

      const req = httpMock.expectOne(r => r.url === URL)
      expect(req.request.params.has('page')).toBe(false)
      expect(req.request.params.has('limit')).toBe(false)
      req.flush(pagina(1, 10, 10))
    })
  })
})
