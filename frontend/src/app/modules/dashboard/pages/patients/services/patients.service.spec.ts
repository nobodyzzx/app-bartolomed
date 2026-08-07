import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing'
import { TestBed } from '@angular/core/testing'
import { environment } from '../../../../../environments/environments'
import { CreatePatientDto, Gender } from '../interfaces'
import { PatientsService } from './patients.service'

const BASE = `${environment.baseUrl}/patients`

describe('PatientsService', () => {
  let service: PatientsService
  let httpMock: HttpTestingController

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [PatientsService],
    })
    service = TestBed.inject(PatientsService)
    httpMock = TestBed.inject(HttpTestingController)
    localStorage.setItem('token', 'test-token')
  })

  afterEach(() => {
    httpMock.verify()
    localStorage.clear()
  })

  it('createPatient hace POST con el dto y el header Authorization', () => {
    const dto: Partial<CreatePatientDto> = { firstName: 'Juan', lastName: 'Perez' } as any

    service.createPatient(dto as CreatePatientDto).subscribe()

    const req = httpMock.expectOne(BASE)
    expect(req.request.method).toBe('POST')
    expect(req.request.body).toEqual(dto)
    expect(req.request.headers.get('Authorization')).toBe('Bearer test-token')
    req.flush({ id: 'patient-1' })
  })

  describe('findAll', () => {
    it('sin opciones, no agrega ningún query param', () => {
      service.findAll().subscribe()
      const req = httpMock.expectOne(r => r.url === BASE)
      expect(req.request.params.keys().length).toBe(0)
      req.flush({ data: [], total: 0, page: 1, limit: 25 })
    })

    it('agrega page/limit/gender solo si vienen informados', () => {
      service.findAll({ page: 2, limit: 10, gender: Gender.FEMALE }).subscribe()
      const req = httpMock.expectOne(r => r.url === BASE)
      expect(req.request.params.get('page')).toBe('2')
      expect(req.request.params.get('limit')).toBe('10')
      expect(req.request.params.get('gender')).toBe(Gender.FEMALE)
      req.flush({ data: [], total: 0, page: 2, limit: 10 })
    })
  })

  it('findOne hace GET a /patients/:id', () => {
    service.findOne('patient-1').subscribe(res => expect(res.id).toBe('patient-1'))
    const req = httpMock.expectOne(`${BASE}/patient-1`)
    expect(req.request.method).toBe('GET')
    req.flush({ id: 'patient-1' })
  })

  it('getPatientById delega en findOne', () => {
    service.getPatientById('patient-1').subscribe()
    const req = httpMock.expectOne(`${BASE}/patient-1`)
    expect(req.request.method).toBe('GET')
    req.flush({ id: 'patient-1' })
  })

  it('findByDocument hace GET a /patients/document/:documentNumber', () => {
    service.findByDocument('1234567').subscribe()
    const req = httpMock.expectOne(`${BASE}/document/1234567`)
    expect(req.request.method).toBe('GET')
    req.flush({ id: 'patient-1' })
  })

  it('updatePatient hace PATCH con el dto', () => {
    service.updatePatient('patient-1', { firstName: 'Actualizado' }).subscribe()
    const req = httpMock.expectOne(`${BASE}/patient-1`)
    expect(req.request.method).toBe('PATCH')
    expect(req.request.body).toEqual({ firstName: 'Actualizado' })
    req.flush({ id: 'patient-1' })
  })

  it('removePatient hace DELETE', () => {
    service.removePatient('patient-1').subscribe()
    const req = httpMock.expectOne(`${BASE}/patient-1`)
    expect(req.request.method).toBe('DELETE')
    req.flush(null)
  })

  describe('searchPatients', () => {
    it('agrega el término de búsqueda como param', () => {
      service.searchPatients('juan').subscribe()
      const req = httpMock.expectOne(r => r.url === `${BASE}/search`)
      expect(req.request.params.get('term')).toBe('juan')
      expect(req.request.params.has('clinicId')).toBe(false)
      req.flush([])
    })

    it('agrega clinicId solo si viene informado', () => {
      service.searchPatients('juan', 'clinic-1').subscribe()
      const req = httpMock.expectOne(r => r.url === `${BASE}/search`)
      expect(req.request.params.get('clinicId')).toBe('clinic-1')
      req.flush([])
    })
  })

  describe('getPatientStatistics', () => {
    it('sin clinicId, no agrega el param', () => {
      service.getPatientStatistics().subscribe()
      const req = httpMock.expectOne(r => r.url === `${BASE}/statistics`)
      expect(req.request.params.has('clinicId')).toBe(false)
      req.flush({})
    })

    it('con clinicId, lo agrega como query param', () => {
      service.getPatientStatistics('clinic-1').subscribe()
      const req = httpMock.expectOne(r => r.url === `${BASE}/statistics`)
      expect(req.request.params.get('clinicId')).toBe('clinic-1')
      req.flush({})
    })
  })

  it('arma el header Authorization con "Bearer null" si no hay token guardado', () => {
    localStorage.removeItem('token')

    service.findOne('patient-1').subscribe()

    const req = httpMock.expectOne(`${BASE}/patient-1`)
    expect(req.request.headers.get('Authorization')).toBe('Bearer null')
    req.flush({ id: 'patient-1' })
  })
})
