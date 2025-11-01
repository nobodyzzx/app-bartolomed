import { Component } from '@angular/core'
import { FormControl, FormGroup, Validators } from '@angular/forms'
import { Router } from '@angular/router'
import { AlertService } from '@core/services/alert.service'
import { PrescriptionsService } from './prescriptions.service'

@Component({
  selector: 'app-prescription-form',
  templateUrl: './prescription-form.component.html',
  styleUrls: ['./prescription-form.component.css'],
})
export class PrescriptionFormComponent {
  form = new FormGroup({
    prescriptionNumber: new FormControl('', Validators.required),
    patientId: new FormControl('', Validators.required),
    doctorId: new FormControl('', Validators.required),
    clinicId: new FormControl('', Validators.required),
    prescriptionDate: new FormControl(new Date().toISOString().slice(0, 10), Validators.required),
    expiryDate: new FormControl('', Validators.required),
    medications: new FormControl('', Validators.required),
    notes: new FormControl(''),
  })

  loading = false

  constructor(
    private router: Router,
    private svc: PrescriptionsService,
    private alert: AlertService,
  ) {}

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched()
      return
    }

    const v = this.form.value
    const payload = {
      prescriptionNumber: v.prescriptionNumber,
      prescriptionDate: v.prescriptionDate,
      expiryDate: v.expiryDate,
      patientId: v.patientId,
      doctorId: v.doctorId,
      clinicId: v.clinicId,
      items: [
        {
          medicationName: v.medications,
          quantity: '1',
          dosage: '',
        },
      ],
      notes: v.notes,
    }

    this.loading = true
    this.svc.create(payload as any).subscribe({
      next: () => {
        this.loading = false
        this.alert.success('Receta creada', 'La receta fue creada correctamente').then(() => {
          this.router.navigate(['../list'])
        })
      },
      error: () => (this.loading = false),
    })
  }
}
