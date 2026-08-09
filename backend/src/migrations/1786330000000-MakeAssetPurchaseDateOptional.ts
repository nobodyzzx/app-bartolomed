import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `assets.purchaseDate` pasa a ser opcional.
 *
 * Era `NOT NULL`, y eso obliga a inventarse una fecha para todo activo que
 * llegue sin ella: el inventario en papel de la clínica no la trae para
 * ninguno de sus 207 ítems. Aquí una fecha inventada es menos inocente que en
 * farmacia, porque de ella salen la antigüedad del activo y su depreciación —
 * dar de alta 207 activos "comprados hoy" haría que dentro de cinco años el
 * sistema afirme, con toda seriedad, que un ecógrafo de segunda mano tiene
 * cinco años exactos.
 *
 * Los cálculos ya están protegidos: `getMonthsOwned()` y `getAge()` devuelven
 * `null` sin fecha, y `calculateDepreciation()` no deprecia cuando falta la
 * fecha o la vida útil es 0 (sin esa guarda, `new Date(null)` daba 1970 y la
 * división por una vida útil de 0 persistía `Infinity`).
 */
export class MakeAssetPurchaseDateOptional1786330000000 implements MigrationInterface {
  name = 'MakeAssetPurchaseDateOptional1786330000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "assets" ALTER COLUMN "purchaseDate" DROP NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Volver a `NOT NULL` exige que no quede ninguna fila sin fecha. Se rellenan
    // con la de alta del registro: es un valor falso, pero dejar la migración
    // irreversible sería peor.
    await queryRunner.query(
      `UPDATE "assets" SET "purchaseDate" = "createdAt"::date WHERE "purchaseDate" IS NULL`,
    );
    await queryRunner.query(`ALTER TABLE "assets" ALTER COLUMN "purchaseDate" SET NOT NULL`);
  }
}
