import { Location } from '@angular/common'
import { Component, OnInit, ViewChild } from '@angular/core'
import { MatPaginator } from '@angular/material/paginator'
import { MatSort } from '@angular/material/sort'
import { MatTableDataSource } from '@angular/material/table'
import { Product } from '../interfaces/pharmacy.interfaces'
import { InventoryService } from '../services/inventory.service'

@Component({
  selector: 'app-inventory',
  templateUrl: './inventory.component.html',
  styleUrls: ['./inventory.component.css'],
})
export class InventoryComponent implements OnInit {
  @ViewChild(MatPaginator) paginator!: MatPaginator
  @ViewChild(MatSort) sort!: MatSort

  displayedColumns: string[] = [
    'id',
    'name',
    'brand',
    'stock',
    'price',
    'expirationDate',
    'location',
    'actions',
  ]
  dataSource = new MatTableDataSource<Product>()

  products: Product[] = []
  lowStockProducts: Product[] = []
  expiringProducts: Product[] = []
  searchTerm: string = ''

  stats = {
    totalProducts: 0,
    lowStock: 0,
    expiring: 0,
    totalValue: 0,
  }

  constructor(
    private inventoryService: InventoryService,
    private location: Location,
  ) {}

  ngOnInit(): void {
    this.loadProducts()
    this.loadLowStockProducts()
    this.loadExpiringProducts()
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator
    this.dataSource.sort = this.sort
  }

  goBack(): void {
    this.location.back()
  }

  loadProducts(): void {
    this.inventoryService.getProducts().subscribe(products => {
      this.products = products
      this.dataSource.data = products
      this.calculateStats()
    })
  }

  loadLowStockProducts(): void {
    this.inventoryService.getLowStockProducts().subscribe(products => {
      this.lowStockProducts = products
    })
  }

  loadExpiringProducts(): void {
    this.inventoryService.getExpiringProducts().subscribe(products => {
      this.expiringProducts = products
    })
  }

  calculateStats(): void {
    this.stats.totalProducts = this.products.length
    this.stats.lowStock = this.lowStockProducts.length
    this.stats.expiring = this.expiringProducts.length
    this.stats.totalValue = this.products.reduce(
      (sum, product) => sum + product.stock * product.price,
      0,
    )
  }

  applyFilter(event: Event): void {
    const filterValue = (event.target as HTMLInputElement).value
    this.dataSource.filter = filterValue.trim().toLowerCase()

    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage()
    }
  }

  applyFilterManual(): void {
    this.dataSource.filter = this.searchTerm.trim().toLowerCase()

    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage()
    }
  }

  isLowStock(product: Product): boolean {
    return product.stock <= (product.minStock || 0)
  }

  isExpiring(product: Product): boolean {
    const today = new Date()
    const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)
    const expirationDate = new Date(product.expirationDate)
    return expirationDate <= thirtyDaysFromNow
  }

  editProduct(product: Product): void {
    // TODO: Implementar edición de producto
    console.log('Editar producto:', product)
  }

  deleteProduct(product: Product): void {
    // TODO: Implementar eliminación de producto
    console.log('Eliminar producto:', product)
  }

  addProduct(): void {
    // TODO: Implementar agregar producto
    console.log('Agregar nuevo producto')
  }
}
