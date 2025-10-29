import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AssetMaintenance, MaintenanceStatus, MaintenanceType } from '../interfaces/assets.interfaces';
import { AssetMaintenanceService } from '../services/asset-maintenance.service';

@Component({
  selector: 'app-asset-maintenance',
  templateUrl: './asset-maintenance.component.html',
  styleUrls: ['./asset-maintenance.component.css']
})
export class AssetMaintenanceComponent implements OnInit {
  maintenanceRecords: AssetMaintenance[] = [];
  loading = false;
  maintenanceForm: FormGroup;
  
  maintenanceTypes = Object.values(MaintenanceType);
  maintenanceStatuses = Object.values(MaintenanceStatus);
  
  displayedColumns: string[] = ['assetName', 'type', 'maintenanceDate', 'status', 'cost', 'performedBy', 'actions'];

  constructor(
    private maintenanceService: AssetMaintenanceService,
    private fb: FormBuilder,
    private snackBar: MatSnackBar
  ) {
    this.maintenanceForm = this.fb.group({
      assetId: ['', Validators.required],
      assetName: ['', Validators.required],
      maintenanceDate: ['', Validators.required],
      description: ['', Validators.required],
      type: ['', Validators.required],
      status: [MaintenanceStatus.SCHEDULED, Validators.required],
      cost: [''],
      performedBy: [''],
      notes: ['']
    });
  }

  ngOnInit(): void {
    this.loadMaintenanceRecords();
  }

  loadMaintenanceRecords(): void {
    this.loading = true;
    this.maintenanceService.getMaintenanceRecords().subscribe({
      next: (records) => {
        this.maintenanceRecords = records;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading maintenance records:', error);
        this.snackBar.open('Error al cargar los registros de mantenimiento', 'Cerrar', {
          duration: 3000
        });
        this.loading = false;
      }
    });
  }

  onScheduleMaintenance(): void {
    if (this.maintenanceForm.valid) {
      this.loading = true;
      const maintenanceData = {
        ...this.maintenanceForm.value,
        maintenanceDate: new Date(this.maintenanceForm.value.maintenanceDate)
      };

      this.maintenanceService.createMaintenance(maintenanceData).subscribe({
        next: (newRecord) => {
          this.maintenanceRecords.unshift(newRecord);
          this.maintenanceForm.reset();
          this.maintenanceForm.patchValue({ status: MaintenanceStatus.SCHEDULED });
          this.loading = false;
          this.snackBar.open('Mantenimiento programado exitosamente', 'Cerrar', {
            duration: 3000
          });
        },
        error: (error) => {
          console.error('Error scheduling maintenance:', error);
          this.snackBar.open('Error al programar el mantenimiento', 'Cerrar', {
            duration: 3000
          });
          this.loading = false;
        }
      });
    }
  }

  getStatusColor(status: MaintenanceStatus): string {
    switch (status) {
      case MaintenanceStatus.COMPLETED: return 'primary';
      case MaintenanceStatus.IN_PROGRESS: return 'accent';
      case MaintenanceStatus.SCHEDULED: return 'warn';
      case MaintenanceStatus.CANCELLED: return '';
      case MaintenanceStatus.DELAYED: return 'warn';
      default: return '';
    }
  }

  getTypeIcon(type: MaintenanceType): string {
    switch (type) {
      case MaintenanceType.PREVENTIVE: return 'schedule';
      case MaintenanceType.CORRECTIVE: return 'build';
      case MaintenanceType.EMERGENCY: return 'emergency';
      case MaintenanceType.CALIBRATION: return 'tune';
      case MaintenanceType.INSPECTION: return 'search';
      default: return 'build';
    }
  }

  formatCurrency(amount: number | undefined): string {
    if (amount === undefined) return 'N/A';
    return new Intl.NumberFormat('es-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }
}
