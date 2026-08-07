import { MigrationInterface, QueryRunner } from 'typeorm';

// Filtrado a mano del ruido incidental que arrastra migration:generate sobre
// audit_logs/purchase_orders/assets (drift preexistente sin relación con este
// cambio, mismo patrón ya visto en 1785842543674-CreateLabOrders.ts y
// 1785852690092-FixPatientDocumentNumberUniqueIndex.ts) — solo se deja el
// cambio real: persistir la tasa de impuesto usada al crear la venta, para
// que update() pueda reusarla al recalcular en vez de asumir 13% fijo.
export class AddTaxRateToPharmacySale1785854111206 implements MigrationInterface {
  name = 'AddTaxRateToPharmacySale1785854111206';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "pharmacy_sales" ADD "taxRate" numeric(5,4) NOT NULL DEFAULT '0.13'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "pharmacy_sales" DROP COLUMN "taxRate"`);
  }
}
