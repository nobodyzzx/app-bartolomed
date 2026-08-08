import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Módulo de Estudios Especiales: ecografía, colonoscopia y electrocardiograma.
 *
 * No son análisis de laboratorio —no hay muestra que recoger, se hacen sobre el
 * paciente— pero comparten todo lo demás: se piden, generan cargo, tienen
 * resultado y se entregan en un informe. Por eso el motor es el mismo y lo que
 * separa los dos módulos es `lab_orders.order_type`, que cada endpoint filtra:
 * el gabinete no ve las órdenes del laboratorio ni al revés.
 *
 * Los tres estudios se dan de alta **inactivos**: sin precio acordado no deben
 * poder pedirse, o generarían un cargo de Bs 0. Se activan desde el tarifario
 * al fijarles precio.
 */
export class AddSpecialStudies1786180000000 implements MigrationInterface {
  name = 'AddSpecialStudies1786180000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."lab_orders_order_type_enum" AS ENUM('lab', 'special')`,
    );
    await queryRunner.query(
      `ALTER TABLE "lab_orders" ADD "order_type" "public"."lab_orders_order_type_enum" NOT NULL DEFAULT 'lab'`,
    );

    // El enum se **recrea** en vez de usar `ALTER TYPE ... ADD VALUE`: TypeORM
    // corre todas las migraciones dentro de una única transacción, y Postgres
    // no deja usar un valor de enum recién añadido en la misma transacción que
    // lo creó ("unsafe use of new value"). Recrear el tipo sí es transaccional
    // y permite insertar los estudios a continuación.
    await queryRunner.query(
      `ALTER TYPE "service_prices_category_enum" RENAME TO "service_prices_category_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "service_prices_category_enum" AS ENUM('consultation', 'laboratory', 'special_study', 'procedure', 'other')`,
    );
    await queryRunner.query(`ALTER TABLE "service_prices" ALTER COLUMN "category" DROP DEFAULT`);
    await queryRunner.query(
      `ALTER TABLE "service_prices" ALTER COLUMN "category" TYPE "service_prices_category_enum" USING "category"::text::"service_prices_category_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "service_prices" ALTER COLUMN "category" SET DEFAULT 'other'`,
    );
    await queryRunner.query(`DROP TYPE "service_prices_category_enum_old"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const especiales = await queryRunner.query(
      `SELECT count(*)::int AS n FROM "lab_orders" WHERE "order_type" = 'special'`,
    );
    if (especiales[0]?.n > 0) {
      throw new Error(
        `Hay ${especiales[0].n} orden(es) de estudios especiales. Revísalas antes de revertir: ` +
          `al quitar la columna quedarían mezcladas con las de laboratorio.`,
      );
    }
    await queryRunner.query(
      `DELETE FROM "service_prices" WHERE "category" = 'special_study'`,
    );
    await queryRunner.query(`ALTER TABLE "lab_orders" DROP COLUMN "order_type"`);
    await queryRunner.query(`DROP TYPE "public"."lab_orders_order_type_enum"`);

    await queryRunner.query(
      `ALTER TYPE "service_prices_category_enum" RENAME TO "service_prices_category_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "service_prices_category_enum" AS ENUM('consultation', 'laboratory', 'procedure', 'other')`,
    );
    await queryRunner.query(`ALTER TABLE "service_prices" ALTER COLUMN "category" DROP DEFAULT`);
    await queryRunner.query(
      `ALTER TABLE "service_prices" ALTER COLUMN "category" TYPE "service_prices_category_enum" USING "category"::text::"service_prices_category_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "service_prices" ALTER COLUMN "category" SET DEFAULT 'other'`,
    );
    await queryRunner.query(`DROP TYPE "service_prices_category_enum_old"`);
  }
}
