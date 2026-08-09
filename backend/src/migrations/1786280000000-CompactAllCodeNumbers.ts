import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Cierra los huecos de numeración que dejó partir los exámenes agrupados.
 *
 * `SplitCombinedLabTests` eliminó `QMS-010`, `QMS-023`, `MTU-005` e `INM-004`
 * y añadió las partes al final de cada categoría, así que química quedó
 * `001…038` con dos huecos, marcadores `001…007` con uno e inmunología
 * `001…016` con otro. Un hueco por baja no rompe nada —el generador numera
 * desde el mayor, no desde el total—, pero el usuario prefiere la numeración
 * corrida.
 *
 * Compacta los dos agrupamientos que existen, cada uno dentro de su clínica:
 * laboratorio por categoría clínica (`HEM`, `QMS`…) y el resto por categoría de
 * servicio (`CONS`, `PROC`…). Donde no hay huecos cada fila recibe el número
 * que ya tenía, de modo que solo se mueve lo que hace falta.
 *
 * Quedan fuera los códigos que no siguen la convención `PREFIJO-NNN`: los
 * restos mnemotécnicos del seed de desarrollo (`LAB-HEM` y compañía, inactivos
 * y duplicados del tarifario real), que no existen en producción.
 *
 * Renombrado en dos fases por el índice único (clínica, código): al compactar,
 * el número destino de una fila puede seguir ocupado por otra que aún no se ha
 * movido.
 */
export class CompactAllCodeNumbers1786280000000 implements MigrationInterface {
  name = 'CompactAllCodeNumbers1786280000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      WITH objetivo AS (
        SELECT
          sp."id",
          SUBSTRING(sp."code" FROM '^[A-Z]+') AS prefijo,
          ROW_NUMBER() OVER (
            PARTITION BY
              sp."clinic_id",
              -- En laboratorio agrupa la categoría clínica; en el resto, la de
              -- servicio. El COALESCE evita que los exámenes sin categoría
              -- clínica se mezclen con los de otra al numerar.
              CASE WHEN sp."category" = 'laboratory'
                   THEN COALESCE(sp."lab_category", '(sin categoria)')
                   ELSE sp."category"::text END
            ORDER BY SUBSTRING(sp."code" FROM '[0-9]+$')::int
          ) AS n
        FROM "service_prices" sp
        WHERE sp."code" ~ '^[A-Z]+-[0-9]+$'
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
    // Nada que deshacer: los huecos que se cierran no eran un dato, eran el
    // rastro de las bajas.
  }
}
