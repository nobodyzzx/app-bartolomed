import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Agrega `quantity` a los activos.
 *
 * El módulo se diseñó como registro de bienes contables (precio, depreciación,
 * garantía, número de serie), pero lo que la clínica necesita del inventario es
 * más simple: **qué hay, cuánto, dónde está y si sirve**. De los ~40 campos de
 * la ficha, el inventario real usa cinco.
 *
 * Sin cantidad, la misma planilla entraba con dos criterios contradictorios: una
 * caja de 137 agujas quedaba como una ficha con el número escondido en una nota,
 * mientras 4 sensores se abrían en cuatro fichas "(1 de 4)". Ninguno de los dos
 * permite responder "cuántos hay".
 *
 * `DEFAULT 1` deja consistente lo ya cargado — cada ficha existente es una
 * unidad. La recarga que colapsa las fichas "(n de m)" en un ítem con su cantidad
 * va aparte, en `ReloadSanBartolomeAssetsWithQuantity`.
 */
export class AddAssetQuantity1786370000000 implements MigrationInterface {
  name = 'AddAssetQuantity1786370000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "assets" ADD COLUMN "quantity" integer NOT NULL DEFAULT 1`);
    // Una cantidad de 0 o negativa no significa nada en un conteo de existencias:
    // lo que ya no está se marca como dado de baja, no se deja en cero.
    await queryRunner.query(
      `ALTER TABLE "assets" ADD CONSTRAINT "CHK_assets_quantity_positive" CHECK ("quantity" > 0)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "assets" DROP CONSTRAINT "CHK_assets_quantity_positive"`);
    await queryRunner.query(`ALTER TABLE "assets" DROP COLUMN "quantity"`);
  }
}
