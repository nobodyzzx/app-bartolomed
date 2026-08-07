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
 * Validador personalizado para signos vitales
 * Agrega información de validación pero no bloquea el formulario
 */
export function vitalSignValidator(signName: keyof typeof VITAL_SIGNS_RANGES): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value

    if (!value || value === '') {
      return null // Campo opcional
    }

    const validation = validateVitalSign(signName, parseFloat(value))

    if (!validation) {
      return null
    }

    // Agregar información de validación sin bloquear el formulario
    if (validation.status === 'danger') {
      return { vitalSignDanger: validation }
    }

    if (validation.status === 'warning') {
      return { vitalSignWarning: validation }
    }

    return null // Normal, no hay error
  }
}

/**
 * Obtiene las clases CSS según el estado del signo vital
 */
export function getVitalSignClasses(control: AbstractControl | null): { [key: string]: boolean } {
  if (!control || !control.value) {
    return {}
  }

  const isDanger = control.hasError('vitalSignDanger')
  const isWarning = control.hasError('vitalSignWarning')

  return {
    'vital-sign-normal': !isDanger && !isWarning && control.value,
    'vital-sign-warning': isWarning,
    'vital-sign-danger': isDanger,
  }
}

/**
 * Obtiene el mensaje de validación del signo vital
 */
export function getVitalSignMessage(control: AbstractControl | null): string {
  if (!control || !control.value) {
    return ''
  }

  if (control.hasError('vitalSignDanger')) {
    return control.errors!['vitalSignDanger'].message
  }

  if (control.hasError('vitalSignWarning')) {
    return control.errors!['vitalSignWarning'].message
  }

  // Buscar el rango normal para mostrar mensaje positivo
  return ''
}

/**
 * Obtiene el ícono según el estado del signo vital
 */
export function getVitalSignIcon(control: AbstractControl | null): string {
  if (!control || !control.value) {
    return ''
  }

  if (control.hasError('vitalSignDanger')) {
    return 'error'
  }

  if (control.hasError('vitalSignWarning')) {
    return 'warning'
  }

  return 'check_circle'
}
