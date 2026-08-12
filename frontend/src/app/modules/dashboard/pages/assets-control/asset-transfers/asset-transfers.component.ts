import { Location } from '@angular/common'
import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { FormBuilder, FormGroup, Validators } from '@angular/forms'
import { MatDialog } from '@angular/material/dialog'
import { AlertService } from '@core/services/alert.service'
import { ClinicContextService } from '../../../../../modules/clinics/services/clinic-context.service'
import { Clinic } from '../../admin/clinics/interfaces'
import { ClinicsService } from '../../admin/clinics/services/clinics.service'
import { AssetRegistrationService } from '../services/asset-registration.service'
import { Sort } from '@angular/material/sort'
import { AssetTransfersService } from '../services/asset-transfers.service'
import { EstadoOrden, leerOrden, ordenar } from '../../../../../shared/utils/table-sort.util'
import {
  AssetTransfer,
  AssetTransferStatus,
  BaseAsset,
  CreateAssetTransferDto,
} from '../interfaces/assets.interfaces'
import { AssetTransferAuditDialogComponent } from './asset-transfer-audit-dialog/asset-transfer-audit-dialog.component'

@Component({
    selector: 'app-asset-transfers',
    templateUrl: './asset-transfers.component.html',
    standalone: false
})
export class AssetTransfersComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef)

  // Estado de carga
  loading = signal(false)
  loadingClinics = signal(false)
  loadingAssets = signal(false)

  // Datos
  transfers = signal<AssetTransfer[]>([])
  clinics = signal<Clinic[]>([])
  availableAssets = signal<BaseAsset[]>([])

  // Estado UI
  activeFilter = signal<AssetTransferStatus | null>(null)
  showNewTransferForm = signal(false)
  currentClinicId = signal<string | null>(null)

  // Formulario de nuevo traslado
  form: FormGroup
  selectedAssetIds = signal<string[]>([])

  readonly AssetTransferStatus = AssetTransferStatus

  /** Columna por la que se ordena. Vacío = como vino del servidor: lo último primero. */
  orden = signal<EstadoOrden>({ key: '', dir: '' })

  onSort(sort: Sort): void {
    this.orden.set(leerOrden(sort))
  }

  ordenadas = computed(() =>
    ordenar(this.transfers(), this.orden(), (t, key) => {
      switch (key) {
        case 'transferNumber': return t.transferNumber
        // Por la ruta entera, origen y luego destino: es como se lee la celda.
        case 'route': return `${t.sourceClinic?.name ?? ''} ${t.targetClinic?.name ?? ''}`.trim()
        // La etiqueta y no el valor del enum: la columna dice "Despachado".
        case 'status': return this.getStatusLabel(t.status)
        case 'date': return t.createdAt ? new Date(t.createdAt).getTime() : null
        default: return null
      }
    }),
  )

  constructor(
    private fb: FormBuilder,
    private transfersService: AssetTransfersService,
    private assetsService: AssetRegistrationService,
    private clinicsService: ClinicsService,
    private clinicContext: ClinicContextService,
    private alert: AlertService,
    private location: Location,
    private dialog: MatDialog,
  ) {
    this.form = this.fb.group({
      targetClinicId: ['', Validators.required],
      notes: [''],
    })
  }

  ngOnInit(): void {
    this.currentClinicId.set(this.clinicContext.clinicId)
    this.loadTransfers()
    this.loadClinics()
    this.loadAvailableAssets()
  }

  loadTransfers(): void {
    this.loading.set(true)
    this.transfersService
      .getTransfers(this.activeFilter() ?? undefined)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: result => {
          this.transfers.set(result.data)
          this.loading.set(false)
        },
        error: () => this.loading.set(false),
      })
  }

  loadClinics(): void {
    this.loadingClinics.set(true)
    this.clinicsService
      .findAll(true)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (clinics: Clinic[]) => {
          this.clinics.set(clinics.filter((c: Clinic) => c.id !== this.currentClinicId()))
          this.loadingClinics.set(false)
        },
        error: () => this.loadingClinics.set(false),
      })
  }

  loadAvailableAssets(): void {
    this.loadingAssets.set(true)
    this.assetsService
      .getAssets({ status: 'active' as any })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: result => {
          this.availableAssets.set(result.data)
          this.loadingAssets.set(false)
        },
        error: () => this.loadingAssets.set(false),
      })
  }

  setFilter(status: AssetTransferStatus | null): void {
    this.activeFilter.set(status)
    this.loadTransfers()
  }

  // ─── Crear traslado ─────────────────────────────────────────────────────────

  toggleAssetSelection(assetId: string): void {
    const current = this.selectedAssetIds()
    if (current.includes(assetId)) {
      this.selectedAssetIds.set(current.filter(id => id !== assetId))
    } else {
      this.selectedAssetIds.set([...current, assetId])
    }
  }

  isSelected(assetId: string): boolean {
    return this.selectedAssetIds().includes(assetId)
  }

  async submitNewTransfer(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched()
      this.alert.warning('Formulario inválido', 'Seleccione la clínica destino')
      return
    }
    if (this.selectedAssetIds().length === 0) {
      this.alert.warning('Sin activos', 'Seleccione al menos un activo para trasladar')
      return
    }

    const targetClinic = this.clinics().find(c => c.id === this.form.value.targetClinicId)
    const result = await this.alert.confirm({
      title: 'Confirmar solicitud de traslado',
      html: `<div class="text-left text-sm">
        <p><strong>Destino:</strong> ${targetClinic?.name}</p>
        <p><strong>Activos:</strong> ${this.selectedAssetIds().length} elemento(s)</p>
        ${this.form.value.notes ? `<p><strong>Notas:</strong> ${this.form.value.notes}</p>` : ''}
        <p class="mt-2 text-slate-500">La clínica origen deberá confirmar el despacho.</p>
      </div>`,
      confirmButtonText: 'Solicitar traslado',
      cancelButtonText: 'Cancelar',
    })
    if (!result.isConfirmed) return

    const dto: CreateAssetTransferDto = {
      targetClinicId: this.form.value.targetClinicId,
      notes: this.form.value.notes || undefined,
      items: this.selectedAssetIds().map(id => ({ assetId: id })),
    }

    this.loading.set(true)
    this.transfersService
      .create(dto)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.loading.set(false)
          this.showNewTransferForm.set(false)
          this.form.reset()
          this.selectedAssetIds.set([])
          this.loadTransfers()
        },
        error: () => this.loading.set(false),
      })
  }

  // ─── Acciones de traslado ───────────────────────────────────────────────────

  async dispatch(transfer: AssetTransfer): Promise<void> {
    const result = await this.alert.confirm({
      title: 'Confirmar despacho',
      html: `<div class="text-left text-sm">
        <p>¿Confirma que los <strong>${transfer.items.length} activo(s)</strong> del traslado <strong>${transfer.transferNumber}</strong> han sido enviados?</p>
        <p class="mt-2 text-amber-600">Los activos quedarán marcados como INACTIVOS hasta que la clínica destino confirme la recepción.</p>
      </div>`,
      confirmButtonText: 'Sí, despachar',
      cancelButtonText: 'Cancelar',
    })
    if (!result.isConfirmed) return

    this.loading.set(true)
    this.transfersService
      .dispatch(transfer.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.loading.set(false)
          this.loadTransfers()
        },
        error: () => this.loading.set(false),
      })
  }

  async confirmReceipt(transfer: AssetTransfer): Promise<void> {
    const result = await this.alert.confirm({
      title: 'Confirmar recepción',
      html: `<div class="text-left text-sm">
        <p>¿Confirma que los <strong>${transfer.items.length} activo(s)</strong> del traslado <strong>${transfer.transferNumber}</strong> fueron recibidos correctamente?</p>
        <p class="mt-2 text-green-600">Los activos serán asignados a esta clínica y quedarán ACTIVOS.</p>
      </div>`,
      confirmButtonText: 'Sí, confirmar',
      cancelButtonText: 'Cancelar',
    })
    if (!result.isConfirmed) return

    this.loading.set(true)
    this.transfersService
      .confirmReceipt(transfer.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.loading.set(false)
          this.loadTransfers()
        },
        error: () => this.loading.set(false),
      })
  }

  async reject(transfer: AssetTransfer): Promise<void> {
    const result = await this.alert.prompt({
      title: 'Rechazar solicitud',
      inputLabel: 'Motivo del rechazo',
      inputPlaceholder: 'Explique por qué rechaza este traslado...',
      confirmButtonText: 'Rechazar',
      cancelButtonText: 'Cancelar',
      inputValidator: (value: string) => (!value?.trim() ? 'El motivo es requerido' : null),
    })
    if (!result.isConfirmed || !result.value) return

    this.loading.set(true)
    this.transfersService
      .reject(transfer.id, result.value)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.loading.set(false)
          this.loadTransfers()
        },
        error: () => this.loading.set(false),
      })
  }

  async returnTransfer(transfer: AssetTransfer): Promise<void> {
    const result = await this.alert.prompt({
      title: 'Devolver traslado',
      inputLabel: 'Motivo de la devolución',
      inputPlaceholder: 'Explique por qué devuelve los activos...',
      confirmButtonText: 'Devolver',
      cancelButtonText: 'Cancelar',
      inputValidator: (value: string) => (!value?.trim() ? 'El motivo es requerido' : null),
    })
    if (!result.isConfirmed || !result.value) return

    this.loading.set(true)
    this.transfersService
      .returnTransfer(transfer.id, result.value)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.loading.set(false)
          this.loadTransfers()
        },
        error: () => this.loading.set(false),
      })
  }

  viewAudit(transfer: AssetTransfer): void {
    this.dialog.open(AssetTransferAuditDialogComponent, {
      data: transfer,
      width: '480px',
      maxWidth: '95vw',
      panelClass: 'rounded-dialog',
    })
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  isSourceClinic(transfer: AssetTransfer): boolean {
    return transfer.sourceClinicId === this.currentClinicId()
  }

  isTargetClinic(transfer: AssetTransfer): boolean {
    return transfer.targetClinicId === this.currentClinicId()
  }

  getStatusLabel(status: AssetTransferStatus): string {
    const map: Record<AssetTransferStatus, string> = {
      [AssetTransferStatus.REQUESTED]: 'Solicitado',
      [AssetTransferStatus.IN_TRANSIT]: 'En Tránsito',
      [AssetTransferStatus.COMPLETED]: 'Completado',
      [AssetTransferStatus.REJECTED]: 'Rechazado',
      [AssetTransferStatus.RETURNED]: 'Devuelto',
    }
    return map[status] ?? status
  }

  getStatusClasses(status: AssetTransferStatus): string {
    const map: Record<AssetTransferStatus, string> = {
      [AssetTransferStatus.REQUESTED]: 'bg-amber-100 text-amber-700',
      [AssetTransferStatus.IN_TRANSIT]: 'bg-blue-100 text-blue-700',
      [AssetTransferStatus.COMPLETED]: 'bg-green-100 text-green-700',
      [AssetTransferStatus.REJECTED]: 'bg-red-100 text-red-700',
      [AssetTransferStatus.RETURNED]: 'bg-slate-100 text-slate-600',
    }
    return map[status] ?? 'bg-slate-100 text-slate-600'
  }

  getStatusIcon(status: string): string {
    const map: Record<string, string> = {
      [AssetTransferStatus.REQUESTED]: 'schedule',
      [AssetTransferStatus.IN_TRANSIT]: 'local_shipping',
      [AssetTransferStatus.COMPLETED]: 'check_circle',
      [AssetTransferStatus.REJECTED]: 'cancel',
      [AssetTransferStatus.RETURNED]: 'undo',
    }
    return map[status] ?? 'info'
  }

  getCountByStatus(status: AssetTransferStatus): number {
    return this.transfers().filter(t => t.status === status).length
  }

  goBack(): void {
    this.location.back()
  }

  cancelNewTransfer(): void {
    this.showNewTransferForm.set(false)
    this.form.reset()
    this.selectedAssetIds.set([])
  }
}
