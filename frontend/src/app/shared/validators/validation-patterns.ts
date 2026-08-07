/**
 * Patrones reutilizables para Validators.pattern.
 *
 * Centralizar evita drift cuando un campo aparece en varios formularios.
 */
export const VALIDATION_PATTERNS = {
  /** Teléfono internacional opcional: 7-15 dígitos con espacios/guiones, prefijo + opcional. */
  phone: /^\+?[0-9\-\s]{7,15}$/,

  /** Teléfono boliviano (móvil): empieza con 6 ó 7, exactamente 8 dígitos. */
  phoneBolivia: /^[67]\d{7}$/,

  /** Documento alfanumérico: 5-20 caracteres, permite guiones y puntos. */
  documentNumber: /^[A-Za-z0-9\-\.]{5,20}$/,

  /** Sólo dígitos. */
  digitsOnly: /^[0-9]+$/,
} as const
