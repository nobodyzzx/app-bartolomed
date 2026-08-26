import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms'

/**
 * Rangos de referencia para signos vitales
 * Valores basados en estándares médicos para adultos
 */
export const VITAL_SIGNS_RANGES = {
  temperature: {
    dangerLow: 35,
    warningLow: 35.5,
    normal: { min: 36, max: 37.5 },
    warningHigh: 38,
    dangerHigh: 39.5,
    unit: '°C',
  },
  systolicBP: {
    dangerLow: 80,
    warningLow: 90,
    normal: { min: 90, max: 130 },
    warningHigh: 140,
    dangerHigh: 160,
    unit: 'mmHg',
  },
  diastolicBP: {
    dangerLow: 50,
    warningLow: 60,
    normal: { min: 60, max: 85 },
    warningHigh: 90,
    dangerHigh: 100,
    unit: 'mmHg',
  },
  heartRate: {
    dangerLow: 45,
    warningLow: 50,
    normal: { min: 60, max: 100 },
    warningHigh: 110,
    dangerHigh: 130,
    unit: 'lpm',
  },
  respiratoryRate: {
    dangerLow: 8,
    warningLow: 10,
    normal: { min: 12, max: 20 },
    warningHigh: 24,
    dangerHigh: 30,
    unit: 'rpm',
  },
  oxygenSaturation: {
    dangerLow: 88,
    warningLow: 92,
    normal: { min: 95, max: 100 },
    warningHigh: 100,
    dangerHigh: 100,
    unit: '%',
  },
}

/**
 * Límites duros de cordura (coinciden con los @Min/@Max de CreateMedicalRecordDto
 * en el backend). Fuera de este rango el valor es fisiológicamente imposible —
 * casi siempre un error de tipeo (ej. Fahrenheit en vez de Celsius) — y sí debe
 * bloquear el guardado, para evitar el viaje redondo al servidor y su 400.
 */
export const VITAL_SIGNS_HARD_LIMITS: Partial<
  Record<keyof typeof VITAL_SIGNS_RANGES, { min: number; max: number }>
> = {
  temperature: { min: 30, max: 45 },
  systolicBP: { min: 60, max: 250 },
  diastolicBP: { min: 40, max: 150 },
  heartRate: { min: 30, max: 200 },
  respiratoryRate: { min: 8, max: 40 },
  oxygenSaturation: { min: 80, max: 100 },
}

export type VitalSignStatus = 'normal' | 'warning' | 'danger'

export interface VitalSignValidation {
  status: VitalSignStatus
  message: string
  value: number
}

/**
 * Valida un signo vital y retorna su estado
 */
export function validateVitalSign(
  signName: keyof typeof VITAL_SIGNS_RANGES,
  value: number | null | undefined,
): VitalSignValidation | null {
  if (value === null || value === undefined || isNaN(value)) {
    return null
  }

  const ranges = VITAL_SIGNS_RANGES[signName]

  // Peligro bajo
  if (value < ranges.dangerLow) {
    return {
      status: 'danger',
      message: `Valor crítico bajo (<${ranges.dangerLow} ${ranges.unit})`,
      value,
    }
  }

  // Advertencia bajo
  if (value < ranges.warningLow) {
    return {
      status: 'warning',
      message: `Valor bajo (${ranges.warningLow}-${ranges.normal.min} ${ranges.unit})`,
      value,
    }
  }

  // Peligro alto
  if (value > ranges.dangerHigh) {
    return {
      status: 'danger',
      message: `Valor crítico alto (>${ranges.dangerHigh} ${ranges.unit})`,
      value,
    }
  }

  // Advertencia alto
  if (value > ranges.warningHigh) {
    return {
      status: 'warning',
      message: `Valor alto (${ranges.normal.max}-${ranges.warningHigh} ${ranges.unit})`,
      value,
    }
  }

  // Normal
  return {
    status: 'normal',
    message: `Valor normal (${ranges.normal.min}-${ranges.normal.max} ${ranges.unit})`,
    value,
  }
}

/**
 * Validador de cordura para signos vitales.
 *
 * Solo bloquea el formulario cuando el valor cae fuera de VITAL_SIGNS_HARD_LIMITS
 * (fisiológicamente imposible / error de tipeo). Un valor clínicamente anormal
 * pero real — fiebre, hipotensión, taquicardia — es *información*, no un error
 * de captura, así que nunca invalida el control: eso se muestra aparte vía
 * getVitalSignClasses/getVitalSignMessage, sin bloquear "Actualizar Expediente".
 */
export function vitalSignValidator(signName: keyof typeof VITAL_SIGNS_RANGES): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value

    if (value === null || value === undefined || value === '') {
      return null // Campo opcional
    }

    const numValue = parseFloat(value)
    if (isNaN(numValue)) {
      return null
    }

    const limits = VITAL_SIGNS_HARD_LIMITS[signName]
    if (limits && (numValue < limits.min || numValue > limits.max)) {
      return {
        vitalSignOutOfRange: {
          message: `Fuera de rango permitido (${limits.min}-${limits.max} ${VITAL_SIGNS_RANGES[signName].unit})`,
        },
      }
    }

    return null
  }
}

/**
 * Obtiene las clases CSS según el estado clínico del signo vital.
 * Es puramente informativo: se calcula directo del valor, no de control.errors,
 * para que un estado "warning"/"danger" (clínicamente real) nunca dependa de ni
 * se confunda con la validez del control (ver vitalSignValidator).
 */
export function getVitalSignClasses(
  control: AbstractControl | null,
  signName: keyof typeof VITAL_SIGNS_RANGES,
): { [key: string]: boolean } {
  if (!control || !control.value) {
    return {}
  }

  const validation = validateVitalSign(signName, parseFloat(control.value))
  if (!validation) {
    return {}
  }

  return {
    'vital-sign-normal': validation.status === 'normal',
    'vital-sign-warning': validation.status === 'warning',
    'vital-sign-danger': validation.status === 'danger',
  }
}

/**
 * Obtiene el mensaje de validación del signo vital. Si el control tiene un
 * error de rango duro (vitalSignOutOfRange) ese mensaje tiene prioridad porque
 * ahí sí bloquea el guardado; si no, muestra el estado clínico informativo.
 */
export function getVitalSignMessage(
  control: AbstractControl | null,
  signName: keyof typeof VITAL_SIGNS_RANGES,
): string {
  if (!control || !control.value) {
    return ''
  }

  if (control.hasError('vitalSignOutOfRange')) {
    return control.errors!['vitalSignOutOfRange'].message
  }

  const validation = validateVitalSign(signName, parseFloat(control.value))
  return validation && validation.status !== 'normal' ? validation.message : ''
}

/**
 * Obtiene el ícono según el estado del signo vital
 */
export function getVitalSignIcon(
  control: AbstractControl | null,
  signName: keyof typeof VITAL_SIGNS_RANGES,
): string {
  if (!control || !control.value) {
    return ''
  }

  if (control.hasError('vitalSignOutOfRange')) {
    return 'error'
  }

  const validation = validateVitalSign(signName, parseFloat(control.value))
  if (!validation) return ''

  return validation.status === 'danger' ? 'error' : validation.status === 'warning' ? 'warning' : 'check_circle'
}
