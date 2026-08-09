import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Cierra los huecos de numeración dentro de cada categoría clínica de
 * laboratorio: `BAC-001…006` + `BAC-012` pasa a `BAC-001…007`.
 *
 * Corrige un fallo de `StandardizeCodes`, que traía un UPDATE para esto y no
 * hacía nada. Calculaba el número mayor de cada categoría **incluyendo la fila
 * que quería renumerar** —la sentencia anterior acababa de asignarle su
 * categoría clínica—, así que el mayor era su propio 12 y la condición
 * "renumera lo que pase del mayor" no alcanzaba a nadie. Una consulta que se
 * anulaba a sí misma y que, leída, parecía funcionar.
 *
 * Aquí no hay condición que esquivar: se reasigna el correlativo a todas las
 * filas de cada grupo por orden de número actual. Donde no hay huecos —que es
 * todo salvo bacteriología— cada fila recibe el número que ya tenía.
 *
 * Solo alcanza a laboratorio y solo a códigos con la forma `PREFIJO-NNN`; los
 * restos mnemotécnicos del seed de desarrollo (`LAB-HEM`, inactivos y
 * duplicados del tarifario real) quedan fuera y no existen en producción.
 */
export class CompactLabCodeNumbers1786260000000 implements MigrationInterface {
  name = 'CompactLabCodeNumbers1786260000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Dos fases por el índice único (clínica, código): al compactar, el número
    // destino de una fila puede seguir ocupado por otra que aún no se movió.
    await queryRunner.query(`
      WITH objetivo AS (
        SELECT
          sp."id",
          SUBSTRING(sp."code" FROM '^[A-Z]+') AS prefijo,
          ROW_NUMBER() OVER (
            PARTITION BY sp."clinic_id", sp."lab_category"
            ORDER BY SUBSTRING(sp."code" FROM '[0-9]+$')::int
          ) AS n
        FROM "service_prices" sp
        WHERE sp."category" = 'laboratory'
          AND sp."lab_category" IS NOT NULL
          AND sp."code" ~ '^[A-Z]+-[0-9]+$'
      )
      UPDATE "service_prices" sp
      SET "code" = '__TMP__' || o.prefijo || '-' || LPAD(o.n::text, 3, '0')
      FROM objetivo o
      WHERE sp."id" = o."id"
    `);
    await queryRunner.query(
      `UPDATE "service_prices" SET "code" = REPLACE("code", '__TMP__', '') WHERE "code" LIKE '__TMP__%'`,
    );
  }

  public async down(): Promise<void> {
    // Nada que deshacer: el hueco que se cierra era un accidente, no un dato.
  }
}
