import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Guarda en el ítem la categoría clínica del tarifario (`HEMATOLOGIA`,
 * `QUIMICA_SANGUINEA`…), copiada al crear la orden como ya se copian el precio
 * y el proveedor.
 *
 * Hasta ahora el estudio solo llevaba `category`, que en realidad distingue el
 * tipo de muestra (sangre / imagenología / otro) y se elegía a mano. Con el
 * tarifario real eso quedó doblemente mal: no hay ni un estudio de imagen entre
 * los 110, el tipo de muestra ya lo dice `specimenType`, y la categoría con la
 * que un laboratorio agrupa su trabajo no se veía por ningún lado. Escribirla a
 * mano solo producía contradicciones — un examen de sangre marcado como
 * imagenología.
 */
export class AddLabCategoryToOrderItems1786170000000 implements MigrationInterface {
  name = 'AddLabCategoryToOrderItems1786170000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "lab_order_items" ADD "lab_category" text`);

    // Los estudios ya pedidos toman la categoría de su servicio del tarifario,
    // para que el histórico no quede a medias.
    await queryRunner.query(`
      UPDATE "lab_order_items" i
      SET "lab_category" = sp."lab_category"
      FROM "service_prices" sp
      WHERE i."service_price_id" = sp."id" AND sp."lab_category" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "lab_order_items" DROP COLUMN "lab_category"`);
  }
}
