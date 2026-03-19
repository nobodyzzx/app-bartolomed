import { Location } from '@angular/common'
import { Component, computed, OnInit, signal } from '@angular/core'
import { Router } from '@angular/router'
import { AlertService } from '@core/services/alert.service'
import { Supplier, SupplierType } from '../interfaces/pharmacy.interfaces'
import { SuppliersService } from '../services/suppliers.service'

@Component({
  selector: 'app-suppliers',
  templateUrl: './suppliers.component.html',
  styleUrls: ['./suppliers.component.css'],
})
export class SuppliersComponent implements OnInit {
  loading = signal(false)
  suppliers = signal<Supplier[]>([])
  search = signal('')
  statusFilter = signal<'all' | 'active' | 'inactive'>('all')

  filtered = computed(() => {
    const term = this.search().toLowerCase().trim()
    const status = this.statusFilter()
    return this.suppliers().filter(s => {
      if (status === 'active' && !s.isActive) return false
      if (status === 'inactive' && s.isActive) return false
      if (!term) return true
      return [s.nombreComercial || s.name, s.razonSocial, s.contactPerson, s.email, s.city, s.country]
        .filter(Boolean)
        .some(v => v!.toLowerCase().includes(term))
    })
  })

  activeCount       = computed(() => this.suppliers().filter(s => s.isActive).length)
  inactiveCount     = computed(() => this.suppliers().filter(s => !s.isActive).length)
  medicamentosCount = computed(() => this.suppliers().filter(s => s.tipoProveedor === SupplierType.MEDICAMENTOS).length)

  setStatusFilter(f: 'all' | 'active' | 'inactive'): void {
    this.statusFilter.set(f)
  }

  constructor(
    private suppliersService: SuppliersService,
    private alert: AlertService,
    private router: Router,
    private location: Location,
  ) {}

  ngOnInit(): void {
    this.load()
  }

  load(): void {
    this.loading.set(true)
    this.suppliersService.getAll().subscribe({
      next: list => {
        this.suppliers.set(list)
        this.loading.set(false)
      },
      error: () => this.loading.set(false),
    })
  }

  newSupplier(): void {
    this.router.navigate(['/dashboard/pharmacy/suppliers/new'])
  }

  edit(s: Supplier): void {
    this.router.navigate(['/dashboard/pharmacy/suppliers/edit', s.id])
  }

  delete(s: Supplier): void {
    this.alert
      .confirm({
        title: 'Eliminar proveedor',
        text: `¿Seguro que desea eliminar ${s.nombreComercial || s.name}?`,
        confirmButtonText: 'Eliminar',
        cancelButtonText: 'Cancelar',
      })
      .then(result => {
        if (!result.isConfirmed) return
        this.loading.set(true)
        this.suppliersService.remove(s.id).subscribe({
          next: () => {
            this.alert.success('Eliminado', 'Proveedor eliminado correctamente')
            this.suppliers.set(this.suppliers().filter(x => x.id !== s.id))
            this.loading.set(false)
          },
          error: () => this.loading.set(false),
        })
      })
  }

  restore(s: Supplier): void {
    this.loading.set(true)
    this.suppliersService.restore(s.id).subscribe({
      next: restored => {
        this.alert.success('Restaurado', 'Proveedor restaurado correctamente')
        this.suppliers.set(
          this.suppliers().map(x => (x.id === restored.id ? { ...x, ...restored } : x)),
        )
        this.loading.set(false)
      },
      error: () => this.loading.set(false),
    })
  }

  goBack(): void {
    this.location.back()
  }

  trackById(_: number, item: Supplier) {
    return item.id
  }

  // Helper para mostrar tipo de proveedor legible
  getSupplierTypeLabel(type: SupplierType): string {
    const labels: Record<SupplierType, string> = {
      [SupplierType.MEDICAMENTOS]: 'Medicamentos',
      [SupplierType.INSUMOS]: 'Insumos',
      [SupplierType.SERVICIOS]: 'Servicios',
    }
    return labels[type] || type
  }
}
