import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AssetFilters, AssetStatus, BaseAsset, CreateAssetDto } from '../interfaces/assets.interfaces';
import { AssetRegistrationService } from '../services/asset-registration.service';

@Component({
  selector: 'app-asset-registration',
  templateUrl: './asset-registration.component.html',
  styleUrls: ['./asset-registration.component.css']
})
export class AssetRegistrationComponent implements OnInit {
  assets: BaseAsset[] = [];
  loading = false;
  registrationForm: FormGroup;
  filterForm: FormGroup;
  showFilters = false;
  
  assetTypes: string[] = [];
  manufacturers: string[] = [];
  locations: string[] = [];
  assetStatuses = Object.values(AssetStatus);
  
  displayedColumns: string[] = ['name', 'type', 'manufacturer', 'purchaseDate', 'status', 'location', 'actions'];

  constructor(
    private assetService: AssetRegistrationService,
    private fb: FormBuilder,
    private snackBar: MatSnackBar
  ) {
    this.registrationForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      type: ['', Validators.required],
      manufacturer: ['', Validators.required],
      model: [''],
      serialNumber: ['', Validators.required],
      purchaseDate: ['', Validators.required],
      purchasePrice: ['', [Validators.min(0)]],
      warrantyExpiration: [''],
      status: [AssetStatus.ACTIVE, Validators.required],
      location: [''],
      description: [''],
      supplier: [''],
      invoiceNumber: [''],
      notes: ['']
    });

    this.filterForm = this.fb.group({
      status: [''],
      type: [''],
      location: [''],
      manufacturer: ['']
    });
  }

  ngOnInit(): void {
    this.loadAssets();
    this.loadFilterOptions();
  }

  loadAssets(filters?: AssetFilters): void {
    this.loading = true;
    this.assetService.getAssets(filters).subscribe({
      next: (assets) => {
        this.assets = assets;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading assets:', error);
        this.snackBar.open('Error al cargar los activos', 'Cerrar', {
          duration: 3000
        });
        this.loading = false;
      }
    });
  }

  loadFilterOptions(): void {
    // Cargar tipos de activos
    this.assetService.getAssetTypes().subscribe(types => {
      this.assetTypes = types;
    });

    // Cargar fabricantes
    this.assetService.getManufacturers().subscribe(manufacturers => {
      this.manufacturers = manufacturers;
    });

    // Cargar ubicaciones
    this.assetService.getLocations().subscribe(locations => {
      this.locations = locations;
    });
  }

  onRegisterAsset(): void {
    if (this.registrationForm.valid) {
      this.loading = true;
      const formValue = this.registrationForm.value;
      
      // Validar número de serie único
      this.assetService.validateSerialNumber(formValue.serialNumber).subscribe({
        next: (isValid) => {
          if (!isValid) {
            this.snackBar.open('El número de serie ya existe', 'Cerrar', {
              duration: 3000
            });
            this.loading = false;
            return;
          }

          const assetData: CreateAssetDto = {
            ...formValue,
            purchaseDate: new Date(formValue.purchaseDate),
            warrantyExpiration: formValue.warrantyExpiration ? new Date(formValue.warrantyExpiration) : undefined
          };

          this.assetService.createAsset(assetData).subscribe({
            next: (newAsset) => {
              this.assets.unshift(newAsset);
              this.registrationForm.reset();
              this.registrationForm.patchValue({ status: AssetStatus.ACTIVE });
              this.loading = false;
              this.snackBar.open('Activo registrado exitosamente', 'Cerrar', {
                duration: 3000
              });
            },
            error: (error) => {
              console.error('Error registering asset:', error);
              this.snackBar.open('Error al registrar el activo', 'Cerrar', {
                duration: 3000
              });
              this.loading = false;
            }
          });
        },
        error: (error) => {
          console.error('Error validating serial number:', error);
          this.loading = false;
        }
      });
    }
  }

  onApplyFilters(): void {
    const filters: AssetFilters = {};
    const filterValue = this.filterForm.value;

    if (filterValue.status) filters.status = filterValue.status;
    if (filterValue.type) filters.type = filterValue.type;
    if (filterValue.location) filters.location = filterValue.location;
    if (filterValue.manufacturer) filters.manufacturer = filterValue.manufacturer;

    this.loadAssets(filters);
  }

  onClearFilters(): void {
    this.filterForm.reset();
    this.loadAssets();
  }

  toggleFilters(): void {
    this.showFilters = !this.showFilters;
  }

  editAsset(asset: BaseAsset): void {
    // Implementar lógica de edición
    this.snackBar.open('Función de edición en desarrollo', 'Cerrar', {
      duration: 2000
    });
  }

  deleteAsset(asset: BaseAsset): void {
    if (confirm(`¿Está seguro de que desea eliminar el activo "${asset.name}"?`)) {
      this.assetService.deleteAsset(asset.id).subscribe({
        next: (success) => {
          if (success) {
            this.assets = this.assets.filter(a => a.id !== asset.id);
            this.snackBar.open('Activo eliminado exitosamente', 'Cerrar', {
              duration: 3000
            });
          }
        },
        error: (error) => {
          console.error('Error deleting asset:', error);
          this.snackBar.open('Error al eliminar el activo', 'Cerrar', {
            duration: 3000
          });
        }
      });
    }
  }

  getStatusColor(status: AssetStatus): string {
    switch (status) {
      case AssetStatus.ACTIVE: return 'primary';
      case AssetStatus.MAINTENANCE: return 'warn';
      case AssetStatus.INACTIVE: return 'accent';
      case AssetStatus.RETIRED: return '';
      case AssetStatus.DISPOSED: return '';
      default: return '';
    }
  }

  getStatusText(status: AssetStatus): string {
    return status;
  }

  formatCurrency(amount: number | undefined): string {
    if (amount === undefined) return 'N/A';
    return new Intl.NumberFormat('es-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }
}
