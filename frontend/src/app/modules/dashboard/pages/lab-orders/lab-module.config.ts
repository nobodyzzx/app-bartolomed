import { InjectionToken } from '@angular/core'
import { Permission } from '@core/enums/permission.enum'
import { UserRoles } from '@core/enums/user-roles.enum'
import { ServiceCategory } from '../service-prices/service-prices.service'

/**
 * Lo que distingue a **Laboratorio** de **Estudios Especiales** en la pantalla.
 *
 * Los dos módulos comparten el mismo motor en el backend (`lab_orders`, con un
 * discriminador `order_type`) y aquí comparten los mismos tres componentes. Lo
 * que cambia —la ruta de la API, los textos, si hay muestra que tomar— viaja en
 * esta configuración, que cada módulo perezoso provee en su propio inyector.
 *
 * Ver `2026-08-07 - Decisión - Estudios especiales comparten motor con laboratorio`.
 */
export interface LabModuleConfig {
  /** Segmento de la API: fija el módulo del backend y, con él, el filtro por tipo. */
  apiPath: 'lab-orders' | 'special-studies'
  /** Raíz de las rutas del módulo, para navegar entre sus tres pantallas. */
  routeBase: string
  /** Categoría del tarifario de la que sale el catálogo de estudios. */
  serviceCategory: ServiceCategory
  /** Prefijo del número de orden autogenerado (`LAB-…`, `ESP-…`). */
  orderPrefix: string
  /** Icono del módulo, para las cabeceras y el estado vacío. */
  icon: string
  /**
   * ¿Hay muestra que tomar? Una ecografía se hace, no se recoge. Cuando es
   * falso desaparecen el campo "tipo de muestra" y el estado "muestra tomada":
   * la orden pasa de *solicitada* directamente a *en proceso*.
   */
  hasSpecimen: boolean
  /** Roles que pueden emitir una orden — espejo del backend. */
  orderRoles: UserRoles[]
  /** Roles que pueden mover el estado — espejo del backend. */
  statusRoles: UserRoles[]
  /** Roles que cargan resultados — espejo del backend. */
  resultRoles: UserRoles[]
  /** Permiso que habilita registrar una solicitud que llega de fuera. */
  externalPermission: Permission
  texts: LabModuleTexts
}

export interface LabModuleTexts {
  /** Cabecera de la lista. */
  listTitle: string
  listSubtitle: string
  /** Botón de alta y su equivalente en el estado vacío. */
  newButton: string
  emptyTitle: string
  emptyHint: string
  /** Cabecera del formulario, en sus dos modos. */
  formTitle: string
  formSubtitle: string
  externalFormTitle: string
  externalFormSubtitle: string
  /** Cabecera del detalle. */
  detailSubtitle: string
  /** Cómo se llama al centro al que se deriva y a la acción de derivar. */
  providerLabel: string
  sendToProviderLabel: string
  /** Etiqueta del estado `sent_to_provider`, distinta en cada módulo. */
  sentToProviderStatus: string
  /** Botón de guardar y contador de la barra de acciones. */
  saveButton: string
}

export const LAB_MODULE_CONFIG = new InjectionToken<LabModuleConfig>('LAB_MODULE_CONFIG')

/** Laboratorio clínico: análisis con muestra, derivados a un laboratorio externo. */
export const LABORATORY_MODULE_CONFIG: LabModuleConfig = {
  apiPath: 'lab-orders',
  routeBase: '/dashboard/laboratory',
  serviceCategory: ServiceCategory.LABORATORY,
  orderPrefix: 'LAB',
  icon: 'biotech',
  hasSpecimen: true,
  orderRoles: [UserRoles.DOCTOR, UserRoles.ADMIN, UserRoles.SUPER_ADMIN],
  statusRoles: [UserRoles.DOCTOR, UserRoles.ADMIN, UserRoles.SUPER_ADMIN, UserRoles.LABORATORY],
  resultRoles: [UserRoles.LABORATORY, UserRoles.ADMIN, UserRoles.SUPER_ADMIN],
  externalPermission: Permission.LabOrderExternal,
  texts: {
    listTitle: 'Laboratorio',
    listSubtitle: 'Órdenes de análisis clínicos e imagenología',
    newButton: 'Nueva Orden',
    emptyTitle: 'Sin órdenes de laboratorio',
    emptyHint: 'Comienza creando la primera orden de laboratorio',
    formTitle: 'Nueva Orden de Laboratorio',
    formSubtitle: 'Completa el formulario para solicitar estudios de laboratorio o imagenología',
    externalFormTitle: 'Registrar Solicitud Externa',
    externalFormSubtitle:
      'Paciente que llega con una orden de otro consultorio, o que se paga el examen sin consulta previa',
    detailSubtitle: 'Detalle de la orden de laboratorio',
    providerLabel: 'Laboratorio externo',
    sendToProviderLabel: 'Enviar al laboratorio',
    sentToProviderStatus: 'En el Laboratorio',
    saveButton: 'Guardar Orden',
  },
}

/** Estudios especiales: ecografía, colonoscopía y electrocardiograma. */
export const SPECIAL_STUDIES_MODULE_CONFIG: LabModuleConfig = {
  apiPath: 'special-studies',
  routeBase: '/dashboard/special-studies',
  serviceCategory: ServiceCategory.SPECIAL_STUDY,
  orderPrefix: 'ESP',
  icon: 'monitor_heart',
  // Aquí no hay muestra: el estudio se le hace al paciente en el momento.
  hasSpecimen: false,
  orderRoles: [UserRoles.DOCTOR, UserRoles.ADMIN, UserRoles.SUPER_ADMIN],
  statusRoles: [
    UserRoles.DOCTOR,
    UserRoles.ADMIN,
    UserRoles.SUPER_ADMIN,
    UserRoles.SPECIAL_STUDIES,
  ],
  resultRoles: [UserRoles.SPECIAL_STUDIES, UserRoles.ADMIN, UserRoles.SUPER_ADMIN],
  externalPermission: Permission.LabOrderExternal,
  texts: {
    listTitle: 'Estudios Especiales',
    listSubtitle: 'Ecografías, colonoscopías y electrocardiogramas',
    newButton: 'Nuevo Estudio',
    emptyTitle: 'Sin estudios especiales',
    emptyHint: 'Comienza registrando el primer estudio',
    formTitle: 'Nuevo Estudio Especial',
    formSubtitle: 'Completa el formulario para solicitar un estudio de gabinete',
    externalFormTitle: 'Registrar Solicitud Externa',
    externalFormSubtitle:
      'Paciente que llega con una orden de otro consultorio, o que se paga el estudio sin consulta previa',
    detailSubtitle: 'Detalle del estudio especial',
    providerLabel: 'Centro externo',
    sendToProviderLabel: 'Derivar al centro externo',
    sentToProviderStatus: 'Derivado',
    saveButton: 'Guardar Estudio',
  },
}
