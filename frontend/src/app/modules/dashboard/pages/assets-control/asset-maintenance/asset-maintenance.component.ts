import { Component, DestroyRef, inject, OnInit } from '@angular/core'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { FormBuilder, FormGroup, Validators } from '@angular/forms'
import { MatDialog } from '@angular/material/dialog'
import { Router } from '@angular/router'
import { AlertService } from '@core/services/alert.service'
import {
  AssetMaintenance,
  AssetStatus,
  BaseAsset,
  MaintenanceStatus,
  MaintenanceType,
} from '../interfaces/assets.interfaces'
import { AssetMaintenanceService } from '../services/asset-maintenance.service'
import { AssetRegistrationService } from '../services/asset-registration.service'
import { AssetMaintenanceDetailDialogComponent } from './asset-maintenance-detail-dialog/asset-maintenance-detail-dialog.component'

@Component({
    selector: 'app-asset-maintenance',
    templateUrl: './asset-maintenance.component.html',
    styleUrls: ['./asset-maintenance.component.css'],
    standalone: false
})
export class AssetMaintenanceComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef)

  maintenanceRecords: AssetMaintenance[] = []
  loading = false
  saving = false
  showForm = false
  maintenanceForm: FormGroup

  maintenanceTypes = Object.values(MaintenanceType)
  maintenanceStatuses = Object.values(MaintenanceStatus)

  // Activos reales de la clínica para el selector — antes "ID del Activo" era
  // texto libre (matInput con placeholder "Ej: AST-001"), que el backend
  // rechazaba con 500 (invalid input syntax for type uuid) porque assetId
  // debe ser un UUID real de la tabla assets.
  availableAssets: BaseAsset[] = []
  loadingAssets = false

  // Estadísticas
  totalRecords = 0
  scheduledCount = 0
  inProgressCount = 0
  completedCount = 0
  delayedCount = 0
  totalCost = 0

  constructor(
    private maintenanceService: AssetMaintenanceService,
    private assetsService: AssetRegistrationService,
    private fb: FormBuilder,
    private alert: AlertService,
    private router: Router,
    private dialog: MatDialog,
  ) {
    this.maintenanceForm = this.fb.group({
      assetId: ['', Validators.required],
      title: ['', [Validators.required, Validators.minLength(3)]],
      scheduledDate: ['', Validators.required],
      nextMaintenanceDate: [''],
      description: [''],
      type: ['', Validators.required],
      estimatedCost: [0, [Validators.min(0)]],
      technician: [''],
      notes: [''],
    })
  }

  ngOnInit(): void {
    this.loadMaintenanceRecords()
    this.loadAvailableAssets()
  }

  loadAvailableAssets(): void {
    this.loadingAssets = true
    this.assetsService
      .getAssets({ status: AssetStatus.ACTIVE }, 1, 100)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: result => {
          this.availableAssets = result.data
          this.loadingAssets = false
        },
        error: () => {
          this.loadingAssets = false
        },
      })
  }

  loadMaintenanceRecords(): void {
    this.loading = true
    this.maintenanceService.getMaintenanceRecords().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: records => {
        this.maintenanceRecords = records
        this.calculateStats()
        this.loading = false
      },
      error: () => {
        this.loading = false
      },
    })
  }

  calculateStats(): void {
    this.totalRecords = this.maintenanceRecords.length
    this.scheduledCount = this.maintenanceRecords.filter(
      r => r.status === MaintenanceStatus.SCHEDULED,
    ).length
    this.inProgressCount = this.maintenanceRecords.filter(
      r => r.status === MaintenanceStatus.IN_PROGRESS,
    ).length
    this.completedCount = this.maintenanceRecords.filter(
      r => r.status === MaintenanceStatus.COMPLETED,
    ).length
    this.delayedCount = this.maintenanceRecords.filter(
      r => r.status === MaintenanceStatus.DELAYED,
    ).length
    this.totalCost = this.maintenanceRecords
      .filter(r => r.actualCost !== undefined || r.estimatedCost !== undefined)
      // Number(): `actualCost`/`estimatedCost` son `decimal` y llegan como
      // string, igual que `currentValue` en el inventario — sumarlos con `+` los
      // concatena y el pipe de moneda revienta el template entero (NG02100).
      .reduce((sum, r) => sum + (Number(r.actualCost ?? r.estimatedCost) || 0), 0)
  }

  async onScheduleMaintenance(): Promise<void> {
    if (this.maintenanceForm.invalid) {
      this.maintenanceForm.markAllAsTouched()
      await this.alert.fire({
        icon: 'warning',
        title: 'Formulario Incompleto',
        text: 'Por favor complete todos los campos requeridos correctamente',
      })
      return
    }

    const selectedAsset = this.availableAssets.find(a => a.id === this.maintenanceForm.value.assetId)

    const result = await this.alert.fire({
      icon: 'question',
      title: '¿Programar Mantenimiento?',
      text: `Se programará mantenimiento para ${selectedAsset?.name || 'el activo seleccionado'}`,
      showCancelButton: true,
      confirmButtonText: 'Programar',
      cancelButtonText: 'Cancelar',
    })

    if (!result.isConfirmed) return

    this.saving = true
    const formValue = this.maintenanceForm.value
    const maintenanceData = {
      assetId: formValue.assetId,
      title: formValue.title,
      description: formValue.description || undefined,
      type: formValue.type,
      scheduledDate: new Date(formValue.scheduledDate).toISOString().split('T')[0],
      estimatedCost: formValue.estimatedCost || undefined,
      technician: formValue.technician || undefined,
      notes: formValue.notes || undefined,
    }

    this.maintenanceService.createMaintenance(maintenanceData).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: newRecord => {
        this.maintenanceRecords.unshift(newRecord)
        this.calculateStats()
        this.maintenanceForm.reset()
        this.showForm = false
        this.saving = false
      },
      error: () => {
        this.saving = false
      },
    })
  }

  async updateStatus(record: AssetMaintenance, newStatus: MaintenanceStatus): Promise<void> {
    const result = await this.alert.fire({
      icon: 'question',
      title: '¿Actualizar Estado?',
      text: `¿Cambiar estado a "${newStatus}"?`,
      showCancelButton: true,
      confirmButtonText: 'Actualizar',
      cancelButtonText: 'Cancelar',
    })

    if (!result.isConfirmed) return

    this.loading = true
    this.maintenanceService.updateMaintenance(record.id, { status: newStatus }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: updated => {
        const index = this.maintenanceRecords.findIndex(r => r.id === record.id)
        if (index !== -1) {
          this.maintenanceRecords[index] = updated
          this.calculateStats()
        }
        this.loading = false
      },
      error: () => {
        this.loading = false
      },
    })
  }

  async deleteMaintenance(record: AssetMaintenance): Promise<void> {
    const result = await this.alert.fire({
      icon: 'warning',
      title: '¿Eliminar Mantenimiento?',
      text: `¿Está seguro de eliminar el mantenimiento de "${record.asset?.name || record.title}"? Esta acción no se puede deshacer.`,
      showCancelButton: true,
      confirmButtonText: 'Eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#dc2626',
    })

    if (!result.isConfirmed) return

    this.loading = true
    this.maintenanceService.deleteMaintenance(record.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.maintenanceRecords = this.maintenanceRecords.filter(r => r.id !== record.id)
        this.calculateStats()
        this.loading = false
      },
      error: () => {
        this.loading = false
      },
    })
  }

  getStatusClass(status: MaintenanceStatus): string {
    const classes: Record<MaintenanceStatus, string> = {
      [MaintenanceStatus.COMPLETED]: 'bg-green-100 text-green-700',
      [MaintenanceStatus.IN_PROGRESS]: 'bg-blue-100 text-blue-700',
      [MaintenanceStatus.SCHEDULED]: 'bg-amber-100 text-amber-700',
      [MaintenanceStatus.CANCELLED]: 'bg-slate-100 text-slate-700',
      [MaintenanceStatus.DELAYED]: 'bg-red-100 text-red-700',
    }
    return classes[status] || 'bg-slate-100 text-slate-700'
  }

  getStatusIcon(status: MaintenanceStatus): string {
    const icons: Record<MaintenanceStatus, string> = {
      [MaintenanceStatus.COMPLETED]: 'check_circle',
      [MaintenanceStatus.IN_PROGRESS]: 'sync',
      [MaintenanceStatus.SCHEDULED]: 'schedule',
      [MaintenanceStatus.CANCELLED]: 'cancel',
      [MaintenanceStatus.DELAYED]: 'error',
    }
    return icons[status] || 'info'
  }

  getTypeIcon(type: MaintenanceType): string {
    const icons: Record<MaintenanceType, string> = {
      [MaintenanceType.PREVENTIVE]: 'schedule',
      [MaintenanceType.CORRECTIVE]: 'build',
      [MaintenanceType.EMERGENCY]: 'emergency',
      [MaintenanceType.CALIBRATION]: 'tune',
      [MaintenanceType.INSPECTION]: 'search',
    }
    return icons[type] || 'build'
  }

  formatCurrency(amount: number | undefined): string {
    if (amount === undefined || amount === null) return 'N/A'
    return new Intl.NumberFormat('es-US', {
      style: 'currency',
      currency: 'BOB',
    }).format(amount)
  }

  toggleForm(): void {
    this.showForm = !this.showForm
    if (!this.showForm) {
      this.maintenanceForm.reset()
    }
  }

  goBack(): void {
    this.router.navigate(['/dashboard'])
  }

  // Antes llamaba a getMaintenanceByStatus()/getMaintenanceByType(), endpoints
  // que nunca existieron en el backend (404 real al hacer click en las
  // tarjetas). GET /assets/maintenance ya soporta status/type como query
  // params — se reusa el mismo método que la carga inicial.
  filterByStatus(status: MaintenanceStatus | null): void {
    this.loading = true
    this.maintenanceService
      .getMaintenanceRecords(status ? { status } : undefined)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (records: AssetMaintenance[]) => {
          this.maintenanceRecords = records
          this.loading = false
        },
        error: () => {
          this.loading = false
        },
      })
  }

  filterByType(type: MaintenanceType | null): void {
    this.loading = true
    this.maintenanceService
      .getMaintenanceRecords(type ? { type } : undefined)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (records: AssetMaintenance[]) => {
          this.maintenanceRecords = records
          this.loading = false
        },
        error: () => {
          this.loading = false
        },
      })
  }

  viewRecord(record: AssetMaintenance): void {
    const dialogRef = this.dialog.open(AssetMaintenanceDetailDialogComponent, {
      data: record,
      width: '640px',
      maxWidth: '95vw',
      panelClass: 'rounded-dialog',
    })
    dialogRef.afterClosed().subscribe(result => {
      if (result === 'delete') {
        this.deleteMaintenance(record)
      }
    })
  }
}
