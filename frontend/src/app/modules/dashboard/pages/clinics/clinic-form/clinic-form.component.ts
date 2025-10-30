import { Component, OnInit } from '@angular/core'
import { FormBuilder, FormGroup, Validators } from '@angular/forms'
import { ActivatedRoute, Router } from '@angular/router'
import Swal from 'sweetalert2'
import { ErrorService } from '../../../../../shared/components/services/error.service'
import { SidenavService } from '../../../../../shared/components/services/sidenav.services'
import { CreateClinicDto, UpdateClinicDto } from '../interfaces'
import { ClinicsService } from '../services'

@Component({
  selector: 'app-clinic-form',
  templateUrl: './clinic-form.component.html',
  styleUrl: './clinic-form.component.css',
})
export class ClinicFormComponent implements OnInit {
  clinicForm: FormGroup
  isEditMode = false
  isExpanded: boolean = true
  isLoading = false
  currentClinicId: string | null = null

  // Catálogos Bolivia
  departamentos = [
    'La Paz',
    'Cochabamba',
    'Santa Cruz',
    'Oruro',
    'Potosí',
    'Chuquisaca',
    'Tarija',
    'Beni',
    'Pando',
  ]

  provinciasPorDepartamento: { [key: string]: string[] } = {
    'La Paz': [
      'Murillo',
      'Omasuyos',
      'Pacajes',
      'Camacho',
      'Muñecas',
      'Larecaja',
      'Franz Tamayo',
      'Ingavi',
      'Loayza',
      'Inquisivi',
      'Sud Yungas',
      'Los Andes',
      'Aroma',
      'Nor Yungas',
      'Abel Iturralde',
      'Bautista Saavedra',
      'Manco Kapac',
      'Gualberto Villarroel',
      'José Manuel Pando',
      'Caranavi',
    ],
    Cochabamba: [
      'Cercado',
      'Arani',
      'Arque',
      'Ayopaya',
      'Campero',
      'Capinota',
      'Carrasco',
      'Chapare',
      'Esteban Arce',
      'Germán Jordán',
      'Mizque',
      'Punata',
      'Quillacollo',
      'Tapacarí',
      'Tiraque',
      'Bolívar',
    ],
    'Santa Cruz': [
      'Andrés Ibáñez',
      'Warnes',
      'Velasco',
      'Ichilo',
      'Chiquitos',
      'Sara',
      'Cordillera',
      'Vallegrande',
      'Florida',
      'Obispo Santistevan',
      'Ñuflo de Chávez',
      'Ángel Sandoval',
      'Caballero',
      'Germán Busch',
      'Guarayos',
    ],
    Oruro: [
      'Cercado',
      'Abaroa',
      'Carangas',
      'Eduardo Avaroa',
      'Ladislao Cabrera',
      'Litoral',
      'Nor Carangas',
      'Pantaleón Dalence',
      'Poopó',
      'Sajama',
      'San Pedro de Totora',
      'Saucarí',
      'Sebastián Pagador',
      'Sud Carangas',
      'Tomás Barrón',
    ],
    Potosí: [
      'Tomás Frías',
      'Rafael Bustillo',
      'Cornelio Saavedra',
      'Chayanta',
      'Charcas',
      'Nor Chichas',
      'Alonso de Ibáñez',
      'Sur Chichas',
      'Nor Lípez',
      'Sur Lípez',
      'José María Linares',
      'Antonio Quijarro',
      'Bernardino Bilbao',
      'Daniel Campos',
      'Modesto Omiste',
      'Enrique Baldivieso',
    ],
    Chuquisaca: [
      'Oropeza',
      'Azurduy',
      'Zudáñez',
      'Tomina',
      'Hernando Siles',
      'Yamparáez',
      'Nor Cinti',
      'Sud Cinti',
      'Belisario Boeto',
      'Luis Calvo',
    ],
    Tarija: [
      'Cercado',
      'Aniceto Arce',
      'Gran Chaco',
      'José María Avilés',
      'Eustaquio Méndez',
      "Burnet O'Connor",
    ],
    Beni: [
      'Cercado',
      'Vaca Díez',
      'José Ballivián',
      'Yacuma',
      'Moxos',
      'Marbán',
      'Mamoré',
      'Iténez',
    ],
    Pando: ['Nicolás Suárez', 'Manuripi', 'Madre de Dios', 'Abuná', 'Federico Román'],
  }

  provinciasDisponibles: string[] = []

  constructor(
    private fb: FormBuilder,
    private clinicsService: ClinicsService,
    public router: Router,
    private route: ActivatedRoute,
    private errorService: ErrorService,
    private sidenavService: SidenavService,
  ) {
    this.clinicForm = this.createForm()
  }

  ngOnInit(): void {
    this.sidenavService.isExpanded$.subscribe(isExpanded => (this.isExpanded = isExpanded))

    this.route.params.subscribe(params => {
      if (params['id']) {
        this.isEditMode = true
        this.currentClinicId = params['id']
        this.loadClinic(params['id'])
      }
    })

    // Reactividad: cuando cambia el departamento, filtrar provincias
    this.clinicForm
      .get('departamento')
      ?.valueChanges.subscribe(dep => this.onDepartamentoChange(dep))
  }

