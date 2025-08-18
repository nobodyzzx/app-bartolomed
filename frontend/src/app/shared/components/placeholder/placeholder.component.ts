import { Component } from '@angular/core'
import { ActivatedRoute } from '@angular/router'

@Component({
  selector: 'app-placeholder',
  template: `
    <div class="placeholder-container">
      <div class="placeholder-content">
        <!-- Encabezado -->
        <div class="text-center mb-12">
          <mat-icon class="text-6xl text-blue-600 mb-4">{{ getIcon() }}</mat-icon>
          <h1 class="text-4xl font-bold text-blue-900 mb-4">{{ getTitle() }}</h1>
          <div class="w-24 h-1 bg-blue-600 mx-auto rounded-full mb-4"></div>
          <p class="text-lg text-blue-600">{{ getDescription() }}</p>
        </div>

        <!-- Contenido principal -->
        <div class="bg-white p-8 rounded-2xl shadow-lg border border-blue-100 text-center">
          <mat-icon class="text-8xl text-gray-300 mb-6">construction</mat-icon>
          <h2 class="text-2xl font-bold text-gray-700 mb-4">Módulo en Desarrollo</h2>
          <p class="text-gray-600 mb-8">Esta funcionalidad está siendo desarrollada y estará disponible próximamente.</p>
          
          <div class="flex justify-center gap-4">
            <button mat-raised-button color="primary" routerLink="/dashboard">
              <mat-icon>home</mat-icon>
              Volver al Dashboard
            </button>
            <button mat-raised-button color="accent" routerLink="/dashboard/users">
              <mat-icon>group</mat-icon>
              Gestión de Usuarios
            </button>
          </div>
        </div>

        <!-- Información adicional -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
          <div class="bg-blue-50 p-6 rounded-xl text-center">
            <mat-icon class="text-3xl text-blue-600 mb-3">timeline</mat-icon>
            <h3 class="font-bold text-blue-900 mb-2">En Progreso</h3>
            <p class="text-blue-600 text-sm">Funcionalidad en desarrollo activo</p>
          </div>
          
          <div class="bg-green-50 p-6 rounded-xl text-center">
            <mat-icon class="text-3xl text-green-600 mb-3">security</mat-icon>
            <h3 class="font-bold text-green-900 mb-2">Seguro</h3>
            <p class="text-green-600 text-sm">Acceso autorizado para administradores</p>
          </div>
          
          <div class="bg-purple-50 p-6 rounded-xl text-center">
            <mat-icon class="text-3xl text-purple-600 mb-3">update</mat-icon>
            <h3 class="font-bold text-purple-900 mb-2">Próximamente</h3>
            <p class="text-purple-600 text-sm">Disponible en futuras actualizaciones</p>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .placeholder-container {
      min-height: 100vh;
      background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
      padding: 2rem;
    }

    .placeholder-content {
      max-width: 1000px;
      margin: 0 auto;
    }

    @media (max-width: 768px) {
      .placeholder-container {
        padding: 1rem;
      }
    }
  `]
})
export class PlaceholderComponent {
  constructor(private route: ActivatedRoute) {}

  getTitle(): string {
    const path = this.route.snapshot.url.join('/')
    const titles: { [key: string]: string } = {
      // Gestión médica
      'medical-records': 'Expedientes Médicos',
      'appointments': 'Calendario de Citas',
      'prescriptions': 'Recetas Electrónicas',
      'billing': 'Facturación y Pagos',
      
      // Farmacia
      'pharmacy-inventory': 'Inventario de Farmacia',
      'pharmacy-orders': 'Generación de Pedidos',
      'pharmacy-sales': 'Ventas y Dispensación',
      'pharmacy-billing': 'Facturación de Farmacia',
      
      // Reportes
      'medical-reports': 'Informes Médicos',
      'financial-reports': 'Reportes Financieros',
      'stock-control': 'Control de Stock',
      
      // Activos
      'asset-registry': 'Registro de Activos',
      'asset-maintenance': 'Mantenimiento de Activos',
      'asset-inventory': 'Control de Inventario de Activos',
      'asset-reports': 'Reportes de Activos',
      
      // Administración
      'config': 'Configuración del Sistema',
      'audit': 'Auditoría y Logs',
      'backup': 'Respaldos y Restauración',
      'clinics': 'Gestión de Clínicas',
      'system-params': 'Parámetros del Sistema',
      'notifications-config': 'Configuración de Notificaciones',
      'document-templates': 'Plantillas de Documentos',
      'api-integration': 'Integración con APIs',
      'roles': 'Gestión de Roles'
    }
    
    for (const [key, title] of Object.entries(titles)) {
      if (path.includes(key)) {
        return title
      }
    }
    
    return 'Funcionalidad del Sistema'
  }

  getDescription(): string {
    return `Acceso autorizado como administrador para ${this.getTitle().toLowerCase()}`
  }

  getIcon(): string {
    const path = this.route.snapshot.url.join('/')
    const icons: { [key: string]: string } = {
      // Gestión médica
      'medical-records': 'description',
      'appointments': 'calendar_today',
      'prescriptions': 'receipt',
      'billing': 'payment',
      
      // Farmacia
      'pharmacy-inventory': 'inventory',
      'pharmacy-orders': 'shopping_cart',
      'pharmacy-sales': 'point_of_sale',
      'pharmacy-billing': 'receipt_long',
      
      // Reportes
      'medical-reports': 'medical_services',
      'financial-reports': 'attach_money',
      'stock-control': 'inventory_2',
      
      // Activos
      'asset-registry': 'add_box',
      'asset-maintenance': 'build',
      'asset-inventory': 'inventory_2',
      'asset-reports': 'description',
      
      // Administración
      'config': 'settings',
      'audit': 'history',
      'backup': 'backup',
      'clinics': 'domain',
      'system-params': 'settings_applications',
      'notifications-config': 'notifications',
      'document-templates': 'description',
      'api-integration': 'api',
      'roles': 'manage_accounts'
    }
    
    for (const [key, icon] of Object.entries(icons)) {
      if (path.includes(key)) {
        return icon
      }
    }
    
    return 'settings'
  }
}
