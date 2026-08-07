import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreatePatientDto } from './create-patient.dto';

/** DTO mínimo válido para usar como base */
const validBase = {
  firstName: 'Pedro',
  lastName: 'Mamani',
  documentNumber: '12345678',
  birthDate: '1985-03-20',
  gender: 'male',
  clinicId: '550e8400-e29b-41d4-a716-446655440000',
};

async function validateDto(plain: Record<string, any>) {
  const dto = plainToInstance(CreatePatientDto, plain);
  return { dto, errors: await validate(dto) };
}

describe('CreatePatientDto', () => {
  it('acepta un DTO completamente válido', async () => {
    const { errors } = await validateDto(validBase);
    expect(errors).toHaveLength(0);
  });

  // ─── email ──────────────────────────────────────────────────────────────

  describe('email', () => {
    /**
     * Regresión: bug corregido el 2026-04-02.
     * El frontend enviaba "" para email vacío. El @Transform ahora convierte
     * "" a undefined para que @IsOptional() funcione correctamente.
     */
    it('convierte string vacío a undefined (no falla validación)', async () => {
      const { dto, errors } = await validateDto({ ...validBase, email: '' });
      expect(dto.email).toBeUndefined();
      expect(errors.some(e => e.property === 'email')).toBe(false);
    });

    it('acepta email válido', async () => {
      const { errors } = await validateDto({ ...validBase, email: 'usuario@ejemplo.com' });
      expect(errors.some(e => e.property === 'email')).toBe(false);
    });

    it('rechaza email inválido', async () => {
      const { errors } = await validateDto({ ...validBase, email: 'no-es-un-email' });
      expect(errors.some(e => e.property === 'email')).toBe(true);
    });

    it('acepta omitir email completamente', async () => {
      const { errors } = await validateDto(validBase);
      expect(errors.some(e => e.property === 'email')).toBe(false);
    });
  });

  // ─── phone ──────────────────────────────────────────────────────────────

  describe('phone', () => {
    it('convierte string vacío a undefined (no falla validación)', async () => {
      const { dto, errors } = await validateDto({ ...validBase, phone: '' });
      expect(dto.phone).toBeUndefined();
      expect(errors.some(e => e.property === 'phone')).toBe(false);
    });

    it('acepta número de teléfono válido', async () => {
      const { errors } = await validateDto({ ...validBase, phone: '72345678' });
      expect(errors.some(e => e.property === 'phone')).toBe(false);
    });

    it('rechaza teléfono con letras', async () => {
      const { errors } = await validateDto({ ...validBase, phone: 'abc-def' });
      expect(errors.some(e => e.property === 'phone')).toBe(true);
    });

    it('rechaza teléfono demasiado corto (< 7 dígitos)', async () => {
      const { errors } = await validateDto({ ...validBase, phone: '12345' });
      expect(errors.some(e => e.property === 'phone')).toBe(true);
    });
  });

  // ─── emergencyContactPhone ───────────────────────────────────────────────

  describe('emergencyContactPhone', () => {
    it('convierte string vacío a undefined (no falla validación)', async () => {
      const { dto, errors } = await validateDto({ ...validBase, emergencyContactPhone: '' });
      expect(dto.emergencyContactPhone).toBeUndefined();
      expect(errors.some(e => e.property === 'emergencyContactPhone')).toBe(false);
    });

    it('acepta teléfono de emergencia válido', async () => {
      const { errors } = await validateDto({ ...validBase, emergencyContactPhone: '+591 72345678' });
      expect(errors.some(e => e.property === 'emergencyContactPhone')).toBe(false);
    });
  });

  // ─── campos requeridos ──────────────────────────────────────────────────

  describe('campos requeridos', () => {
    it('rechaza si falta firstName', async () => {
      const { errors } = await validateDto({ ...validBase, firstName: undefined });
      expect(errors.some(e => e.property === 'firstName')).toBe(true);
    });

    it('rechaza si falta documentNumber', async () => {
      const { errors } = await validateDto({ ...validBase, documentNumber: undefined });
      expect(errors.some(e => e.property === 'documentNumber')).toBe(true);
    });

    it('rechaza si falta clinicId', async () => {
      const { errors } = await validateDto({ ...validBase, clinicId: undefined });
      expect(errors.some(e => e.property === 'clinicId')).toBe(true);
    });

    it('rechaza clinicId que no es UUID', async () => {
      const { errors } = await validateDto({ ...validBase, clinicId: 'no-es-uuid' });
      expect(errors.some(e => e.property === 'clinicId')).toBe(true);
    });
  });
});
