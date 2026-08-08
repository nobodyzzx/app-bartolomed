import { ComponentFixture, TestBed } from '@angular/core/testing'
import { HttpClientTestingModule } from '@angular/common/http/testing'
import { NoopAnimationsModule } from '@angular/platform-browser/animations'
import { ActivatedRoute } from '@angular/router'
import { AlertService } from '@core/services/alert.service'
import { of } from 'rxjs'
import { ClinicsService } from '../admin/clinics/services/clinics.service'
import { PatientsService } from '../patients/services/patients.service'
import { ClinicalStaffMember, UsersService } from '../admin/users/users.service'
import { AppointmentFormComponent } from './appointment-form.component'
import { AppointmentsModule } from './appointments.module'
import { AppointmentsService } from './services/appointments.service'

const staff: ClinicalStaffMember[] = [
  {
    id: 'doc-1',
    roles: ['doctor'],
    personalInfo: { firstName: 'Pedro', lastName: 'Vargas' },
    professionalInfo: { title: 'Dr.', role: 'Doctor', specialization: 'Medicina General' },
  },
  {
    id: 'enf-1',
    roles: ['nurse'],
    personalInfo: { firstName: 'Carmen', lastName: 'Limachi' },
    professionalInfo: { title: 'Enf.', role: 'Nurse', specialization: 'Enfermería' },
  },
]

const mockPatientsService: Partial<PatientsService> = {
  findAll: () => of({ data: [], total: 0, page: 1, limit: 25 }) as any,
}
const mockClinicsService: Partial<ClinicsService> = { findAll: (_?: boolean) => of([]) as any }
const mockAppointmentsService: Partial<AppointmentsService> = {
  getAppointment: (_id: string) => of({}) as any,
  createAppointment: (_dto: any) => of({}) as any,
  updateAppointment: (_id: string, _dto: any) => of({}) as any,
}
const mockAlert: Partial<AlertService> = {
  fire: (_opts: any) => Promise.resolve({ isConfirmed: true } as any),
}

describe('AppointmentFormComponent', () => {
  let component: AppointmentFormComponent
  let fixture: ComponentFixture<AppointmentFormComponent>
  let usersService: Partial<UsersService>

  beforeEach(async () => {
    usersService = {
      getClinicalStaff: vi.fn(() => of(staff)) as any,
      getUsers: vi.fn(() => of({ data: [], total: 0, limit: 25, offset: 0 })) as any,
    }

    await TestBed.configureTestingModule({
      imports: [AppointmentsModule, NoopAnimationsModule, HttpClientTestingModule],
      providers: [
        { provide: AlertService, useValue: mockAlert },
        { provide: PatientsService, useValue: mockPatientsService },
        { provide: UsersService, useValue: usersService },
        { provide: ClinicsService, useValue: mockClinicsService },
        { provide: AppointmentsService, useValue: mockAppointmentsService },
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of({ get: () => null }), queryParams: of({}) },
        },
      ],
    }).compileComponents()

    fixture = TestBed.createComponent(AppointmentFormComponent)
    component = fixture.componentInstance
    fixture.detectChanges()
  })

  // Regresión: el formulario poblaba el desplegable de médicos con `getUsers()`
  // (`GET /users`, ADMIN + UsersManage). Enfermería y recepción —que son quienes
  // agendan— recibían 403, la lista quedaba vacía, el select se autodeshabilitaba
  // y la cita nunca se podía registrar.
  it('carga los médicos desde clinical-staff, no desde GET /users', () => {
    expect(usersService.getClinicalStaff).toHaveBeenCalled()
    expect(usersService.getUsers).not.toHaveBeenCalled()
  })

  it('deja solo a los médicos en el desplegable y lo habilita', () => {
    expect(component.doctors.map(d => d.id)).toEqual(['doc-1'])
    expect(component.appointmentForm.get('doctorId')?.enabled).toBe(true)
  })
})
