import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Rastro de anulación de facturas.
 *
 * Anular es la vía elegida para corregir un descuento mal aplicado que se
 * detecta después de emitir el recibo. Como los descuentos **no llevan tope**
 * (decisión de la clínica), anular sin dejar constancia sería justo el agujero
 * por donde se escaparía uno indebido: la factura conserva su número y pasa a
 * `cancelled`, y aquí queda quién la anuló, cuándo y por qué.
 */
export class AddInvoiceVoidTrail1786125000000 implements MigrationInterface {
  name = 'AddInvoiceVoidTrail1786125000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "invoices" ADD "voidReason" text`);
    await queryRunner.query(`ALTER TABLE "invoices" ADD "voidedAt" TIMESTAMP`);
    await queryRunner.query(`ALTER TABLE "invoices" ADD "voided_by" uuid`);
    await queryRunner.query(
      `ALTER TABLE "invoices" ADD CONSTRAINT "FK_invoices_voided_by" FOREIGN KEY ("voided_by") ` +
        `REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "invoices" DROP CONSTRAINT "FK_invoices_voided_by"`);
    await queryRunner.query(`ALTER TABLE "invoices" DROP COLUMN "voided_by"`);
    await queryRunner.query(`ALTER TABLE "invoices" DROP COLUMN "voidedAt"`);
    await queryRunner.query(`ALTER TABLE "invoices" DROP COLUMN "voidReason"`);
  }
}
