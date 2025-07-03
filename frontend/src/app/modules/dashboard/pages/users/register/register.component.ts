import { Component, OnInit } from '@angular/core'
import { FormControl, FormGroup, Validators } from '@angular/forms'
import { UsersService } from '../users.service'
import { Router, ActivatedRoute } from '@angular/router'
import { ProfessionalRoles } from '../../../interfaces/professionalRoles.enum'
import { UserRoles } from '../../../interfaces/userRoles.enum'
import { UserRoleItem } from '../../../interfaces/userRoleItem.interface'
import Swal from 'sweetalert2'
import { ErrorService } from '../../../../../shared/components/services/error.service'
import { SidenavService } from '../../../../../shared/components/services/sidenav.services'
import { switchMap } from 'rxjs/operators'
import { of } from 'rxjs'

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
})
export class UserRegisterComponent implements OnInit {
  isExpanded: boolean = true
  isEditMode: boolean = false
  userId: string | null = null

  constructor(
    private usersService: UsersService,
    public router: Router, // Cambiado a public para poder acceder desde la plantilla
    private route: ActivatedRoute,
    private errorService: ErrorService,
    private sidenavService: SidenavService,
  ) {}

  ngOnInit() {
    this.sidenavService.isExpanded$.subscribe(isExpanded => (this.isExpanded = isExpanded))

    // Verificar si estamos en modo edición
    this.route.paramMap
      .pipe(
        switchMap(params => {
          this.userId = params.get('id')
          this.isEditMode = !!this.userId

          if (this.isEditMode && this.userId) {
            return this.usersService.findOne(this.userId)
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

  protected professionalRoles = ProfessionalRoles
  protected readonly validRoles: UserRoleItem[] = [
    {
      value: UserRoles.USER,
      label: 'Usuario',
      icon: 'person',
      description: 'Acceso estándar',
    },
    {
      value: UserRoles.ADMIN,
      label: 'Administrador',
      icon: 'admin_panel_settings',
      description: 'Control total del sistema',
    },
    {
      value: UserRoles.SUPER_USER,
      label: 'Super Usuario',
      icon: 'security',
      description: 'Acceso privilegiado',
    },
    {
      value: UserRoles.GUEST,
      label: 'Invitado',
      icon: 'person_add',
      description: 'Acceso limitado',
    },
  ]

  protected readonly roles = [
    { value: ProfessionalRoles.DOCTOR, label: 'Doctor' },
    { value: ProfessionalRoles.NURSE, label: 'Enfermero/a' },
    { value: ProfessionalRoles.PHARMACIST, label: 'Farmacéutico/a' },
    { value: ProfessionalRoles.LABORATORY_TECHNICIAN, label: 'Técnico de Laboratorio' },
    { value: ProfessionalRoles.PHYSIOTHERAPIST, label: 'Fisioterapeuta' },
    { value: ProfessionalRoles.DENTIST, label: 'Dentista' },
    { value: ProfessionalRoles.NUTRITIONIST, label: 'Nutricionista' },
    { value: ProfessionalRoles.PSYCHOLOGIST, label: 'Psicólogo/a' },
    { value: ProfessionalRoles.RADIOLOGIST, label: 'Radiólogo/a' },
    { value: ProfessionalRoles.ADMINISTRATIVE, label: 'Administrativo/a' },
    { value: ProfessionalRoles.RECEPTIONIST, label: 'Recepcionista' },
    { value: ProfessionalRoles.OTHER, label: 'Otro' },
  ]

  public registerForm: FormGroup = new FormGroup({
    email: new FormControl('', [Validators.required, Validators.email]),
    password: new FormControl('', [Validators.required, Validators.minLength(6)]),
    roles: new FormControl([], [Validators.required]),

    personalInfo: new FormGroup({
      firstName: new FormControl('', Validators.required),
      lastName: new FormControl('', Validators.required),
      phone: new FormControl(''),
      address: new FormControl(''),
      birthDate: new FormControl('', Validators.required),
    }),
    professionalInfo: new FormGroup({
      title: new FormControl('', Validators.required),
      role: new FormControl('', Validators.required),
      specialization: new FormControl('', Validators.required),
      license: new FormControl('', Validators.required),
      certifications: new FormControl([]),
      startDate: new FormControl('', Validators.required),
      description: new FormControl(''),
      areas: new FormControl([]),
    }),
  })

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
      personalInfo: {
        firstName: user.personalInfo?.firstName || '',
        lastName: user.personalInfo?.lastName || '',
        phone: user.personalInfo?.phone || '',
        address: user.personalInfo?.address || '',
        birthDate: user.personalInfo?.birthDate || '',
      },
      professionalInfo: {
        title: user.professionalInfo?.title || '',
        role: user.professionalInfo?.role || '',
        specialization: user.professionalInfo?.specialization || '',
        license: user.professionalInfo?.license || '',
        certifications: user.professionalInfo?.certifications || [],
        startDate: user.professionalInfo?.startDate || user.startDate || '',
        description: user.professionalInfo?.description || '',
        areas: user.professionalInfo?.areas || [],
      },
    })

    // Dejar el campo de contraseña vacío
    passwordControl?.setValue('')
  }

  onSubmit() {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched()
      return
    }

    const userData = this.registerForm.value

    // Asegurarse de que los datos professionales están correctamente estructurados
    if (userData.professionalInfo && userData.professionalInfo.startDate) {
      // Mover la fecha de inicio al objeto raíz para consistencia con la interfaz User
      userData.startDate = userData.professionalInfo.startDate
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

      this.usersService.updateUser(updateData).subscribe({
        next: () => {
          Swal.fire({
            icon: 'success',
            title: 'Usuario actualizado',
            text: 'El usuario ha sido actualizado correctamente',
            timer: 2000,
            showConfirmButton: false,
          }).then(() => {
            this.router.navigate(['/dashboard/users/list'])
          })
        },
        error: error => {
          this.errorService.handleError(error)
        },
      })
    } else {
      // Modo crear
      this.usersService.createUser(userData).subscribe({
        next: response => {
          Swal.fire({
            icon: 'success',
            title: 'Usuario creado',
            html: `<div style="
                font-size: 16px; 
                color: #333; 
                text-align: center;
                padding: 10px;
            ">El usuario ha sido registrado correctamente.</div>`,
            showConfirmButton: false,
            timer: 2000,
            background: 'rgba(255, 255, 255, 0.95)',
            showClass: {
              popup: 'animate__animated animate__fadeInUp animate__faster',
            },
            hideClass: {
              popup: 'animate__animated animate__fadeOutDown animate__faster',
            },
            didOpen: () => {
              const popup = document.querySelector('.swal2-popup') as HTMLElement
              if (popup) {
                popup.style.borderRadius = '12px'
                popup.style.padding = '20px'
                popup.style.boxShadow = '0px 4px 15px rgba(0, 0, 0, 0.2)'
              }

              const title = document.querySelector('.swal2-title') as HTMLElement
              if (title) {
                title.style.fontSize = '20px'
                title.style.fontWeight = 'bold'
                title.style.color = '#198754' // Verde éxito
              }
            },
          }).then(() => {
            this.router.navigate(['/dashboard/users/list'])
          })
        },
        error: error => {
          this.errorService.handleError(error) // Muestra mensaje amigable
        },
      })
    }
  }
}
