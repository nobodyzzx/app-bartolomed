import { Component, DestroyRef, inject, OnInit } from '@angular/core'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { FormControl, FormGroup, Validators } from '@angular/forms'
import { ActivatedRoute, Router } from '@angular/router'
import { AlertService } from '@core/services/alert.service'
import { of } from 'rxjs'
import { switchMap } from 'rxjs/operators'
import { ErrorService } from '../../../../../../shared/components/services/error.service'
import { SidenavService } from '../../../../../../shared/components/services/sidenav.service'
import { Role, RolesService } from '../../roles/services/roles.service'
import { ClinicsService } from '../../clinics/services/clinics.service'
import { UsersService } from '../users.service'

// Enums actualizados basados en el backend
export enum ValidRoles {
  SUPER_ADMIN = 'super-admin',
  ADMIN = 'admin',
  DOCTOR = 'doctor',
  NURSE = 'nurse',
  RECEPTIONIST = 'receptionist',
  PHARMACIST = 'pharmacist',
  USER = 'user',
}

export interface UserRoleItem {
  value: ValidRoles
  label: string
  icon: string
  description: string
}

export interface Clinic {
  id: string
  name: string
  address: string
  phone: string
  isActive: boolean
}

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
})
export class UserRegisterComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef)

  isExpanded: boolean = true
  isEditMode: boolean = false
  userId: string | null = null
  clinics: Clinic[] = []
  availableRoles: Role[] = []
  isLoadingRoles: boolean = false
  isActive: boolean = true
  private originalIsActive: boolean = true

  protected readonly specializations = [
    'Medicina General',
    'Cardiología',
    'Neurología',
    'Pediatría',
    'Ginecología y Obstetricia',
    'Dermatología',
    'Oftalmología',
    'Otorrinolaringología',
    'Traumatología',
    'Psiquiatría',
    'Psicología',
    'Enfermería General',
    'Enfermería Especializada',
    'Farmacia Clínica',
    'Farmacia Hospitalaria',
    'Análisis Clínicos',
    'Microbiología',
    'Hematología',
    'Administración',
    'Recepción y Atención al Cliente',
    'Otra',
  ]

  public registerForm: FormGroup = new FormGroup({
    email: new FormControl('', [Validators.required, Validators.email]),
    password: new FormControl('', [Validators.required, Validators.minLength(6)]),
    roles: new FormControl([], [Validators.required]),
    clinicId: new FormControl(''),

    personalInfo: new FormGroup({
      firstName: new FormControl('', Validators.required),
      lastName: new FormControl('', Validators.required),
      phone: new FormControl(''),
      address: new FormControl(''),
      birthDate: new FormControl('', Validators.required),
    }),
    professionalInfo: new FormGroup({
      title: new FormControl('', Validators.required),
      specialization: new FormControl('', Validators.required),
      license: new FormControl('', Validators.required),
      certifications: new FormControl([]),
      startDate: new FormControl('', Validators.required),
      description: new FormControl(''),
      areas: new FormControl([]),
    }),
  })

  constructor(
    private usersService: UsersService,
    private clinicsService: ClinicsService,
    private rolesService: RolesService,
    public router: Router,
    private route: ActivatedRoute,
    private errorService: ErrorService,
    private sidenavService: SidenavService,
    private alert: AlertService,
  ) {}

  ngOnInit() {
    this.sidenavService.isExpanded$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(isExpanded => (this.isExpanded = isExpanded))

    // Cargar clínicas activas
    this.loadClinics()

    // Cargar roles disponibles
    this.loadRoles()

    // Verificar si estamos en modo edición
    this.route.paramMap
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        switchMap(params => {
          this.userId = params.get('id')
          this.isEditMode = !!this.userId

          if (this.isEditMode && this.userId) {
            return this.usersService.getUserById(this.userId)
          }
          return of(null)
        }),
      )
      .subscribe({
        next: user => {
          if (user) {
            // Si tenemos un usuario, pre-completamos el formulario
            this.fillFormWithUserData(user)
          }
        },
        error: error => {
          this.errorService.handleError(error)
          this.router.navigate(['/dashboard/users/list'])
        },
      })
  }

  loadClinics() {
    this.clinicsService.findAll(true).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: clinics => {
        this.clinics = clinics
      },
      error: () => {},
    })
  }

  loadRoles() {
    this.isLoadingRoles = true
    this.rolesService.findAll(true).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: roles => {
        this.availableRoles = roles
        this.isLoadingRoles = false
      },
      error: () => {
        this.isLoadingRoles = false
      },
    })
  }

  fillFormWithUserData(user: any) {
    // Eliminar validación de contraseña en modo edición
    const passwordControl = this.registerForm.get('password')
    if (passwordControl && this.isEditMode) {
      passwordControl.clearValidators()
      passwordControl.updateValueAndValidity()
    }

    // Completar el formulario con los datos del usuario
    this.registerForm.patchValue({
      email: user.email,
      roles: user.roles,
      clinicId: user.clinic?.id || '',
      personalInfo: {
        firstName: user.personalInfo?.firstName || '',
        lastName: user.personalInfo?.lastName || '',
        phone: user.personalInfo?.phone || '',
        address: user.personalInfo?.address || '',
        birthDate: user.personalInfo?.birthDate ? new Date(user.personalInfo.birthDate) : null,
      },
      professionalInfo: {
        title: user.professionalInfo?.title || '',
        specialization: user.professionalInfo?.specialization || '',
        license: user.professionalInfo?.license || '',
        certifications: user.professionalInfo?.certifications || [],
        startDate: user.professionalInfo?.startDate ? new Date(user.professionalInfo.startDate) : null,
        description: user.professionalInfo?.description || '',
        areas: user.professionalInfo?.areas || [],
      },
    })

    this.isActive = user.isActive ?? true
    this.originalIsActive = user.isActive ?? true

    // Dejar el campo de contraseña vacío
    passwordControl?.setValue('')
  }

  onSubmit() {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched()
      return
    }

    const userData = this.registerForm.value

    // Si no se seleccionó clínica, eliminar el campo
    if (!userData.clinicId) {
      delete userData.clinicId
    }

    if (this.isEditMode && this.userId) {
      // Modo edición
      const updateData = {
        ...userData,
        id: this.userId,
      }

      // Si la contraseña está vacía, la eliminamos para no actualizarla
      if (!userData.password) {
        delete updateData.password
      }

      this.usersService.updateUser(updateData).pipe(
        takeUntilDestroyed(this.destroyRef),
        switchMap(() => {
          if (this.isActive !== this.originalIsActive) {
            return this.usersService.updateUserStatus(this.userId!, this.isActive)
          }
          return of(null)
        })
      ).subscribe({
        next: () => {
          this.alert
            .success('Usuario actualizado', 'El usuario ha sido actualizado correctamente')
            .then(() => {
              this.router.navigate(['/dashboard/users'])
            })
        },
        error: error => {
          this.errorService.handleError(error)
        },
      })
    } else {
      // Modo crear
      this.usersService.createUser(userData).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: response => {
          this.alert
            .success('Usuario creado', 'El usuario ha sido registrado correctamente.')
            .then(() => {
              this.router.navigate(['/dashboard/users/list'])
            })
        },
        error: error => {
          this.errorService.handleError(error)
        },
      })
    }
  }
}
