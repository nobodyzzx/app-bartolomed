import { UserRoles } from '../../modules/dashboard/interfaces/userRoles.enum';

export interface MenuItem {
  label: string;
  icon: string;
  route: string;
  allowedRoles: UserRoles[];
  children?: MenuItem[];
}

export const MENU_ITEMS: MenuItem[] = [
  {
    label: 'Gestión del Consultorio Médico',
    icon: 'monitor_heart',
    route: '/medical',
    allowedRoles: [UserRoles.ADMIN, UserRoles.SUPER_USER, UserRoles.USER],
    children: [
      {
        label: 'Pacientes',
        icon: 'people',
        route: '/pacientes',
        allowedRoles: [UserRoles.ADMIN, UserRoles.SUPER_USER, UserRoles.USER],
      },
      {
        label: 'Expedientes Médicos',
        icon: 'description',
        route: '/expedientes',
        allowedRoles: [UserRoles.ADMIN, UserRoles.SUPER_USER, UserRoles.USER],
      },
      {
        label: 'Calendario de Citas',
        icon: 'calendar_today',
        route: '/citas',
        allowedRoles: [UserRoles.ADMIN, UserRoles.SUPER_USER, UserRoles.USER],
      },
      {
        label: 'Recetas Electrónicas',
        icon: 'receipt',
        route: '/recetas',
        allowedRoles: [UserRoles.ADMIN, UserRoles.SUPER_USER, UserRoles.USER],
      },
      {
        label: 'Facturación y Pagos',
        icon: 'payment',
        route: '/facturacion',
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
        route: '/inventario',
        allowedRoles: [UserRoles.ADMIN, UserRoles.SUPER_USER],
      },
      {
        label: 'Generación de Pedidos',
        icon: 'shopping_cart',
        route: '/pedidos',
        allowedRoles: [UserRoles.ADMIN, UserRoles.SUPER_USER],
      },
      {
        label: 'Ventas y Dispensación',
        icon: 'point_of_sale',
        route: '/ventas',
        allowedRoles: [UserRoles.ADMIN, UserRoles.SUPER_USER, UserRoles.USER],
      },
      {
        label: 'Facturación',
        icon: 'receipt_long',
        route: '/facturacion-farmacia',
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
        route: '/informes-medicos',
        allowedRoles: [UserRoles.ADMIN, UserRoles.SUPER_USER],
      },
      {
        label: 'Reportes Financieros',
        icon: 'attach_money',
        route: '/reportes-financieros',
        allowedRoles: [UserRoles.SUPER_USER],
      },
      {
        label: 'Control de Stock',
        icon: 'inventory_2',
        route: '/control-stock',
        allowedRoles: [UserRoles.ADMIN, UserRoles.SUPER_USER],
      },
    ],
  },
  {
    label: 'Control de Activos',
    icon: 'inventory',
    route: '/assets',
    allowedRoles: [UserRoles.SUPER_USER],
    children: [
      {
        label: 'Registro de Activos',
        icon: 'add_box',
        route: '/registro-activos',
        allowedRoles: [UserRoles.SUPER_USER],
      },
      {
        label: 'Mantenimiento de Activos',
        icon: 'build',
        route: '/mantenimiento-activos',
        allowedRoles: [UserRoles.SUPER_USER],
      },
      {
        label: 'Control de Inventario de Activos',
        icon: 'inventory_2',
        route: '/inventario-activos',
        allowedRoles: [UserRoles.SUPER_USER],
      },
      {
        label: 'Reportes de Activos',
        icon: 'description',
        route: '/reportes-activos',
        allowedRoles: [UserRoles.SUPER_USER],
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
        label: 'Agregar Usuario',
        icon: 'person_add',
        route: '/dashboard/users/register',
        allowedRoles: [UserRoles.ADMIN],
      },
      {
        label: 'Cambiar Roles',
        icon: 'manage_accounts',
        route: '/roles',
        allowedRoles: [UserRoles.ADMIN],
      },
    ],
  },
];
