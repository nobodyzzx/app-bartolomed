import { Component, DestroyRef, inject, OnInit } from '@angular/core'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { Router } from '@angular/router'
import { AlertService } from '@core/services/alert.service'
import { Prescription } from './interfaces/prescription-ui.interface'
import { PrescriptionsService } from './prescriptions.service'

const STATUS_MAP: Record<string, { label: string; classes: string }> = {
  draft:     { label: 'Borrador',    classes: 'bg-slate-100 text-slate-700' },
  active:    { label: 'Activa',      classes: 'bg-emerald-100 text-emerald-700' },
  dispensed: { label: 'Dispensada',  classes: 'bg-blue-100 text-blue-700' },
  completed: { label: 'Completada',  classes: 'bg-purple-100 text-purple-700' },
  cancelled: { label: 'Cancelada',   classes: 'bg-red-100 text-red-700' },
  expired:   { label: 'Vencida',     classes: 'bg-orange-100 text-orange-700' },
}

@Component({
    selector: 'app-prescription-list',
    templateUrl: './prescription-list.component.html',
    styleUrls: ['./prescription-list.component.css'],
    standalone: false
})
export class PrescriptionListComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef)

  prescriptions: Prescription[] = []
  filteredPrescriptions: Prescription[] = []
  loading = false
  searchTerm = ''
  selectedStatus = ''

  constructor(
    private prescriptionsService: PrescriptionsService,
    private router: Router,
    private alert: AlertService,
  ) {}

  ngOnInit(): void {
    this.loadPrescriptions()
  }

  loadPrescriptions(): void {
    this.loading = true
    const filter: any = {}
    if (this.selectedStatus) filter.status = this.selectedStatus
    if (this.searchTerm?.trim()) filter.search = this.searchTerm.trim()

    this.prescriptionsService.list(1, 100, filter).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
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
    return STATUS_MAP[status]?.classes ?? 'bg-slate-100 text-slate-700'
  }

  getStatusLabel(status: string): string {
    return STATUS_MAP[status]?.label ?? status
  }

  getDaysUntilExpiry(expiryDate: string): number {
    const today = new Date()
    const expiry = new Date(expiryDate)
    const diffTime = expiry.getTime() - today.getTime()
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  }

  isExpiringSoon(expiryDate: string): boolean {
    const days = this.getDaysUntilExpiry(expiryDate)
    return days > 0 && days <= 7
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

  getCountByStatus(status: string): number {
    return this.prescriptions.filter(p => p.status === status).length
  }

  getExpiredCount(): number {
    return this.prescriptions.filter(p => this.isExpired(p.expiryDate)).length
  }

  getPatientInitials(p: Prescription): string {
    return (
      (p.patient?.firstName?.charAt(0) ?? '') + (p.patient?.lastName?.charAt(0) ?? '')
    ).toUpperCase() || '?'
  }

  setStatusFilter(status: string): void {
    this.selectedStatus = status
    this.loadPrescriptions()
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
          this.prescriptionsService.setStatus(p.id, status).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
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
          this.prescriptionsService.refill(p.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: () => {
              this.alert
                .success('Resurtido registrado', 'La receta fue resurtida.')
                .then(() => this.loadPrescriptions())
            },
          })
        }
      })
  }

  activate(p: Prescription) {
    this.prescriptionsService.setStatus(p.id, 'active').pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => this.loadPrescriptions(),
    })
  }

  printPdf(p: Prescription) {
    this.prescriptionsService.getPdf(p.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob)
        window.open(url, '_blank')
        setTimeout(() => URL.revokeObjectURL(url), 60000)
      },
    })
  }
}
