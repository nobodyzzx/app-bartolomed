import { Component, OnInit } from '@angular/core';
import { AssetCondition, AssetInventory, AssetStatus } from '../interfaces/assets.interfaces';
import { AssetInventoryControlService } from '../services/asset-inventory-control.service';

@Component({
  selector: 'app-asset-inventory-control',
  templateUrl: './asset-inventory-control.component.html',
  styleUrls: ['./asset-inventory-control.component.css']
})
export class AssetInventoryControlComponent implements OnInit {
  inventory: AssetInventory[] = [];
  loading = false;
  stats: any = {};
  
  displayedColumns: string[] = ['assetName', 'location', 'quantity', 'condition', 'status', 'lastInspection', 'actions'];

  constructor(private inventoryService: AssetInventoryControlService) {}

  ngOnInit(): void {
    this.loadInventory();
    this.loadStats();
  }

  loadInventory(): void {
    this.loading = true;
    this.inventoryService.getInventory().subscribe({
      next: (inventory) => {
        this.inventory = inventory;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading inventory:', error);
        this.loading = false;
      }
    });
  }

  loadStats(): void {
    this.inventoryService.getInventoryStats().subscribe({
      next: (stats) => {
        this.stats = stats;
      },
      error: (error) => {
        console.error('Error loading stats:', error);
      }
    });
  }

  getConditionColor(condition: AssetCondition): string {
    switch (condition) {
      case AssetCondition.EXCELLENT: return 'primary';
      case AssetCondition.GOOD: return 'accent';
      case AssetCondition.FAIR: return 'warn';
      case AssetCondition.POOR: return 'warn';
      case AssetCondition.CRITICAL: return 'warn';
      default: return '';
    }
  }

  getStatusColor(status: AssetStatus): string {
    switch (status) {
      case AssetStatus.ACTIVE: return 'primary';
      case AssetStatus.MAINTENANCE: return 'warn';
      case AssetStatus.INACTIVE: return 'accent';
      case AssetStatus.RETIRED: return '';
      default: return '';
    }
  }
}
