import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Motivo del descuento en las ventas de farmacia, y quién lo autorizó.
 *
 * El punto de cobro ya lo exigía —`charges` guarda `discount_reason` y
 * `discount_authorized_by` desde la facturación unificada—, pero la venta de
 * farmacia solo guardaba el importe: se podía rebajar cualquier cifra sin dejar
 * constancia de la razón ni de quién la aprobó, que es exactamente lo que hace
 * falta para revisar después un descuento indebido.
 *
 * Todas las columnas son nulables: las ventas ya registradas no tienen motivo y
 * no se inventa uno. La obligatoriedad se aplica a las nuevas, en el servicio.
 */
export class AddDiscountReasonToPharmacySales1786210000000 implements MigrationInterface {
  name = 'AddDiscountReasonToPharmacySales1786210000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "pharmacy_sales"
      ADD COLUMN IF NOT EXISTS "discount_reason" text,
      ADD COLUMN IF NOT EXISTS "discount_authorized_by" uuid
    `);

    await queryRunner.query(`
      ALTER TABLE "pharmacy_sales"
      ADD CONSTRAINT "FK_pharmacy_sales_discount_authorized_by"
      FOREIGN KEY ("discount_authorized_by") REFERENCES "users"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "pharmacy_sale_items"
      ADD COLUMN IF NOT EXISTS "discount_reason" text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "pharmacy_sale_items" DROP COLUMN IF EXISTS "discount_reason"
    `);
    await queryRunner.query(`
      ALTER TABLE "pharmacy_sales"
      DROP CONSTRAINT IF EXISTS "FK_pharmacy_sales_discount_authorized_by"
    `);
    await queryRunner.query(`
      ALTER TABLE "pharmacy_sales"
      DROP COLUMN IF EXISTS "discount_authorized_by",
      DROP COLUMN IF EXISTS "discount_reason"
    `);
  }
}
