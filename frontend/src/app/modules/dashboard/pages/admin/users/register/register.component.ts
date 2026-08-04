import { Component, DestroyRef, inject, OnInit } from '@angular/core'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { FormControl, FormGroup, Validators } from '@angular/forms'
import { ActivatedRoute, Router } from '@angular/router'
import { AlertService } from '@core/services/alert.service'
import { ASSIGNABLE_ROLES } from '@core/constants/assignable-roles'
import { VALIDATION_PATTERNS } from '../../../../../../shared/validators/validation-patterns'
import { of } from 'rxjs'
import { switchMap } from 'rxjs/operators'
import { ErrorService } from '../../../../../../shared/components/services/error.service'
import { ClinicsService } from '../../clinics/services/clinics.service'
import { UsersService } from '../users.service'

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
    standalone: false
})
export class UserRegisterComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef)

  isEditMode: boolean = false
  userId: string | null = null
  clinics: Clinic[] = []
  availableRoles = ASSIGNABLE_ROLES
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

  /** Política de contraseña: mayúscula + minúscula + número o símbolo */
  private readonly PASSWORD_REGEX = /(?=.*[A-Z])(?=.*[a-z])(?:(?=.*\d)|(?=.*\W))/

  hidePassword = true

  // País, departamento y ciudad — app de alcance nacional (Bolivia), por defecto La Paz
  protected readonly departmentOptions = [
    'La Paz', 'Cochabamba', 'Santa Cruz', 'Oruro', 'Potosí', 'Chuquisaca', 'Tarija', 'Beni', 'Pando',
  ]
  protected readonly countryOptions = [
    'Bolivia', 'Perú', 'Chile', 'Argentina', 'Brasil', 'Paraguay', 'Colombia', 'Ecuador',
  ]
  // Ciudades principales de La Paz + municipios de Sud Yungas (zona de cobertura de las clínicas seed)
  protected readonly cityOptions = [
    'La Paz', 'El Alto', 'Viacha', 'Achocalla', 'Coroico', 'Caranavi', 'Copacabana', 'Sorata', 'Guanay',
    'Palos Blancos', 'Chulumani', 'Irupana', 'Yanacachi', 'Cajuata',
  ]

  filteredCountries(): string[] {
    return this.filterOptions(this.countryOptions, this.registerForm.get('personalInfo.country')?.value)
  }

  filteredCities(): string[] {
    return this.filterOptions(this.cityOptions, this.registerForm.get('personalInfo.city')?.value)
  }

  /**
   * Si el valor actual ya coincide exacto con una opción (recién seleccionada, o el
   * default sin tocar), devuelve la lista completa — así el usuario ve todas las
   * opciones al abrir el panel sin tener que borrar lo que ya está escrito. Solo
   * filtra por coincidencia parcial mientras está escribiendo texto nuevo.
   */
  private filterOptions(options: string[], rawValue: unknown): string[] {
    const v = String(rawValue ?? '').toLowerCase()
    if (!v || options.some(o => o.toLowerCase() === v)) return options
    return options.filter(o => o.toLowerCase().includes(v))
  }

  // El select de Departamento y el autocomplete de Ciudad solo tienen sentido para
  // Bolivia (y, para Ciudad, solo dentro de La Paz) — fuera de ahí no hay lista curada,
  // así que se muestran como texto libre para no sugerir opciones erróneas.
  isBoliviaSelected(): boolean {
    return this.registerForm.get('personalInfo.country')?.value === 'Bolivia'
  }

  isLaPazSelected(): boolean {
    return this.registerForm.get('personalInfo.state')?.value === 'La Paz'
  }

  public registerForm: FormGroup = new FormGroup({
    email: new FormControl('', [Validators.required, Validators.email]),
    password: new FormControl('', [
      Validators.required,
      Validators.minLength(6),
      Validators.pattern(this.PASSWORD_REGEX),
    ]),
    roles: new FormControl([], [Validators.required]),
    clinicId: new FormControl(''),

    personalInfo: new FormGroup({
      firstName: new FormControl('', Validators.required),
      lastName:  new FormControl('', Validators.required),
      phone:     new FormControl('', [Validators.pattern(VALIDATION_PATTERNS.phoneBolivia)]),
      address:   new FormControl(''),
      city:      new FormControl(''),
      state:     new FormControl('La Paz'),
      country:   new FormControl('Bolivia'),
      birthDate: new FormControl(null),   // opcional
    }),
    professionalInfo: new FormGroup({
      title:          new FormControl('', Validators.required),
      specialization: new FormControl('', Validators.required),
      license:        new FormControl('', Validators.required),
      certifications: new FormControl([]),
      startDate:      new FormControl(null, Validators.required),
      description:    new FormControl(''),
      areas:          new FormControl([]),
    }),
  })

  constructor(
    private usersService: UsersService,
    private clinicsService: ClinicsService,
    public router: Router,
    private route: ActivatedRoute,
    private errorService: ErrorService,
    private alert: AlertService,
  ) {}

  ngOnInit() {
    // Cargar clínicas activas
    this.loadClinics()
    this.watchLocationChanges()

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
          this.router.navigate(['/dashboard/users'])
        },
      })
  }

  /**
   * Limpia Departamento/Ciudad cuando dejan de aplicar (país ya no es Bolivia, o
   * departamento ya no es La Paz) — evita dejar un valor "huérfano" visible como
   * texto libre que no corresponde a la nueva selección. No dispara sobre datos
   * recién cargados porque fillFormWithUserData() usa { emitEvent: false }.
   */
  private watchLocationChanges(): void {
    this.registerForm.get('personalInfo.country')!.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(country => {
        if (country !== 'Bolivia') {
          this.registerForm.get('personalInfo')!.patchValue({ state: '', city: '' }, { emitEvent: false })
        }
      })

    this.registerForm.get('personalInfo.state')!.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(state => {
        if (state !== 'La Paz') {
          this.registerForm.get('personalInfo.city')!.setValue('', { emitEvent: false })
        }
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

  fillFormWithUserData(user: any) {
    // Eliminar validación de contraseña en modo edición
    const passwordControl = this.registerForm.get('password')
    if (passwordControl && this.isEditMode) {
      passwordControl.clearValidators()
      passwordControl.updateValueAndValidity()
    }

    // Completar el formulario con los datos del usuario
    // { emitEvent: false } es necesario porque watchLocationChanges() limpiaría
    // state/city si el patch de country/state disparara sus propios watchers.
    this.registerForm.patchValue({
      email: user.email,
      roles: user.roles,
      clinicId: user.clinic?.id || '',
      personalInfo: {
        firstName: user.personalInfo?.firstName || '',
        lastName: user.personalInfo?.lastName || '',
        phone: user.personalInfo?.phone || '',
        address: user.personalInfo?.address || '',
        city: user.personalInfo?.city || '',
        state: user.personalInfo?.state || 'La Paz',
        country: user.personalInfo?.country || 'Bolivia',
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
    }, { emitEvent: false })

    this.isActive = user.isActive ?? true
    this.originalIsActive = user.isActive ?? true

    // Dejar el campo de contraseña vacío
    passwordControl?.setValue('')
  }

  /** Formatea un valor del datepicker a YYYY-MM-DD (ISO 8601 date) o null */
  private toISODate(value: any): string | null {
    if (!value) return null
    try {
      return new Date(value).toISOString().slice(0, 10)
    } catch {
      return null
    }
  }

  onSubmit() {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched()
      return
    }

    const raw = this.registerForm.value

    const userData = {
      ...raw,
      personalInfo: {
        ...raw.personalInfo,
        birthDate: this.toISODate(raw.personalInfo?.birthDate),
      },
      professionalInfo: {
        ...raw.professionalInfo,
        startDate: this.toISODate(raw.professionalInfo?.startDate),
      },
    }

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
              this.router.navigate(['/dashboard/users'])
            })
        },
        error: error => {
          this.errorService.handleError(error)
        },
      })
    }
  }
}
