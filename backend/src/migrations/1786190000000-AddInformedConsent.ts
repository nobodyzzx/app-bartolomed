import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fase 5 — consentimiento informado.
 *
 * - `service_prices.requires_consent`: qué estudios lo exigen (colonoscopía sí).
 * - `lab_order_items.requires_consent`: copia del catálogo al pedir la orden,
 *   para que el detalle sepa qué avisar sin volver a consultar el tarifario.
 * - `lab_orders.consent_acknowledged`: constancia de que el papel firmado ya
 *   está archivado. No bloquea nada: la orden se puede emitir sin marcarlo.
 *
 * Aditiva y con defaults, así que las filas existentes quedan en `false` sin
 * tocar dato. Marca la colonoscopía (`ESP-COL`) como el estudio que lo requiere.
 */
export class AddInformedConsent1786190000000 implements MigrationInterface {
  name = 'AddInformedConsent1786190000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "service_prices" ADD "requires_consent" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "lab_order_items" ADD "requires_consent" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "lab_orders" ADD "consent_acknowledged" boolean NOT NULL DEFAULT false`,
    );

    // La colonoscopía es el único de los tres estudios de gabinete que exige
    // consentimiento informado (endoscopía baja, con preparación previa).
    await queryRunner.query(
      `UPDATE "service_prices" SET "requires_consent" = true WHERE "code" = 'ESP-COL'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "lab_orders" DROP COLUMN "consent_acknowledged"`);
    await queryRunner.query(`ALTER TABLE "lab_order_items" DROP COLUMN "requires_consent"`);
    await queryRunner.query(`ALTER TABLE "service_prices" DROP COLUMN "requires_consent"`);
  }
}
