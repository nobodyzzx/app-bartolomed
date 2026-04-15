import { Permission } from '../enums/permission.enum'
import { UserRoles } from '../enums/user-roles.enum'
import { MenuItem } from '../interfaces/menu-item.interface'

export const MENU_ITEMS: MenuItem[] = [
  {
    label: 'Dashboard Principal',
    icon: 'dashboard',
    route: '/dashboard/home',
    allowedRoles: [
      UserRoles.RECEPTIONIST,
      UserRoles.PHARMACIST,
      UserRoles.NURSE,
      UserRoles.DOCTOR,
      UserRoles.ADMIN,
      UserRoles.SUPER_ADMIN,
    ],
  },
  {
    label: 'Gestión del Consultorio Médico',
    icon: 'monitor_heart',
    route: '/medical', // Ruta padre, puede no usarse si todos los hijos tienen rutas
    allowedRoles: [
      UserRoles.RECEPTIONIST,
      UserRoles.NURSE,
      UserRoles.DOCTOR,
      UserRoles.PHARMACIST,
      UserRoles.ADMIN,
      UserRoles.SUPER_ADMIN,
    ],
    children: [
      {
        label: 'Pacientes',
        icon: 'people',
        route: '/dashboard/patients',
        allowedRoles: [
          UserRoles.RECEPTIONIST,
          UserRoles.NURSE,
          UserRoles.DOCTOR,
          UserRoles.ADMIN,
          UserRoles.SUPER_ADMIN,
        ],
        requiredPermissions: [Permission.PatientsRead],
      },
      {
        label: 'Expedientes Médicos',
        icon: 'description',
        route: '/dashboard/medical-records',
        allowedRoles: [UserRoles.DOCTOR, UserRoles.NURSE, UserRoles.ADMIN, UserRoles.SUPER_ADMIN],
        requiredPermissions: [Permission.RecordsRead],
      },
      {
        label: 'Calendario de Citas',
        icon: 'calendar_today',
        route: '/dashboard/appointments',
        allowedRoles: [
          UserRoles.RECEPTIONIST,
          UserRoles.DOCTOR,
          UserRoles.NURSE,
          UserRoles.ADMIN,
          UserRoles.SUPER_ADMIN,
        ],
        requiredPermissions: [Permission.AppointmentsRead],
      },
      {
        label: 'Recetas Electrónicas',
        icon: 'receipt',
        route: '/dashboard/prescriptions',
        allowedRoles: [
          UserRoles.DOCTOR,
          UserRoles.PHARMACIST,
          UserRoles.ADMIN,
          UserRoles.SUPER_ADMIN,
        ],
        requiredPermissions: [Permission.PrescriptionsRead],
      },
      {
        label: 'Facturación y Pagos',
        icon: 'payment',
        route: '/dashboard/billing',
        allowedRoles: [UserRoles.RECEPTIONIST, UserRoles.ADMIN, UserRoles.SUPER_ADMIN],
        requiredPermissions: [Permission.BillingRead],
      },
    ],
  },
  {
    label: 'Control de Farmacia',
    icon: 'medication',
    route: '/pharmacy',
    allowedRoles: [UserRoles.PHARMACIST, UserRoles.ADMIN, UserRoles.SUPER_ADMIN],
    children: [
      {
        label: 'Catálogo de Medicamentos',
        icon: 'medication',
        route: '/dashboard/pharmacy/medications',
        allowedRoles: [UserRoles.PHARMACIST, UserRoles.ADMIN, UserRoles.SUPER_ADMIN],
        requiredPermissions: [Permission.PharmacyInventoryManage],
      },
      {
        label: 'Inventario',
        icon: 'inventory',
        route: '/dashboard/pharmacy/inventory',
        allowedRoles: [UserRoles.PHARMACIST, UserRoles.ADMIN, UserRoles.SUPER_ADMIN],
        requiredPermissions: [Permission.PharmacyInventoryManage],
      },
      {
        label: 'Proveedores',
        icon: 'local_shipping',
        route: '/dashboard/pharmacy/suppliers',
        allowedRoles: [UserRoles.PHARMACIST, UserRoles.ADMIN, UserRoles.SUPER_ADMIN],
        requiredPermissions: [Permission.PharmacyInventoryManage],
      },
      {
        label: 'Órdenes de Compra',
        icon: 'shopping_cart',
        route: '/dashboard/pharmacy/purchase-orders',
        allowedRoles: [UserRoles.PHARMACIST, UserRoles.ADMIN, UserRoles.SUPER_ADMIN],
        requiredPermissions: [Permission.PharmacyInventoryManage],
      },
      {
        label: 'Ventas y Dispensación',
        icon: 'point_of_sale',
        route: '/dashboard/pharmacy/sales-dispensing',
        allowedRoles: [UserRoles.PHARMACIST, UserRoles.ADMIN, UserRoles.SUPER_ADMIN],
        requiredPermissions: [Permission.PharmacyDispense],
      },
      {
        label: 'Facturación',
        icon: 'receipt_long',
        route: '/dashboard/pharmacy/invoicing',
        allowedRoles: [UserRoles.PHARMACIST, UserRoles.ADMIN, UserRoles.SUPER_ADMIN],
        requiredPermissions: [Permission.PharmacyBilling],
      },
    ],
  },
  {
    label: 'Control de Activos',
    icon: 'warehouse',
    route: '/assets',
    allowedRoles: [UserRoles.ADMIN, UserRoles.SUPER_ADMIN],
    children: [
      {
        label: 'Inventario de Activos',
        icon: 'inventory_2',
        route: '/dashboard/assets-control/inventory',
        allowedRoles: [UserRoles.ADMIN, UserRoles.SUPER_ADMIN],
        requiredPermissions: [Permission.AssetsManage],
      },
      {
        label: 'Mantenimiento',
        icon: 'build',
        route: '/dashboard/assets-control/maintenance',
        allowedRoles: [UserRoles.ADMIN, UserRoles.SUPER_ADMIN],
        requiredPermissions: [Permission.AssetsManage],
      },
    ],
  },
  {
    label: 'Reportes',
    icon: 'analytics',
    route: '/dashboard/reports',
    allowedRoles: [UserRoles.DOCTOR, UserRoles.PHARMACIST, UserRoles.ADMIN, UserRoles.SUPER_ADMIN],
    requiredPermissions: [Permission.ReportsMedical],
  },

  {
    label: 'Tareas Administrativas',
    icon: 'admin_panel_settings',
    route: '/admin',
    allowedRoles: [UserRoles.ADMIN, UserRoles.SUPER_ADMIN],
    children: [
      {
        label: 'Gestión de Usuarios',
        icon: 'people_alt',
        route: '/dashboard/users',
        allowedRoles: [UserRoles.ADMIN, UserRoles.SUPER_ADMIN],
        requiredPermissions: [Permission.UsersManage],
      },
      {
        label: 'Gestión de Roles',
        icon: 'security',
        route: '/dashboard/roles',
        allowedRoles: [UserRoles.SUPER_ADMIN], // Solo SUPER_ADMIN
        requiredPermissions: [Permission.RolesManage],
      },
      {
        label: 'Auditoría y Logs',
        icon: 'history',
        route: '/dashboard/audit',
        allowedRoles: [UserRoles.ADMIN, UserRoles.SUPER_ADMIN],
        requiredPermissions: [Permission.AuditRead],
      },
      {
        label: 'Gestión de Clínicas',
        icon: 'domain',
        route: '/dashboard/clinics',
        allowedRoles: [UserRoles.SUPER_ADMIN], // Solo SUPER_ADMIN
        requiredPermissions: [Permission.ClinicsManage],
      },
    ],
  },
]
