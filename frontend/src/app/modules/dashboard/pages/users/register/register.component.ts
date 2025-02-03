import { Component } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { UsersService } from '../users.service';
import { Router } from '@angular/router';
import { ProfessionalRoles } from '../../../interfaces/professionalRoles.enum';
import { UserRoles } from '../../../interfaces/userRoles.enum';
import { UserRoleItem } from '../../../interfaces/userRoleItem.interface';
import Swal from 'sweetalert2';
import { ErrorService } from '../../../../../shared/components/services/error.service';
@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  styles: ``,
})
export class UserRegisterComponent {
  protected professionalRoles = ProfessionalRoles;

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
  ];

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
  ];

  constructor(
    private usersService: UsersService,
    private router: Router,
    private errorService: ErrorService
  ) {}

  public registerForm: FormGroup = new FormGroup({
    email: new FormControl('h@h.com', [Validators.required, Validators.email]),
    password: new FormControl('Abc123', [Validators.required, Validators.minLength(6)]),
    roles: new FormControl(['user'], [Validators.required]),

    personalInfo: new FormGroup({
      firstName: new FormControl('Prueba', Validators.required),
      lastName: new FormControl('Frontend', Validators.required),
      phone: new FormControl('72158963'),
      address: new FormControl('Calle Prueba #582'),
      birthDate: new FormControl('1990-01-01', Validators.required),
    }),
    professionalInfo: new FormGroup({
      title: new FormControl('Doctor', Validators.required),
      role: new FormControl('Doctor', Validators.required),
      specialization: new FormControl('Doctor', Validators.required),
      license: new FormControl('Mt-35863', Validators.required),
      certifications: new FormControl([]),
      startDate: new FormControl('2000-01-02', Validators.required),
      description: new FormControl('nada '),
      areas: new FormControl([]),
    }),
  });

  onSubmit() {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    const userData = this.registerForm.value;
    console.log('Datos enviados:', userData);

    this.usersService.createUser(userData).subscribe({
      next: (response) => {
        console.log('Respuesta exitosa:', response);
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
            const popup = document.querySelector('.swal2-popup') as HTMLElement;
            if (popup) {
              popup.style.borderRadius = '12px';
              popup.style.padding = '20px';
              popup.style.boxShadow = '0px 4px 15px rgba(0, 0, 0, 0.2)';
            }

            const title = document.querySelector('.swal2-title') as HTMLElement;
            if (title) {
              title.style.fontSize = '20px';
              title.style.fontWeight = 'bold';
              title.style.color = '#198754'; // Verde éxito
            }
          },
        }).then(() => {
          this.router.navigate(['/dashboard/users']);
        });
      },
      error: (error) => {
        console.log('Error detallado:', error);
        this.errorService.handleError(error); // Muestra mensaje amigable
      },
    });
  }
}
