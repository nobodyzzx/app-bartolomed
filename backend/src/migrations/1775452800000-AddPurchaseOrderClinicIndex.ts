import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Índice sobre `purchase_orders.clinicId` — la única de las tablas con scoping
 * por clínica que quedó sin índice. Las demás (invoices, pharmacy_sales,
 * medical_records, prescriptions, appointments, stock_transfers) ya lo tienen
 * desde la migración 1775157754446-AddStockTransferSystem.
 *
 * Nota: a diferencia de esas tablas, `purchase_orders` nunca fue retrofitteada
 * a `clinic_id` (snake_case) — la columna real sigue siendo "clinicId" (camelCase,
 * ver 1775098053948-InitialSchema).
 */
export class AddPurchaseOrderClinicIndex1775452800000 implements MigrationInterface {
  name = 'AddPurchaseOrderClinicIndex1775452800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "IDX_purchase_orders_clinic" ON "purchase_orders" ("clinicId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_purchase_orders_clinic_created" ON "purchase_orders" ("clinicId", "createdAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_purchase_orders_clinic_created"`);
    await queryRunner.query(`DROP INDEX "IDX_purchase_orders_clinic"`);
  }
}
