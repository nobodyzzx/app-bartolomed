import { Permission } from '../enums/permission.enum'
import { UserRoles } from '../enums/user-roles.enum'
import { MenuItem } from '../interfaces/menu-item.interface'

export const MENU_ITEMS: MenuItem[] = [
  {
    label: 'Dashboard Principal',
    icon: 'dashboard',
    route: '/dashboard/home',
    // Todos los roles: el dashboard decide por dentro qué mostrarle a cada uno.
    allowedRoles: [
      UserRoles.RECEPTIONIST,
      UserRoles.PHARMACIST,
      UserRoles.NURSE,
      UserRoles.DOCTOR,
      UserRoles.LABORATORY,
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
    ],
  },
  {
    // El dinero va aparte de lo clínico: el tarifario y la caja no son
    // "consultorio médico", y mezclarlos dejaba ese grupo con siete entradas
    // de dos mundos distintos.
    label: 'Caja y Facturación',
    icon: 'point_of_sale',
    route: '/billing',
    allowedRoles: [UserRoles.RECEPTIONIST, UserRoles.ADMIN, UserRoles.SUPER_ADMIN],
    children: [
      {
        label: 'Punto de Cobro',
        icon: 'point_of_sale',
        route: '/dashboard/checkout',
        allowedRoles: [UserRoles.RECEPTIONIST, UserRoles.ADMIN, UserRoles.SUPER_ADMIN],
        requiredPermissions: [Permission.BillingManage],
      },
      {
        // Libro de facturas emitidas: consulta, cobro de saldos y anulación.
        label: 'Facturas Emitidas',
        icon: 'receipt_long',
        route: '/dashboard/billing',
        allowedRoles: [UserRoles.RECEPTIONIST, UserRoles.ADMIN, UserRoles.SUPER_ADMIN],
        requiredPermissions: [Permission.BillingRead],
      },
      {
        label: 'Tarifario',
        icon: 'price_change',
        route: '/dashboard/service-prices',
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
    ],
  },
  {
    label: 'Laboratorio',
    icon: 'biotech',
    route: '/dashboard/laboratory',
    // RECEPTIONIST incluido: registra la solicitud externa del particular que se
    // paga el examen en ventanilla (`LabOrderExternal`). Espejo de la ruta en
    // dashboard-routing.module.ts.
    allowedRoles: [
      UserRoles.DOCTOR,
      UserRoles.NURSE,
      UserRoles.LABORATORY,
      UserRoles.RECEPTIONIST,
      UserRoles.ADMIN,
      UserRoles.SUPER_ADMIN,
    ],
    requiredPermissions: [Permission.LabRead],
  },
  {
    label: 'Estudios Especiales',
    icon: 'monitor_heart',
    route: '/dashboard/special-studies',
    allowedRoles: [UserRoles.DOCTOR, UserRoles.NURSE, UserRoles.SPECIAL_STUDIES, UserRoles.ADMIN, UserRoles.SUPER_ADMIN],
    requiredPermissions: [Permission.SpecialRead],
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
        label: 'Toma de Inventario',
        icon: 'checklist_rtl',
        route: '/dashboard/assets-control/counts',
        allowedRoles: [UserRoles.ADMIN, UserRoles.SUPER_ADMIN],
        requiredPermissions: [Permission.AssetsManage],
      },
      // "Mantenimiento" se retiró del menú: cero registros desde que existe, y
      // el inventario de esta clínica se lleva para contar existencias por
      // ambiente, no para programar mantenimientos. La pantalla sigue en
      // /dashboard/assets-control/maintenance por si se retoma.
    ],
  },
  {
    label: 'Reportes',
    icon: 'analytics',
    route: '/dashboard/reports',
    // RECEPTIONIST, LABORATORY y SPECIAL_STUDIES se agregan junto con los
    // permisos atómicos: antes no tenían NINGÚN acceso a "Reportes" — ni
    // siquiera para bajar su propio corte de turno (ReportsStaff) o ver lo
    // poco que había de laboratorio (ReportsLab, nuevo).
    allowedRoles: [
      UserRoles.DOCTOR,
      UserRoles.NURSE,
      UserRoles.PHARMACIST,
      UserRoles.RECEPTIONIST,
      UserRoles.LABORATORY,
      UserRoles.SPECIAL_STUDIES,
      UserRoles.ADMIN,
      UserRoles.SUPER_ADMIN,
    ],
    // Debe coincidir con requiredPermissions de la ruta 'reports' en dashboard-routing.module.ts
    // (permissionsGuard usa hasAnyPermission — cualquiera de los 5 alcanza)
    requiredPermissions: [
      Permission.ReportsClinical,
      Permission.ReportsFinancial,
      Permission.ReportsPharmacy,
      Permission.ReportsLab,
      Permission.ReportsStaff,
    ],
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
      {
        // Una sola entrada, no seis: `/dashboard/config` es la página madre y
        // desde ahí se llega a respaldos, parámetros, plantillas, notificaciones
        // e integraciones. Antes esas seis pantallas existían pero no tenían
        // ninguna entrada en el menú — solo se llegaba escribiendo la URL.
        label: 'Configuración',
        icon: 'settings',
        route: '/dashboard/config',
        allowedRoles: [UserRoles.ADMIN, UserRoles.SUPER_ADMIN],
        requiredPermissions: [Permission.SettingsManage],
      },
    ],
  },
]
