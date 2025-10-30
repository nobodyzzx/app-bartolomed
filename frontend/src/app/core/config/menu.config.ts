import { UserRoles } from '../../modules/dashboard/interfaces/userRoles.enum'

export interface MenuItem {
  label: string
  icon: string
  route: string
  allowedRoles: UserRoles[]
  children?: MenuItem[]
}

export const MENU_ITEMS: MenuItem[] = [
  {
    label: 'Dashboard Principal',
    icon: 'dashboard',
    route: '/dashboard/home',
    allowedRoles: [UserRoles.ADMIN, UserRoles.SUPER_USER, UserRoles.USER],
  },
  {
    label: 'Gestión del Consultorio Médico',
    icon: 'monitor_heart',
    route: '/medical',
    allowedRoles: [UserRoles.ADMIN, UserRoles.SUPER_USER, UserRoles.USER],
    children: [
      {
        label: 'Pacientes',
        icon: 'people',
        route: '/dashboard/patients',
        allowedRoles: [UserRoles.ADMIN, UserRoles.SUPER_USER, UserRoles.USER],
      },
      {
        label: 'Expedientes Médicos',
        icon: 'description',
        route: '/dashboard/medical-records',
        allowedRoles: [UserRoles.ADMIN, UserRoles.SUPER_USER, UserRoles.USER],
      },
      {
        label: 'Calendario de Citas',
        icon: 'calendar_today',
        route: '/dashboard/appointments',
        allowedRoles: [UserRoles.ADMIN, UserRoles.SUPER_USER, UserRoles.USER],
      },
      {
        label: 'Recetas Electrónicas',
        icon: 'receipt',
        route: '/dashboard/prescriptions',
        allowedRoles: [UserRoles.ADMIN, UserRoles.SUPER_USER, UserRoles.USER],
      },
      {
        label: 'Facturación y Pagos',
        icon: 'payment',
        route: '/dashboard/billing',
        allowedRoles: [UserRoles.ADMIN, UserRoles.SUPER_USER],
      },
    ],
  },
  {
    label: 'Control de Farmacia',
    icon: 'medication',
    route: '/pharmacy',
    allowedRoles: [UserRoles.ADMIN, UserRoles.SUPER_USER],
    children: [
      {
        label: 'Inventario',
        icon: 'inventory',
        route: '/dashboard/pharmacy/inventory',
        allowedRoles: [UserRoles.ADMIN, UserRoles.SUPER_USER],
      },
      {
        label: 'Generación de Pedidos',
        icon: 'shopping_cart',
        route: '/dashboard/pharmacy/order-generation',
        allowedRoles: [UserRoles.ADMIN, UserRoles.SUPER_USER],
      },
      {
        label: 'Ventas y Dispensación',
        icon: 'point_of_sale',
        route: '/dashboard/pharmacy/sales-dispensing',
        allowedRoles: [UserRoles.ADMIN, UserRoles.SUPER_USER, UserRoles.USER],
      },
      {
        label: 'Facturación',
        icon: 'receipt_long',
        route: '/dashboard/pharmacy/invoicing',
        allowedRoles: [UserRoles.ADMIN, UserRoles.SUPER_USER],
      },
    ],
  },
  {
    label: 'Reportes',
    icon: 'analytics',
    route: '/reports',
    allowedRoles: [UserRoles.ADMIN, UserRoles.SUPER_USER],
    children: [
      {
        label: 'Informes Médicos',
        icon: 'medical_services',
        route: '/dashboard/reports/medical-reports',
        allowedRoles: [UserRoles.ADMIN, UserRoles.SUPER_USER],
      },
      {
        label: 'Reportes Financieros',
        icon: 'attach_money',
        route: '/dashboard/reports/financial-reports',
        allowedRoles: [UserRoles.ADMIN, UserRoles.SUPER_USER],
      },
      {
        label: 'Control de Stock',
        icon: 'inventory_2',
        route: '/dashboard/reports/stock-control',
        allowedRoles: [UserRoles.ADMIN, UserRoles.SUPER_USER],
      },
    ],
  },
  {
    label: 'Control de Activos',
    icon: 'inventory',
    route: '/assets',
    allowedRoles: [UserRoles.ADMIN, UserRoles.SUPER_USER],
    children: [
      {
        label: 'Registro de Activos',
        icon: 'add_circle',
        route: '/dashboard/assets-control/registration',
        allowedRoles: [UserRoles.ADMIN, UserRoles.SUPER_USER],
      },
      {
        label: 'Mantenimiento de Activos',
        icon: 'build',
        route: '/dashboard/assets-control/maintenance',
        allowedRoles: [UserRoles.ADMIN, UserRoles.SUPER_USER],
      },
      {
        label: 'Control de Inventario de Activos',
        icon: 'inventory_2',
        route: '/dashboard/assets-control/inventory',
        allowedRoles: [UserRoles.ADMIN, UserRoles.SUPER_USER],
      },
      {
        label: 'Reportes de Activos',
        icon: 'assessment',
        route: '/dashboard/assets-control/reports',
        allowedRoles: [UserRoles.ADMIN, UserRoles.SUPER_USER],
      },
    ],
  },
  {
    label: 'Tareas Administrativas',
    icon: 'admin_panel_settings',
    route: '/admin',
    allowedRoles: [UserRoles.ADMIN],
    children: [
      {
        label: 'Gestión de Usuarios',
        icon: 'people_alt',
        route: '/dashboard/users',
        allowedRoles: [UserRoles.ADMIN, UserRoles.SUPER_USER],
      },
      {
        label: 'Lista de Usuarios',
        icon: 'group',
        route: '/dashboard/users/list',
        allowedRoles: [UserRoles.ADMIN],
      },
      {
        label: 'Agregar Usuario',
        icon: 'person_add',
        route: '/dashboard/users/register',
        allowedRoles: [UserRoles.ADMIN],
      },
      {
        label: 'Gestión de Roles',
        icon: 'security',
        route: '/dashboard/roles',
        allowedRoles: [UserRoles.ADMIN, UserRoles.SUPER_USER],
      },
      {
        label: 'Configuración del Sistema',
        icon: 'settings',
        route: '/dashboard/config',
        allowedRoles: [UserRoles.ADMIN],
      },
      {
        label: 'Auditoría y Logs',
        icon: 'history',
        route: '/dashboard/audit',
        allowedRoles: [UserRoles.ADMIN],
      },
      {
        label: 'Respaldos y Restauración',
        icon: 'backup',
        route: '/dashboard/backup',
        allowedRoles: [UserRoles.ADMIN],
      },
      {
        label: 'Gestión de Clínicas',
        icon: 'domain',
        route: '/dashboard/clinics',
        allowedRoles: [UserRoles.ADMIN, UserRoles.SUPER_USER],
        children: [
          {
            label: 'Dashboard de Clínicas',
            icon: 'dashboard',
            route: '/dashboard/clinics',
            allowedRoles: [UserRoles.ADMIN, UserRoles.SUPER_USER],
          },
          {
            label: 'Lista de Clínicas',
            icon: 'list',
            route: '/dashboard/clinics/list',
            allowedRoles: [UserRoles.ADMIN, UserRoles.SUPER_USER],
          },
          {
            label: 'Nueva Clínica',
            icon: 'add_business',
            route: '/dashboard/clinics/new',
            allowedRoles: [UserRoles.ADMIN, UserRoles.SUPER_USER],
          },
        ],
      },
    ],
  },
  {
    label: 'Configuración Avanzada',
    icon: 'tune',
    route: '/advanced',
    allowedRoles: [UserRoles.ADMIN, UserRoles.SUPER_USER],
    children: [
      {
        label: 'Parámetros del Sistema',
        icon: 'settings_applications',
        route: '/dashboard/system-params',
        allowedRoles: [UserRoles.ADMIN, UserRoles.SUPER_USER],
      },
      {
        label: 'Configuración de Notificaciones',
        icon: 'notifications',
        route: '/dashboard/notifications-config',
        allowedRoles: [UserRoles.ADMIN, UserRoles.SUPER_USER],
      },
      {
        label: 'Plantillas de Documentos',
        icon: 'description',
        route: '/dashboard/document-templates',
        allowedRoles: [UserRoles.ADMIN, UserRoles.SUPER_USER],
      },
      {
        label: 'Integración con APIs',
        icon: 'api',
        route: '/dashboard/api-integration',
        allowedRoles: [UserRoles.ADMIN, UserRoles.SUPER_USER],
      },
    ],
  },
]
