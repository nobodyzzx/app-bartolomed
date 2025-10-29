import { Component } from '@angular/core';

@Component({
  selector: 'app-assets-control',
  templateUrl: './assets-control.component.html',
  styleUrls: ['./assets-control.component.css']
})
export class AssetsControlComponent {
  
  tabs = [
    {
      label: 'Registro',
      route: 'registration',
      icon: 'add_circle'
    },
    {
      label: 'Mantenimiento',
      route: 'maintenance',
      icon: 'build'
    },
    {
      label: 'Inventario',
      route: 'inventory',
      icon: 'inventory'
    },
    {
      label: 'Reportes',
      route: 'reports',
      icon: 'assessment'
    }
  ];

  constructor() { }

}
