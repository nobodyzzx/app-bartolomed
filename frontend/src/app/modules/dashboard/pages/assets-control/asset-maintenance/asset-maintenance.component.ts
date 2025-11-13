import { Component, OnInit } from '@angular/core'
import { FormBuilder, FormGroup, Validators } from '@angular/forms'
import { Router } from '@angular/router'
import { AlertService } from '@core/services/alert.service'
import {
  AssetMaintenance,
  MaintenanceStatus,
  MaintenanceType,
} from '../interfaces/assets.interfaces'
import { AssetMaintenanceService } from '../services/asset-maintenance.service'

@Component({
  selector: 'app-asset-maintenance',
  templateUrl: './asset-maintenance.component.html',
  styleUrls: ['./asset-maintenance.component.css'],
})
export class AssetMaintenanceComponent implements OnInit {
  maintenanceRecords: AssetMaintenance[] = []
  loading = false
  saving = false
  showForm = false
  maintenanceForm: FormGroup
  selectedRecord: AssetMaintenance | null = null

  maintenanceTypes = Object.values(MaintenanceType)
  maintenanceStatuses = Object.values(MaintenanceStatus)

  // Estadísticas
  totalRecords = 0
  scheduledCount = 0
  inProgressCount = 0
  completedCount = 0
  delayedCount = 0
  totalCost = 0

  constructor(
    private maintenanceService: AssetMaintenanceService,
    private fb: FormBuilder,
    private alert: AlertService,
    private router: Router,
  ) {
    this.maintenanceForm = this.fb.group({
      assetId: ['', [Validators.required, Validators.minLength(3)]],
      assetName: ['', [Validators.required, Validators.minLength(3)]],
      maintenanceDate: ['', Validators.required],
      nextMaintenanceDate: [''],
      description: ['', [Validators.required, Validators.minLength(10)]],
      type: ['', Validators.required],
      status: [MaintenanceStatus.SCHEDULED, Validators.required],
      cost: [0, [Validators.min(0)]],
      performedBy: [''],
      notes: [''],
    })
  }

  ngOnInit(): void {
    this.loadMaintenanceRecords()
  }

  loadMaintenanceRecords(): void {
    this.loading = true
    this.maintenanceService.getMaintenanceRecords().subscribe({
      next: records => {
        this.maintenanceRecords = records
        this.calculateStats()
        this.loading = false
      },
      error: error => {
        this.alert.error('Error al cargar mantenimientos')
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
      .filter(r => r.cost !== undefined)
      .reduce((sum, r) => sum + (r.cost || 0), 0)
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

    const result = await this.alert.fire({
      icon: 'question',
      title: '¿Programar Mantenimiento?',
      text: `Se programará mantenimiento para ${this.maintenanceForm.value.assetName}`,
      showCancelButton: true,
      confirmButtonText: 'Programar',
      cancelButtonText: 'Cancelar',
    })

    if (!result.isConfirmed) return

    this.saving = true
    const maintenanceData = {
      ...this.maintenanceForm.value,
      maintenanceDate: new Date(this.maintenanceForm.value.maintenanceDate),
      nextMaintenanceDate: this.maintenanceForm.value.nextMaintenanceDate
        ? new Date(this.maintenanceForm.value.nextMaintenanceDate)
        : undefined,
    }

    this.maintenanceService.createMaintenance(maintenanceData).subscribe({
      next: newRecord => {
        this.maintenanceRecords.unshift(newRecord)
        this.calculateStats()
        this.maintenanceForm.reset()
        this.maintenanceForm.patchValue({ status: MaintenanceStatus.SCHEDULED })
        this.showForm = false
        this.saving = false
        this.alert.fire({
          icon: 'success',
          title: 'Mantenimiento Programado',
          text: 'El mantenimiento se ha programado correctamente',
          timer: 2000,
          showConfirmButton: false,
        })
      },
      error: error => {
        this.alert.error('Error al crear mantenimiento')
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
    this.maintenanceService.updateMaintenance(record.id, { status: newStatus }).subscribe({
      next: updated => {
        const index = this.maintenanceRecords.findIndex(r => r.id === record.id)
        if (index !== -1) {
          this.maintenanceRecords[index] = updated
          this.calculateStats()
        }
        this.loading = false
        this.alert.fire({
          icon: 'success',
          title: 'Estado Actualizado',
          text: 'El estado del mantenimiento se ha actualizado',
          timer: 1500,
          showConfirmButton: false,
        })
      },
      error: error => {
        this.alert.error('Error al actualizar mantenimiento')
        this.loading = false
      },
    })
  }

  async deleteMaintenance(record: AssetMaintenance): Promise<void> {
    const result = await this.alert.fire({
      icon: 'warning',
      title: '¿Eliminar Mantenimiento?',
      text: `¿Está seguro de eliminar el mantenimiento de "${record.assetName}"? Esta acción no se puede deshacer.`,
      showCancelButton: true,
      confirmButtonText: 'Eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#dc2626',
    })

    if (!result.isConfirmed) return

    this.loading = true
    this.maintenanceService.deleteMaintenance(record.id).subscribe({
      next: () => {
        this.maintenanceRecords = this.maintenanceRecords.filter(r => r.id !== record.id)
        this.calculateStats()
        this.loading = false
        this.alert.fire({
          icon: 'success',
          title: 'Mantenimiento Eliminado',
          text: 'El registro se ha eliminado correctamente',
          timer: 2000,
          showConfirmButton: false,
        })
      },
      error: error => {
        this.alert.error('Error al eliminar mantenimiento')
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
      currency: 'USD',
    }).format(amount)
  }

  toggleForm(): void {
    this.showForm = !this.showForm
    if (!this.showForm) {
      this.maintenanceForm.reset()
      this.maintenanceForm.patchValue({ status: MaintenanceStatus.SCHEDULED })
    }
  }

  goBack(): void {
    this.router.navigate(['/dashboard'])
  }

  filterByStatus(status: MaintenanceStatus | null): void {
    if (status === null) {
      this.loadMaintenanceRecords()
    } else {
      this.loading = true
      this.maintenanceService.getMaintenanceByStatus(status).subscribe({
        next: (records: AssetMaintenance[]) => {
          this.maintenanceRecords = records
          this.loading = false
        },
        error: (error: any) => {
          this.alert.error('Error al filtrar por estado')
          this.loading = false
        },
      })
    }
  }

  filterByType(type: MaintenanceType | null): void {
    if (type === null) {
      this.loadMaintenanceRecords()
    } else {
      this.loading = true
      this.maintenanceService.getMaintenanceByType(type).subscribe({
        next: (records: AssetMaintenance[]) => {
          this.maintenanceRecords = records
          this.loading = false
        },
        error: (error: any) => {
          this.alert.error('Error al filtrar por tipo')
          this.loading = false
        },
      })
    }
  }

  viewRecord(record: AssetMaintenance): void {
    this.selectedRecord = record
  }
}
