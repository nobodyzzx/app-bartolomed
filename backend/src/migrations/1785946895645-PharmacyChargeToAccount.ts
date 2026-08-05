import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Marca las ventas de farmacia que no se cobran en su propia caja porque
 * quedaron como cargo en la cuenta del paciente (Fase 4 de facturación).
 *
 * Sin este flag, los reportes de caja de farmacia contarían como ingreso
 * propio algo que en realidad cobra la caja general.
 *
 * Migración filtrada a mano: la autogenerada arrastraba el ruido incidental
 * de siempre (índices de audit_logs/purchase_orders/assets), incluido el
 * DROP+ADD de columnas de audit_logs que borraría ese dato del historial.
 */
export class PharmacyChargeToAccount1785946895645 implements MigrationInterface {
  name = 'PharmacyChargeToAccount1785946895645';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "pharmacy_sales" ADD "charged_to_account" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "pharmacy_sales" DROP COLUMN "charged_to_account"`);
  }
}
