import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * `pharmacy_invoices` tenía dos columnas separadas apuntando conceptualmente a lo
 * mismo: `saleId`/`createdById` (escalares, siempre poblados por el código de
 * aplicación) y `sale_id`/`created_by` (las columnas reales usadas por las
 * relaciones @ManyToOne vía @JoinColumn, nunca escritas por create()). Como
 * resultado, `sale_id`/`created_by` quedaban NULL para TODAS las facturas y
 * cualquier join sobre `invoice.sale`/`invoice.createdBy` no encontraba nada
 * (findAll/findOne/getOverdueInvoices/getTotalRevenue/getPendingAmount/
 * markOverdueInvoices) — bug real detectado en vivo, no solo en el código nuevo.
 * Se elimina la columna FK muerta y se apunta el JoinColumn a la columna que sí
 * está poblada.
 */
export class FixPharmacyInvoiceSaleAndCreatedByJoinColumns1785709192099 implements MigrationInterface {
    name = 'FixPharmacyInvoiceSaleAndCreatedByJoinColumns1785709192099'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "pharmacy_invoices" DROP CONSTRAINT "FK_8dce0ac03d69cf57795f8e8a5f3"`);
        await queryRunner.query(`ALTER TABLE "pharmacy_invoices" DROP CONSTRAINT "FK_d4204c9aa1f3ea3280c28ed4222"`);
        await queryRunner.query(`ALTER TABLE "pharmacy_invoices" DROP COLUMN "sale_id"`);
        await queryRunner.query(`ALTER TABLE "pharmacy_invoices" DROP COLUMN "created_by"`);
        await queryRunner.query(`ALTER TABLE "pharmacy_invoices" ADD CONSTRAINT "FK_1270dcbad64e9aea6c29a7196f2" FOREIGN KEY ("saleId") REFERENCES "pharmacy_sales"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "pharmacy_invoices" ADD CONSTRAINT "FK_ffda3d8b923e25ed0d435a8f86a" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "pharmacy_invoices" DROP CONSTRAINT "FK_ffda3d8b923e25ed0d435a8f86a"`);
        await queryRunner.query(`ALTER TABLE "pharmacy_invoices" DROP CONSTRAINT "FK_1270dcbad64e9aea6c29a7196f2"`);
        await queryRunner.query(`ALTER TABLE "pharmacy_invoices" ADD "created_by" uuid`);
        await queryRunner.query(`ALTER TABLE "pharmacy_invoices" ADD "sale_id" uuid`);
        await queryRunner.query(`ALTER TABLE "pharmacy_invoices" ADD CONSTRAINT "FK_d4204c9aa1f3ea3280c28ed4222" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "pharmacy_invoices" ADD CONSTRAINT "FK_8dce0ac03d69cf57795f8e8a5f3" FOREIGN KEY ("sale_id") REFERENCES "pharmacy_sales"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}
