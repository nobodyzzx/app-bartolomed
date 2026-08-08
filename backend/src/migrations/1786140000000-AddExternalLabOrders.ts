import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Permite registrar solicitudes de laboratorio que no nacen de una indicación
 * médica de la casa.
 *
 * Hasta ahora la única forma de crear una orden era `POST /lab-orders`, con
 * `@Auth(DOCTOR, ADMIN)`: el paciente que llegaba al mesón con una orden en
 * papel de otro consultorio, o el particular que se pagaba una glucemia sin
 * consulta previa, no tenían cómo entrar al sistema — había que ir a buscar a
 * un médico o al admin para que la creara a nombre suyo, lo que además dejaba
 * en el expediente un "indicado por" que era falso.
 *
 * Tres cambios, todos aditivos:
 *  - `origin` distingue la orden interna de la externa (por defecto interna,
 *    que es lo que son todas las existentes).
 *  - `referring_doctor_name` guarda al solicitante externo como texto, porque
 *    no es usuario del sistema.
 *  - `doctor_id` pasa a nullable: en una orden externa no hay médico de la
 *    casa que la firme. La obligatoriedad para las internas la impone el DTO,
 *    no la columna, porque depende de `origin`.
 */
export class AddExternalLabOrders1786140000000 implements MigrationInterface {
  name = 'AddExternalLabOrders1786140000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."lab_orders_origin_enum" AS ENUM('internal', 'external')`,
    );
    await queryRunner.query(
      `ALTER TABLE "lab_orders" ADD "origin" "public"."lab_orders_origin_enum" NOT NULL DEFAULT 'internal'`,
    );
    await queryRunner.query(`ALTER TABLE "lab_orders" ADD "referring_doctor_name" text`);
    await queryRunner.query(`ALTER TABLE "lab_orders" ALTER COLUMN "doctor_id" DROP NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Volver atrás exige que no quede ninguna orden externa: sin `doctor_id`
    // no podrían satisfacer el NOT NULL, y borrarlas en silencio destruiría
    // órdenes con resultados y cargos ya cobrados.
    const externas = await queryRunner.query(
      `SELECT count(*)::int AS n FROM "lab_orders" WHERE "doctor_id" IS NULL`,
    );
    if (externas[0]?.n > 0) {
      throw new Error(
        `Hay ${externas[0].n} orden(es) de laboratorio sin médico de la casa (externas). ` +
          `Asígnales un doctor_id antes de revertir esta migración.`,
      );
    }
    await queryRunner.query(`ALTER TABLE "lab_orders" ALTER COLUMN "doctor_id" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "lab_orders" DROP COLUMN "referring_doctor_name"`);
    await queryRunner.query(`ALTER TABLE "lab_orders" DROP COLUMN "origin"`);
    await queryRunner.query(`DROP TYPE "public"."lab_orders_origin_enum"`);
  }
}
