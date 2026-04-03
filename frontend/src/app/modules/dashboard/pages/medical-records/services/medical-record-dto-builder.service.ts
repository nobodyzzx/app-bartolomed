import { Injectable } from '@angular/core'
import { ConsentType, CreateMedicalRecordDto, RecordType } from '../interfaces'

/**
 * Servicio que encapsula la lógica de ensamblado del DTO de expediente médico
 * y los mapeos de enums a texto para la UI.
 *
 * Extraído de MedicalRecordFormComponent para reducir su tamaño y mejorar
 * la capacidad de prueba unitaria de la lógica de negocio.
 */
@Injectable({ providedIn: 'root' })
export class MedicalRecordDtoBuilderService {
  /**
   * Ensambla el CreateMedicalRecordDto desde los valores raw de los 3 formularios
   * principales y limpia campos vacíos/inválidos antes de enviarlo al API.
   */
  buildDto(
    patientData: Record<string, unknown>,
    clinicalData: Record<string, unknown>,
    evaluationData: Record<string, unknown>,
    relatedRecordId?: string | null,
  ): CreateMedicalRecordDto {
    const dto: any = {
      ...patientData,
      ...clinicalData,
      ...evaluationData,
    }

    if (relatedRecordId) {
      dto.relatedRecordId = relatedRecordId
    }

    const cleanDto = this.cleanDto(dto)

    // Garantizar patientId y doctorId (pueden estar deshabilitados en modo seguimiento)
    if (!cleanDto.patientId && patientData['patientId']) {
      cleanDto.patientId = patientData['patientId'] as string
    }
    if (!cleanDto.doctorId && patientData['doctorId']) {
      cleanDto.doctorId = patientData['doctorId'] as string
    }

    return cleanDto
  }

  /**
   * Limpia el DTO eliminando propiedades null, undefined o strings vacíos.
   * Mantiene números 0 y booleanos false.
   * Convierte strings numéricos de signos vitales a number.
   */
  cleanDto(dto: Record<string, unknown>): CreateMedicalRecordDto {
    const cleaned: Record<string, unknown> = {}

    const numericFields = [
      'temperature',
      'systolicBP',
      'diastolicBP',
      'heartRate',
      'respiratoryRate',
      'oxygenSaturation',
      'weight',
      'height',
    ]

    for (const key in dto) {
      const value = dto[key]

      if (value === null || value === undefined) continue

      if (numericFields.includes(key)) {
        const numValue = typeof value === 'string' ? parseFloat(value) : (value as number)
        if (!isNaN(numValue) && numValue !== 0) {
          cleaned[key] = numValue
        }
        continue
      }

      if (typeof value === 'string') {
        if (value.trim() !== '' || this.isUUID(value)) {
          cleaned[key] = value
        }
      } else if (
        typeof value === 'number' ||
        typeof value === 'boolean' ||
        value instanceof Date
      ) {
        cleaned[key] = value
      }
    }

    return cleaned as unknown as CreateMedicalRecordDto
  }

  // ─── Display helpers para enums ───────────────────────────────────────────────

  getTypeText(type: RecordType): string {
    const map: Record<RecordType, string> = {
      [RecordType.CONSULTATION]: 'Consulta',
      [RecordType.EMERGENCY]: 'Emergencia',
      [RecordType.SURGERY]: 'Cirugía',
      [RecordType.FOLLOW_UP]: 'Seguimiento',
      [RecordType.LABORATORY]: 'Laboratorio',
      [RecordType.IMAGING]: 'Imagenología',
      [RecordType.OTHER]: 'Otro',
    }
    return map[type] ?? type
  }

  getConsentTypeText(type: ConsentType): string {
    const map: Record<ConsentType, string> = {
      [ConsentType.TREATMENT]:         'Tratamiento médico',
      [ConsentType.SURGERY]:           'Cirugía',
      [ConsentType.ANESTHESIA]:        'Anestesia',
      [ConsentType.BLOOD_TRANSFUSION]: 'Transfusión sanguínea',
      [ConsentType.IMAGING]:           'Diagnóstico por imagen',
      [ConsentType.LABORATORY]:        'Análisis de laboratorio',
      [ConsentType.DISCHARGE]:         'Alta médica',
      [ConsentType.GENERAL]:           'Consentimiento general',
      [ConsentType.OTHER]:             'Otro',
    }
    return map[type] ?? type
  }

  mapConsentTypeToTemplate(
    type: ConsentType,
  ): 'diagnostic' | 'surgery' | 'blood_transfusion' | 'rejection' {
    switch (type) {
      case ConsentType.SURGERY:
      case ConsentType.ANESTHESIA:
        return 'surgery'
      case ConsentType.BLOOD_TRANSFUSION:
        return 'blood_transfusion'
      default:
        return 'diagnostic'
    }
  }

  private isUUID(str: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)
  }
}
