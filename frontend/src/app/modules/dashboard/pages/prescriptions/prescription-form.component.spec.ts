import { ComponentFixture, TestBed } from '@angular/core/testing'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { NoopAnimationsModule } from '@angular/platform-browser/animations'
import { ActivatedRoute } from '@angular/router'
import { AlertService } from '@core/services/alert.service'
import { of } from 'rxjs'
import { MaterialModule } from '../../../../material/material.module'
import { ClinicsService } from '../clinics/services/clinics.service'
import { PatientsService } from '../patients/services/patients.service'
import { UsersService } from '../users/users.service'
import { PrescriptionFormComponent } from './prescription-form.component'
import { PrescriptionsService } from './prescriptions.service'

// Minimal mocks
const mockPatientsService: Partial<PatientsService> = { findAll: () => of([]) }
const mockUsersService: Partial<UsersService> = { getUsers: () => of([]) }
const mockClinicsService: Partial<ClinicsService> = { findAll: (_: boolean) => of([]) }
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
      declarations: [PrescriptionFormComponent],
      imports: [ReactiveFormsModule, FormsModule, MaterialModule, NoopAnimationsModule],
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
    expect(it.get('quantity')?.valid).toBeFalse()
    it.get('quantity')?.setValue('10')
    expect(it.get('quantity')?.valid).toBeTrue()
  })
})
