import { Component, DestroyRef, inject, OnInit } from '@angular/core'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { ActivatedRoute, Router } from '@angular/router'
import { AlertService } from '@core/services/alert.service'
import { PrescriptionsService } from './prescriptions.service'

@Component({
    selector: 'app-prescription-detail',
    templateUrl: './prescription-detail.component.html',
    styleUrls: ['./prescription-detail.component.css'],
    standalone: false
})
export class PrescriptionDetailComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef)

  loading = false
  prescription: any

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private svc: PrescriptionsService,
    private alert: AlertService,
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id')!
    this.fetch(id)
  }

  fetch(id: string) {
    this.loading = true
    this.svc.get(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: p => {
        this.loading = false
        this.prescription = p
      },
      error: () => (this.loading = false),
    })
  }

  goBack() {
    this.router.navigate(['/dashboard/prescriptions'])
  }

  getDaysUntilExpiry(dateStr: string): number {
    const today = new Date()
    const expiry = new Date(dateStr)
    const diffTime = expiry.getTime() - today.getTime()
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  }

  isExpired(dateStr: string): boolean {
    return this.getDaysUntilExpiry(dateStr) <= 0
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

  canRefill(p: any): boolean {
    return (
      p?.status === 'active' &&
      !this.isExpired(p?.expiryDate) &&
      (p?.refillsAllowed || 0) > (p?.refillsUsed || 0)
    )
  }

  changeStatus(status: string) {
    this.alert
      .fire({
        icon: 'question',
        title: '¿Confirmar cambio de estado?',
        text: `La receta pasará a estado ${status}.`,
        showCancelButton: true,
        confirmButtonText: 'Confirmar',
        cancelButtonText: 'Cancelar',
      })
      .then(res => {
        if (res.isConfirmed) {
          this.svc.setStatus(this.prescription.id, status).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: () => {
              this.alert
                .success('Estado actualizado', 'La receta fue actualizada.')
                .then(() => this.fetch(this.prescription.id))
            },
          })
        }
      })
  }

  doRefill() {
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
          this.svc.refill(this.prescription.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: () => {
              this.alert
                .success('Resurtido registrado', 'La receta fue resurtida.')
                .then(() => this.fetch(this.prescription.id))
            },
          })
        }
      })
  }

  printLoading = false

  print() {
    if (!this.prescription) return
    this.printLoading = true
    this.svc.getPdf(this.prescription.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: blob => {
        this.printLoading = false
        const url = URL.createObjectURL(blob)
        window.open(url, '_blank')
        setTimeout(() => URL.revokeObjectURL(url), 60000)
      },
      error: () => (this.printLoading = false),
    })
  }
}
