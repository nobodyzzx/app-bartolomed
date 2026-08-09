import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Separa *qué clase de producto es* de *qué clase de fármaco es*.
 *
 * El catálogo de farmacia se llama "medicamentos" pero alrededor de un 20% no
 * lo son: bajalenguas, barbijos, jeringas y gasas por un lado; biberones,
 * cepillos dentales y protector solar por otro. Hasta ahora el único campo de
 * clasificación era `category` (analgésico, antibiótico…), y los 468 productos
 * estaban en `other`, de modo que los filtros del catálogo no separaban nada.
 *
 * Se añade `product_type` en vez de meter "insumo" dentro de `category` porque
 * son dos preguntas distintas: si algo es insumo, no hay clase farmacológica
 * que asignarle; y si `category` se usara para las dos cosas, marcar una
 * jeringa como insumo impediría para siempre decir que la Amoxicilina es un
 * antibiótico.
 *
 * `medication` por defecto: es lo que era el catálogo hasta ahora, y deja el
 * cambio en manos de la clasificación siguiente en vez de vaciar el campo.
 */
export class AddProductType1786290000000 implements MigrationInterface {
  name = 'AddProductType1786290000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "medications_product_type_enum" AS ENUM ('medication', 'supply', 'personal_care');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);
    await queryRunner.query(`
      ALTER TABLE "medications"
      ADD COLUMN IF NOT EXISTS "product_type" "medications_product_type_enum"
      NOT NULL DEFAULT 'medication'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "medications" DROP COLUMN IF EXISTS "product_type"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "medications_product_type_enum"`);
  }
}
