import { Location } from '@angular/common'
import { Component, OnDestroy, OnInit, signal } from '@angular/core'
import { Router } from '@angular/router'
import { AlertService } from '@core/services/alert.service'
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs'
import { ClinicContextService } from '../../../../clinics/services/clinic-context.service'
import { MedicationStock } from '../interfaces/pharmacy.interfaces'
import { InventoryService } from '../services/inventory.service'

@Component({
  selector: 'app-inventory',
  templateUrl: './inventory.component.html',
  styleUrls: ['./inventory.component.css'],
})
export class InventoryComponent implements OnInit, OnDestroy {
  products: MedicationStock[] = []
  lowStockProducts: MedicationStock[] = []
  expiringProducts: MedicationStock[] = []
  searchTermRaw: string = ''
  searchTerm: string = ''
  clinicId: string | null = null
  loading = signal<boolean>(false)

  private destroy$ = new Subject<void>()
  private searchInput$ = new Subject<string>()

  stats = {
    totalProducts: 0,
    lowStock: 0,
    expiring: 0,
    totalValue: 0,
  }

  statFilter = signal<'all' | 'low' | 'expiring'>('all')

  setStatFilter(filter: 'all' | 'low' | 'expiring'): void {
    this.statFilter.set(filter)
  }

  importOpen = signal(false)
  importLoading = signal(false)
  importHeaders: string[] = []
  importRows: any[] = []
  importFileName = signal('')

  constructor(
    private inventoryService: InventoryService,
    private location: Location,
    private clinicContext: ClinicContextService,
    private alertService: AlertService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.clinicId = this.clinicContext.clinicId
    if (!this.clinicId) {
      this.alertService.error(
        'Contexto de clínica',
        'Seleccione una clínica para ver el inventario',
      )
      return
    }
    this.reloadAll()
    this.searchInput$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(value => {
        this.searchTerm = (value || '').trim()
      })
  }

  ngOnDestroy(): void {
    this.destroy$.next()
    this.destroy$.complete()
  }

  reloadAll(): void {
    this.loading.set(true)
    this.loadProducts()
    this.loadLowStockProducts()
    this.loadExpiringProducts()
  }

  goBack(): void {
    this.location.back()
  }

  goToMedications(): void {
    this.router.navigate(['/dashboard/pharmacy/medications'])
  }

  loadProducts(): void {
    if (!this.clinicId) return
    this.inventoryService.getProducts(this.clinicId).subscribe({
      next: result => {
        this.products = result.data
        this.calculateStats()
        this.loading.set(false)
      },
      error: () => this.loading.set(false),
    })
  }

  loadLowStockProducts(): void {
    if (!this.clinicId) return
    this.inventoryService.getLowStockProducts(this.clinicId).subscribe(products => {
      this.lowStockProducts = products
      this.calculateStats()
    })
  }

  loadExpiringProducts(): void {
    if (!this.clinicId) return
    this.inventoryService.getExpiringProducts(this.clinicId, 30).subscribe(products => {
      this.expiringProducts = products
      this.calculateStats()
    })
  }

  calculateStats(): void {
    this.stats.totalProducts = this.products.length
    this.stats.lowStock = this.lowStockProducts.length
    this.stats.expiring = this.expiringProducts.length
    this.stats.totalValue = this.products.reduce(
      (sum, product) => sum + product.quantity * product.sellingPrice,
      0,
    )
  }

  applyFilterManual(): void {
    this.searchInput$.next(this.searchTermRaw)
  }

  isLowStock(product: MedicationStock): boolean {
    return product.quantity <= (product.minimumStock || 0)
  }