  createForm(): FormGroup {
    return this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      address: ['', [Validators.required]],
      phone: [
        '',
        [
          Validators.required,
          Validators.pattern(/^[67]\d{7}$/),
          Validators.minLength(8),
          Validators.maxLength(8),
        ],
      ],
      email: ['', [Validators.email]],
      description: [''],
      departamento: [''],
      provincia: [''],
      localidad: [''],
      isActive: [true],
    })
  }

  onDepartamentoChange(departamento: string) {
    if (departamento && this.provinciasPorDepartamento[departamento]) {
      this.provinciasDisponibles = this.provinciasPorDepartamento[departamento]
      const provinciaActual = this.clinicForm.get('provincia')?.value
      if (provinciaActual && !this.provinciasDisponibles.includes(provinciaActual)) {
        this.clinicForm.patchValue({ provincia: '' })
      }
    } else {
      this.provinciasDisponibles = []
      this.clinicForm.patchValue({ provincia: '' })
    }
  }

  loadClinic(id: string) {
    this.isLoading = true
    this.clinicsService.findOne(id).subscribe({
      next: clinic => {
        this.clinicForm.patchValue({
          name: clinic.name,
          address: clinic.address,
          phone: clinic.phone,
          email: clinic.email || '',
          description: clinic.description || '',
          departamento: (clinic as any).departamento || '',
          provincia: (clinic as any).provincia || '',
          localidad: (clinic as any).localidad || '',
          isActive: clinic.isActive,
        })
        if ((clinic as any).departamento) this.onDepartamentoChange((clinic as any).departamento)
        this.isLoading = false
      },
      error: error => {
        this.errorService.handleError(error)
        this.isLoading = false
        this.router.navigate(['/dashboard/clinics'])
      },
    })
  }

  onSubmit() {
    if (this.clinicForm.valid) {
      this.isLoading = true
      const formData = this.clinicForm.value

      if (this.isEditMode && this.currentClinicId) {
        const updateDto: UpdateClinicDto = {
          ...formData,
          email: formData.email || undefined,
          description: formData.description || undefined,
          departamento: formData.departamento || undefined,
          provincia: formData.provincia || undefined,
          localidad: formData.localidad || undefined,
        }

        this.clinicsService.updateClinic(this.currentClinicId, updateDto).subscribe({
          next: () => {
            this.isLoading = false
            Swal.fire({
              icon: 'success',
              title: 'Clínica actualizada',
              text: 'La clínica ha sido actualizada correctamente',
              timer: 2000,
              showConfirmButton: false,
            }).then(() => {
              this.router.navigate(['/dashboard/clinics'])
            })
          },
          error: error => {
            this.errorService.handleError(error)
            this.isLoading = false
          },
        })
      } else {
        const createDto: CreateClinicDto = {
          ...formData,
          email: formData.email || undefined,
          description: formData.description || undefined,
          departamento: formData.departamento || undefined,
          provincia: formData.provincia || undefined,
          localidad: formData.localidad || undefined,
        }

        this.clinicsService.createClinic(createDto).subscribe({
          next: () => {
            this.isLoading = false
            Swal.fire({
              icon: 'success',
              title: 'Clínica creada',
              html: `<div style="
                  font-size: 16px; 
                  color: #333; 
                  text-align: center;
                  padding: 10px;
              ">La clínica ha sido registrada correctamente.</div>`,
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
                  title.style.color = '#198754'
                }
              },
            }).then(() => {
              this.router.navigate(['/dashboard/clinics'])
            })
          },
          error: error => {
            this.errorService.handleError(error)
            this.isLoading = false
          },
        })
      }
    } else {
      this.markFormGroupTouched()
    }
  }

  markFormGroupTouched() {
    Object.keys(this.clinicForm.controls).forEach(key => {
      const control = this.clinicForm.get(key)
      control?.markAsTouched()
    })
  }

  onCancel() {
    this.router.navigate(['/dashboard/clinics'])
  }

  getErrorMessage(fieldName: string): string {
    const control = this.clinicForm.get(fieldName)

    if (control?.hasError('required')) {
      return `${this.getFieldLabel(fieldName)} es requerido`
    }

    if (control?.hasError('minlength')) {
      const minLength = control.errors?.['minlength']?.requiredLength
      return `${this.getFieldLabel(fieldName)} debe tener al menos ${minLength} caracteres`
    }

    if (control?.hasError('email')) {
      return 'Ingrese un email válido'
    }

    if (control?.hasError('pattern')) {
      if (fieldName === 'phone') {
        return 'Ingrese un número válido de 8 dígitos que comience con 6 o 7'
      }
    }

    return ''
  }

  private getFieldLabel(fieldName: string): string {
    const labels: { [key: string]: string } = {
      name: 'Nombre',
      address: 'Dirección',
      phone: 'Teléfono',
      email: 'Email',
      description: 'Descripción',
      departamento: 'Departamento',
      provincia: 'Provincia',
      localidad: 'Localidad',
    }

    return labels[fieldName] || fieldName
  }
}
