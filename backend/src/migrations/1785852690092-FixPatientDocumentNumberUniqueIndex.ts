import { MigrationInterface, QueryRunner } from 'typeorm';

// Filtrado a mano del ruido incidental que arrastra migration:generate sobre
// audit_logs/purchase_orders/assets (drift preexistente sin relación con este
// cambio, mismo patrón ya visto en 1785842543674-CreateLabOrders.ts) — solo se
// deja el cambio real: el índice único de documentNumber pasa de global a
// parcial (solo entre pacientes activos), para que remove() ya no necesite
// mutar el CI para liberarlo.
export class FixPatientDocumentNumberUniqueIndex1785852690092 implements MigrationInterface {
  name = 'FixPatientDocumentNumberUniqueIndex1785852690092';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "patients" DROP CONSTRAINT "UQ_a7442e2ceeffc71f8a3abfd52c4"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_patients_document_number_active" ON "patients" ("documentNumber") WHERE "isActive" = true`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."UQ_patients_document_number_active"`);
    await queryRunner.query(`ALTER TABLE "patients" ADD CONSTRAINT "UQ_a7442e2ceeffc71f8a3abfd52c4" UNIQUE ("documentNumber")`);
  }
}