  isExpiring(product: MedicationStock): boolean {
    const today = new Date()
    const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)
    const expirationDate = new Date(product.expiryDate)
    return expirationDate <= thirtyDaysFromNow
  }

  createMedication(): void {
    this.router.navigate(['/dashboard/pharmacy/inventory/medication/new'])
  }

  addProduct(): void {
    this.router.navigate(['/dashboard/pharmacy/inventory/stock/new'])
  }

  editProduct(product: MedicationStock): void {
    this.router.navigate(['/dashboard/pharmacy/inventory/stock/edit', product.id])
  }

  deleteProduct(product: MedicationStock): void {
    this.alertService
      .confirm({ title: 'Eliminar stock', text: '¿Desea eliminar este registro?' })
      .then(result => {
        if (result.isConfirmed) {
          this.inventoryService.deleteProduct(product.id).subscribe({
            next: success => {
              if (success) {
                this.products = this.products.filter(p => p.id !== product.id)
                this.lowStockProducts = this.lowStockProducts.filter(p => p.id !== product.id)
                this.expiringProducts = this.expiringProducts.filter(p => p.id !== product.id)
                this.calculateStats()
              }
            },
          })
        }
      })
  }

  openImportModal() {
    this.resetImport()
    this.importOpen.set(true)
  }

  resetImport() {
    this.importHeaders = []
    this.importRows = []
    this.importFileName.set('')
  }

  async onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return
    this.importFileName.set(file.name)
    this.importLoading.set(true)
    try {
      const ext = file.name.toLowerCase()
      if (ext.endsWith('.csv')) {
        const text = await file.text()
        this.parseCSV(text)
      } else {
        this.alertService.error('Archivo no soportado', 'Seleccione un .csv')
      }
    } catch (e) {
      this.alertService.error('Error', 'No se pudo leer el archivo')
    } finally {
      this.importLoading.set(false)
    }
  }

  private parseCSV(text: string) {
    const lines = text.split(/\r?\n/).filter(l => l.trim().length)
    if (lines.length === 0) return
    const sep = lines[0].includes(';') ? ';' : ','
    const headers = lines[0].split(sep).map(h => h.trim())
    const rows = lines.slice(1).map(line => {
      const cols = line.split(sep)
      const obj: any = {}
      headers.forEach((h, i) => (obj[h] = (cols[i] ?? '').trim()))
      return obj
    })
    this.importHeaders = headers
    this.importRows = rows
  }

  confirmImportPreview() {
    if (!this.importRows.length) {
      this.alertService.error('Validación', 'Carga un archivo con datos primero')
      return
    }
    this.alertService.fire({
      icon: 'success',
      title: 'Archivo cargado',
      text: 'Vista previa lista',
    })
    this.importOpen.set(false)
  }

  get filteredProducts(): MedicationStock[] {
    const term = (this.searchTerm || '').toLowerCase()
    let base = this.products
    if (this.statFilter() === 'low') base = this.lowStockProducts
    else if (this.statFilter() === 'expiring') base = this.expiringProducts
    const rows = !term
      ? base
      : base.filter(p =>
          [p.medication?.name, p.medication?.brandName, p.batchNumber, p.location]
            .filter(Boolean)
            .some(v => String(v).toLowerCase().includes(term)),
        )
    return [...rows].sort((a, b) => {
      const lowA = this.isLowStock(a) ? 1 : 0
      const lowB = this.isLowStock(b) ? 1 : 0
      if (lowA !== lowB) return lowB - lowA
      const nameA = a.medication?.name || ''
      const nameB = b.medication?.name || ''
      return nameA.localeCompare(nameB)
    })
  }

  trackById(_: number, item: MedicationStock) {
    return item.id
  }

  productStatus(product: MedicationStock): { label: string; classes: string; dot: string } {
    const low = this.isLowStock(product)
    const exp = this.isExpiring(product)
    if (low && exp) {
      return {
        label: 'Stock bajo y por vencer',
        classes: 'bg-red-50 text-red-700 border-red-200',
        dot: 'bg-red-500',
      }
    }
    if (low) {
      return {
        label: 'Stock bajo',
        classes: 'bg-orange-50 text-orange-700 border-orange-200',
        dot: 'bg-orange-500',
      }
    }
    if (exp) {
      return {
        label: 'Por vencer',
        classes: 'bg-amber-50 text-amber-700 border-amber-200',
        dot: 'bg-amber-500',
      }
    }
    return {
      label: 'OK',
      classes: 'bg-green-50 text-green-700 border-green-200',
      dot: 'bg-green-500',
    }
  }
}
