import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Dos cambios en inventario de farmacia, ambos nacidos del inventario real de
 * la clínica.
 *
 * **1. Marca de muestra médica**, en el medicamento y en el lote. Va en los dos
 * sitios a propósito: hay productos que solo llegan como muestra del
 * laboratorio (marca en `medications`) y productos que entran por las dos vías,
 * comprados y de muestra, donde lo que viene de una u otra parte es cada
 * entrada concreta (marca en `medication_stock`). Es una etiqueta informativa,
 * no un candado: en esta clínica las muestras se venden igual —su inventario
 * lleva columna de "vendidos"—, así que marcarlas no bloquea la venta.
 *
 * **2. `expiryDate` pasa a ser opcional.** Era `NOT NULL`, y eso obligaba a
 * inventarse una fecha para todo stock que llegue sin ella; el inventario en
 * papel de la clínica no la trae para ninguno de sus ~475 productos. Una fecha
 * inventada es peor que ninguna: lejana, el control de vencimientos da por
 * bueno cualquier producto para siempre; cercana, llena la pantalla de alertas
 * falsas el día que caiga. Con `NULL` la consulta de próximos a vencer
 * simplemente no los alcanza —en SQL `expiryDate <= X` con NULL no es cierto—
 * y la pantalla puede decir "sin registrar", que es la verdad.
 */
export class AddMedicalSampleAndOptionalExpiry1786230000000 implements MigrationInterface {
  name = 'AddMedicalSampleAndOptionalExpiry1786230000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "medications" ADD COLUMN IF NOT EXISTS "is_medical_sample" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "medication_stock" ADD COLUMN IF NOT EXISTS "is_medical_sample" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(`ALTER TABLE "medication_stock" ALTER COLUMN "expiryDate" DROP NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Volver a `NOT NULL` exige que no quede ninguna fila sin fecha, o el ALTER
    // falla y tumba el revert entero. Se rellenan con la fecha de recepción:
    // es un valor falso, pero el revert solo tiene sentido si se va a
    // abandonar la función, y dejar la migración irreversible sería peor.
    await queryRunner.query(
      `UPDATE "medication_stock" SET "expiryDate" = "receivedDate" WHERE "expiryDate" IS NULL`,
    );
    await queryRunner.query(`ALTER TABLE "medication_stock" ALTER COLUMN "expiryDate" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "medication_stock" DROP COLUMN IF EXISTS "is_medical_sample"`);
    await queryRunner.query(`ALTER TABLE "medications" DROP COLUMN IF EXISTS "is_medical_sample"`);
  }
}
