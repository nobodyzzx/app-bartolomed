import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ErrorService } from '../../../../../shared/components/services/error.service';
import { CreateClinicDto, UpdateClinicDto } from '../interfaces';
import { ClinicsService } from '../services';

@Component({
  selector: 'app-clinic-form',
  templateUrl: './clinic-form.component.html',
  styleUrl: './clinic-form.component.css'
})
export class ClinicFormComponent implements OnInit {
  clinicForm: FormGroup;
  isEditMode = false;
  isLoading = false;
  currentClinicId: string | null = null;

  constructor(
    private fb: FormBuilder,
    private clinicsService: ClinicsService,
    private router: Router,
    private route: ActivatedRoute,
    private errorService: ErrorService
  ) {
    this.clinicForm = this.createForm();
  }

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      if (params['id']) {
        this.isEditMode = true;
        this.currentClinicId = params['id'];
        this.loadClinic(params['id']);
      }
    });
  }

  createForm(): FormGroup {
    return this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      address: ['', [Validators.required]],
      phone: ['', [Validators.required, Validators.pattern(/^[+]?[0-9\s\-\(\)]+$/)]],
      email: ['', [Validators.email]],
      description: [''],
      city: [''],
      state: [''],
      zipCode: ['', [Validators.pattern(/^[0-9]{5}(-[0-9]{4})?$/)]],
      country: [''],
      isActive: [true]
    });
  }

  loadClinic(id: string) {
    this.isLoading = true;
    this.clinicsService.findOne(id).subscribe({
      next: (clinic) => {
        this.clinicForm.patchValue({
          name: clinic.name,
          address: clinic.address,
          phone: clinic.phone,
          email: clinic.email || '',
          description: clinic.description || '',
          city: clinic.city || '',
          state: clinic.state || '',
          zipCode: clinic.zipCode || '',
          country: clinic.country || '',
          isActive: clinic.isActive
        });
        this.isLoading = false;
      },
      error: (error) => {
        this.errorService.handleError(error);
        this.isLoading = false;
        this.router.navigate(['/dashboard/clinics']);
      }
    });
  }

  onSubmit() {
    if (this.clinicForm.valid) {
      this.isLoading = true;
      const formData = this.clinicForm.value;

      if (this.isEditMode && this.currentClinicId) {
        const updateDto: UpdateClinicDto = {
          ...formData,
          email: formData.email || undefined,
          description: formData.description || undefined,
          city: formData.city || undefined,
          state: formData.state || undefined,
          zipCode: formData.zipCode || undefined,
          country: formData.country || undefined
        };

        this.clinicsService.updateClinic(this.currentClinicId, updateDto).subscribe({
          next: () => {
            this.router.navigate(['/dashboard/clinics']);
          },
          error: (error) => {
            this.errorService.handleError(error);
            this.isLoading = false;
          }
        });
      } else {
        const createDto: CreateClinicDto = {
          ...formData,
          email: formData.email || undefined,
          description: formData.description || undefined,
          city: formData.city || undefined,
          state: formData.state || undefined,
          zipCode: formData.zipCode || undefined,
          country: formData.country || undefined
        };

        this.clinicsService.createClinic(createDto).subscribe({
          next: () => {
            this.router.navigate(['/dashboard/clinics']);
          },
          error: (error) => {
            this.errorService.handleError(error);
            this.isLoading = false;
          }
        });
      }
    } else {
      this.markFormGroupTouched();
    }
  }

  markFormGroupTouched() {
    Object.keys(this.clinicForm.controls).forEach(key => {
      const control = this.clinicForm.get(key);
      control?.markAsTouched();
    });
  }

  onCancel() {
    this.router.navigate(['/dashboard/clinics']);
  }

  getErrorMessage(fieldName: string): string {
    const control = this.clinicForm.get(fieldName);
    
    if (control?.hasError('required')) {
      return `${this.getFieldLabel(fieldName)} es requerido`;
    }
    
    if (control?.hasError('minlength')) {
      const minLength = control.errors?.['minlength']?.requiredLength;
      return `${this.getFieldLabel(fieldName)} debe tener al menos ${minLength} caracteres`;
    }
    
    if (control?.hasError('email')) {
      return 'Ingrese un email válido';
    }
    
    if (control?.hasError('pattern')) {
      if (fieldName === 'phone') {
        return 'Ingrese un número de teléfono válido';
      }
      if (fieldName === 'zipCode') {
        return 'Ingrese un código postal válido';
      }
    }
    
    return '';
  }

  private getFieldLabel(fieldName: string): string {
    const labels: { [key: string]: string } = {
      name: 'Nombre',
      address: 'Dirección',
      phone: 'Teléfono',
      email: 'Email',
      description: 'Descripción',
      city: 'Ciudad',
      state: 'Estado/Provincia',
      zipCode: 'Código Postal',
      country: 'País'
    };
    
    return labels[fieldName] || fieldName;
  }
}
