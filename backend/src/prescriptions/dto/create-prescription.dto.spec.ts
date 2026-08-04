import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreatePrescriptionDto } from './create-prescription.dto';

/** DTO mínimo válido para usar como base */
const validBase = {
  prescriptionNumber: 'RX-0001',
  prescriptionDate: '2026-08-01',
  expiryDate: '2026-09-01',
  items: [
    {
      medicationName: 'Paracetamol',
      strength: '500mg',
      dosageForm: 'tableta',
      quantity: '1 caja',
      dosage: '1 tableta',
      frequency: 'cada 8 horas',
    },
  ],
  patientId: '550e8400-e29b-41d4-a716-446655440000',
  doctorId: '550e8400-e29b-41d4-a716-446655440001',
  clinicId: '550e8400-e29b-41d4-a716-446655440002',
};

async function validateDto(plain: Record<string, any>) {
  const dto = plainToInstance(CreatePrescriptionDto, plain);
  return { dto, errors: await validate(dto) };
}

describe('CreatePrescriptionDto', () => {
  it('acepta un DTO completamente válido', async () => {
    const { errors } = await validateDto(validBase);
    expect(errors).toHaveLength(0);
  });

  // ─── items ──────────────────────────────────────────────────────────────

  describe('items', () => {
    /**
     * Regresión: bug real corregido en la auditoría de interrelación de
     * módulos (2026-08-04). El DTO calcado (CreateLabOrderDto) sí exige
     * @ArrayMinSize(1) — este no lo tenía. PrescriptionsService.create() fija
     * status ACTIVE por defecto y nunca pasa por validateStatusTransition()
     * (que sí exige ítems, pero solo se invoca desde sign()/setStatus()), así
     * que POST /prescriptions con items: [] creaba una receta ACTIVE sin
     * ningún medicamento.
     */
    it('rechaza items vacío', async () => {
      const { errors } = await validateDto({ ...validBase, items: [] });
      expect(errors.some(e => e.property === 'items')).toBe(true);
    });

    it('acepta al menos un ítem', async () => {
      const { errors } = await validateDto(validBase);
      expect(errors.some(e => e.property === 'items')).toBe(false);
    });
  });

  // ─── campos requeridos ──────────────────────────────────────────────────

  describe('campos requeridos', () => {
    it('rechaza si falta prescriptionNumber', async () => {
      const { errors } = await validateDto({ ...validBase, prescriptionNumber: undefined });
      expect(errors.some(e => e.property === 'prescriptionNumber')).toBe(true);
    });

    it('rechaza si falta patientId', async () => {
      const { errors } = await validateDto({ ...validBase, patientId: undefined });
      expect(errors.some(e => e.property === 'patientId')).toBe(true);
    });

    it('rechaza patientId que no es UUID', async () => {
      const { errors } = await validateDto({ ...validBase, patientId: 'no-es-uuid' });
      expect(errors.some(e => e.property === 'patientId')).toBe(true);
    });
  });
});
