import { Component, OnInit } from '@angular/core'
import { Router } from '@angular/router'
import { AlertService } from '@core/services/alert.service'
import { SidenavService } from '../../../../shared/components/services/sidenav.service'
import { PrescriptionsService } from './prescriptions.service'

interface Prescription {
  id: string
  prescriptionNumber: string
  prescriptionDate: string
  expiryDate: string
  status: string
  diagnosis: string
  patient: {
    id: string
    firstName: string
    lastName: string
    documentNumber: string
  }
  doctor: {
    id: string
    email: string
    personalInfo?: {
      firstName: string
      lastName: string
    }
  }
  items: Array<{
    medicationName: string
    strength: string
    quantity: string
  }>
  refillsAllowed: number
  refillsUsed: number
}

@Component({
  selector: 'app-prescription-list',
  templateUrl: './prescription-list.component.html',
  styleUrls: ['./prescription-list.component.css'],
})
export class PrescriptionListComponent implements OnInit {
  isExpanded: boolean = true
  prescriptions: Prescription[] = []
  filteredPrescriptions: Prescription[] = []
  loading: boolean = false
  searchTerm: string = ''
  selectedStatus: string = ''

  statusOptions = [
    { value: '', label: 'Todos los estados' },
    { value: 'draft', label: 'Borrador' },
    { value: 'active', label: 'Activa' },
    { value: 'dispensed', label: 'Dispensada' },
    { value: 'completed', label: 'Completada' },
    { value: 'cancelled', label: 'Cancelada' },
    { value: 'expired', label: 'Vencida' },
  ]

  constructor(
    private prescriptionsService: PrescriptionsService,
    private router: Router,
    private sidenavService: SidenavService,
    private alert: AlertService,
  ) {
    this.sidenavService.isExpanded$.subscribe(exp => (this.isExpanded = exp))
  }

  ngOnInit(): void {
    this.loadPrescriptions()
  }

  loadPrescriptions(): void {
    this.loading = true
    const filter: any = {}
    if (this.selectedStatus) filter.status = this.selectedStatus
    if (this.searchTerm?.trim()) filter.search = this.searchTerm.trim()

    this.prescriptionsService.list(1, 100, filter).subscribe({
      next: (response: any) => {
        this.prescriptions = response.items || []
        this.filteredPrescriptions = this.prescriptions
        this.loading = false
      },
      error: () => {
        this.loading = false
        this.alert.fire({
          icon: 'error',
          title: 'Error',
          text: 'No se pudieron cargar las recetas',
        })
      },
    })
  }

  onSearch(): void {
    this.loadPrescriptions()
  }

  onStatusChange(): void {
    this.loadPrescriptions()
  }

  createPrescription(): void {
    this.router.navigate(['/dashboard/prescriptions/new'])
  }

  viewPrescription(prescription: Prescription): void {
    this.router.navigate(['/dashboard/prescriptions', prescription.id])
  }

  editPrescription(prescription: Prescription): void {
    this.router.navigate(['/dashboard/prescriptions/edit', prescription.id])
  }

  goBack(): void {
    this.router.navigate(['/dashboard'])
  }

  getStatusBadgeClass(status: string): string {
    const classes: any = {
      draft: 'bg-slate-100 text-slate-700',
      active: 'bg-emerald-100 text-emerald-700',
      dispensed: 'bg-blue-100 text-blue-700',
      completed: 'bg-purple-100 text-purple-700',
      cancelled: 'bg-red-100 text-red-700',
      expired: 'bg-orange-100 text-orange-700',
    }
    return classes[status] || 'bg-slate-100 text-slate-700'
  }

  getStatusLabel(status: string): string {
    const labels: any = {
      draft: 'Borrador',
      active: 'Activa',
      dispensed: 'Dispensada',
      completed: 'Completada',
      cancelled: 'Cancelada',
      expired: 'Vencida',
    }
    return labels[status] || status
  }

  getDaysUntilExpiry(expiryDate: string): number {
    const today = new Date()
    const expiry = new Date(expiryDate)
    const diffTime = expiry.getTime() - today.getTime()
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  }

  isExpiringSoon(expiryDate: string): boolean {
    return this.getDaysUntilExpiry(expiryDate) <= 7 && this.getDaysUntilExpiry(expiryDate) > 0
  }

  isExpired(expiryDate: string): boolean {
    return this.getDaysUntilExpiry(expiryDate) <= 0
  }

  canRefill(p: Prescription): boolean {
    return (
      p.status === 'active' &&
      !this.isExpired(p.expiryDate) &&
      (p.refillsAllowed || 0) > (p.refillsUsed || 0)
    )
  }

  changeStatus(p: Prescription, status: string) {
    this.alert
      .fire({
        icon: 'question',
        title: '¿Confirmar cambio de estado?',
        text: `La receta pasará a estado ${this.getStatusLabel(status)}.`,
        showCancelButton: true,
        confirmButtonText: 'Confirmar',
        cancelButtonText: 'Cancelar',
      })
      .then(res => {
        if (res.isConfirmed) {
          this.prescriptionsService.setStatus(p.id, status).subscribe({
            next: () => {
              this.alert
                .success('Estado actualizado', 'La receta fue actualizada.')
                .then(() => this.loadPrescriptions())
            },
          })
        }
      })
  }

  doRefill(p: Prescription) {
    this.alert
      .fire({
        icon: 'question',
        title: '¿Agregar resurtido?',
        text: 'Se incrementará el contador de resurtidos.',
        showCancelButton: true,
        confirmButtonText: 'Confirmar',
        cancelButtonText: 'Cancelar',
      })
      .then(res => {
        if (res.isConfirmed) {
          this.prescriptionsService.refill(p.id).subscribe({
            next: () => {
              this.alert
                .success('Resurtido registrado', 'La receta fue resurtida.')
                .then(() => this.loadPrescriptions())
            },
          })
        }
      })
  }
}
