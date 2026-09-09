import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Permite que un ítem del inventario tenga cantidad cero.
 *
 * `AddAssetQuantity` puso `CHECK (quantity > 0)` con este argumento: «una
 * cantidad de 0 no significa nada en un conteo de existencias: lo que ya no
 * está se marca como dado de baja, no se deja en cero». Es un buen argumento
 * para un bien —una camilla que ya no está se da de baja— y uno malo para los
 * consumibles que el mismo inventario cuenta.
 *
 * La planilla de Virgen de las Nieves lo muestra: «Caja con jeringas de 1 ml —
 * 0», «Portaobjetos, solo hay caja — 0», «Guantes de nylon — 0». No son bienes
 * dados de baja; son renglones del conteo que hoy están vacíos y que se
 * repondrán. Darlos de baja diría que dejaron de existir en el consultorio, y
 * omitirlos haría que el inventario del sistema no cuadre con el papel que la
 * clínica firma.
 *
 * Es además lo que el sistema ya hace en farmacia, donde un lote en 0 es un
 * estado corriente: el producto sigue en catálogo, con su precio fijado,
 * esperando reposición.
 *
 * La distinción sigue existiendo y ahora es más limpia: `quantity = 0` dice
 * «este renglón del conteo está sin existencias», y `status` sigue diciendo si
 * el bien se dio de baja, se perdió o está en mantenimiento. Las negativas
 * siguen prohibidas, que sí son siempre un error de carga.
 */
export class AllowZeroQuantityAssets1786435000000 implements MigrationInterface {
  name = 'AllowZeroQuantityAssets1786435000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "assets" DROP CONSTRAINT "CHK_assets_quantity_positive"`);
    await queryRunner.query(
      `ALTER TABLE "assets" ADD CONSTRAINT "CHK_assets_quantity_positive" CHECK ("quantity" >= 0)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Volver a `> 0` con filas en cero haría fallar el ALTER. Se dan de baja
    // primero: es la lectura que tenía el sistema antes de esta migración.
    await queryRunner.query(`UPDATE "assets" SET "quantity" = 1, "status" = 'retired' WHERE "quantity" = 0`);
    await queryRunner.query(`ALTER TABLE "assets" DROP CONSTRAINT "CHK_assets_quantity_positive"`);
    await queryRunner.query(
      `ALTER TABLE "assets" ADD CONSTRAINT "CHK_assets_quantity_positive" CHECK ("quantity" > 0)`,
    );
  }
}
