import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `charges.invoice_id` no tenía clave foránea.
 *
 * La columna existe desde la facturación unificada y apunta a `invoices`, pero
 * la base nunca lo supo: borrar facturas dejaba cargos marcados como
 * `invoiced` apuntando al vacío, sin una sola queja. Apareció al ejecutar
 * `seed/reset`, que borra `invoices` antes que `charges` — nueve cargos
 * quedaron facturados contra facturas inexistentes.
 *
 * Se añade con `ON DELETE SET NULL` y no con `RESTRICT`: anular una factura ya
 * tiene su camino propio (`voidInvoice`, que devuelve los cargos a `pending`),
 * así que un borrado directo de facturas es cosa de mantenimiento o de un
 * reset. En ese caso lo correcto es que el cargo se quede sin factura, no que
 * el borrado se bloquee.
 *
 * Antes de crearla se limpian los huérfanos que pueda haber: sin eso, el ALTER
 * falla y la migración no arranca.
 */
export class AddChargeInvoiceForeignKey1786310000000 implements MigrationInterface {
  name = 'AddChargeInvoiceForeignKey1786310000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Un cargo cuya factura no existe no está facturado: vuelve a pendiente.
    await queryRunner.query(`
      UPDATE "charges" SET "status" = 'pending', "invoice_id" = NULL
      WHERE "invoice_id" IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM "invoices" i WHERE i."id" = "charges"."invoice_id")
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "charges"
        ADD CONSTRAINT "FK_charges_invoice"
        FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "charges" DROP CONSTRAINT IF EXISTS "FK_charges_invoice"`);
  }
}
