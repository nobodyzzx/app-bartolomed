import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Rastro de cancelación de ventas de farmacia — mismo criterio que
 * AddInvoiceVoidTrail para facturas. Cancelar una venta revierte stock, el
 * cargo a cuenta (si lo hubo) y la receta dispensada; sin esto, el único
 * rastro que quedaba era el campo libre `notes`, compartido con cualquier
 * otra anotación de la venta y sin exigirse en el backend.
 */
export class AddPharmacySaleCancelTrail1786430000000 implements MigrationInterface {
  name = 'AddPharmacySaleCancelTrail1786430000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "pharmacy_sales" ADD "cancel_reason" text`);
    await queryRunner.query(`ALTER TABLE "pharmacy_sales" ADD "cancelled_at" TIMESTAMP`);
    await queryRunner.query(`ALTER TABLE "pharmacy_sales" ADD "cancelled_by" uuid`);
    await queryRunner.query(
      `ALTER TABLE "pharmacy_sales" ADD CONSTRAINT "FK_pharmacy_sales_cancelled_by" FOREIGN KEY ("cancelled_by") ` +
        `REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "pharmacy_sales" DROP CONSTRAINT "FK_pharmacy_sales_cancelled_by"`);
    await queryRunner.query(`ALTER TABLE "pharmacy_sales" DROP COLUMN "cancelled_by"`);
    await queryRunner.query(`ALTER TABLE "pharmacy_sales" DROP COLUMN "cancelled_at"`);
    await queryRunner.query(`ALTER TABLE "pharmacy_sales" DROP COLUMN "cancel_reason"`);
  }
}
