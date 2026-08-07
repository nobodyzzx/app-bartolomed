import { ComponentFixture, TestBed } from '@angular/core/testing'
import { HttpClientTestingModule } from '@angular/common/http/testing'
import { NoopAnimationsModule } from '@angular/platform-browser/animations'
import { ActivatedRoute } from '@angular/router'
import { AlertService } from '@core/services/alert.service'
import { of } from 'rxjs'
import { ClinicsService } from '../admin/clinics/services/clinics.service'
import { PatientsService } from '../patients/services/patients.service'
import { UsersService } from '../admin/users/users.service'
import { PrescriptionFormComponent } from './prescription-form.component'
import { PrescriptionsModule } from './prescriptions.module'
import { PrescriptionsService } from './prescriptions.service'

// Minimal mocks
const mockPatientsService: Partial<PatientsService> = {
  findAll: () => of({ data: [], total: 0, page: 1, limit: 25 }),
}
const mockUsersService: Partial<UsersService> = {
  getUsers: () => of({ data: [], total: 0, limit: 25, offset: 0 }),
}
const mockClinicsService: Partial<ClinicsService> = { findAll: (_?: boolean) => of([]) }
const mockPrescriptionsService: Partial<PrescriptionsService> = {
  get: (_id: string) => of({}),
  create: (_p: any) => of({}),
  update: (_id: string, _p: any) => of({}),
}
const mockAlert: Partial<AlertService> = {
  success: (_t: string, _m?: string) => Promise.resolve({ isConfirmed: true } as any),
}

describe('PrescriptionFormComponent', () => {
  let component: PrescriptionFormComponent
  let fixture: ComponentFixture<PrescriptionFormComponent>

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      // PrescriptionsModule es quien declara el componente, así que el template
      // toma de ahí su scope real (Material, SharedModule). Re-declararlo aquí
      // deja el componente sin directivas conocidas.
      imports: [PrescriptionsModule, NoopAnimationsModule, HttpClientTestingModule],
      providers: [
        { provide: AlertService, useValue: mockAlert },
        { provide: PatientsService, useValue: mockPatientsService },
        { provide: UsersService, useValue: mockUsersService },
        { provide: ClinicsService, useValue: mockClinicsService },
        { provide: PrescriptionsService, useValue: mockPrescriptionsService },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => null } } } },
      ],
    }).compileComponents()

    fixture = TestBed.createComponent(PrescriptionFormComponent)
    component = fixture.componentInstance
    fixture.detectChanges()
  })

  it('should create the component and have a valid initial form', () => {
    expect(component).toBeTruthy()
    expect(component.form).toBeDefined()
  })

  it('should add and remove items', () => {
    const initial = component.items.length
    component.addItem()
    expect(component.items.length).toBe(initial + 1)
    component.removeItem(component.items.length - 1)
    expect(component.items.length).toBe(initial)
  })

  it('should validate numeric quantity', () => {
    component.items.clear()
    component.addItem()
    const it = component.items.at(0)
    it.get('quantity')?.setValue('abc')
    expect(it.get('quantity')?.valid).toBe(false)
    it.get('quantity')?.setValue('10')
    expect(it.get('quantity')?.valid).toBe(true)
  })
})
