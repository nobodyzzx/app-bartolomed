import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Unifica los códigos de los dos catálogos bajo una sola convención.
 *
 * Convivían cinco formas: los exámenes de laboratorio con prefijo de categoría
 * clínica y número (`HEM-001`, `QMS-032`), el resto del tarifario con
 * mnemotécnicos de 3 a 5 letras (`CONS-GEN`, `OTR-FICHA`), el generador nuevo
 * con números (`CONS-001`), los medicamentos con un prefijo de clínica que
 * miente —`SB-0001`, cuando `medications` es un catálogo **global** sin
 * clínica— y el formulario de medicamentos fabricando `MED-260809-K3F2` con
 * cuatro caracteres al azar.
 *
 * Queda:
 *
 *     Tarifario     CONS-001  ESP-001  PROC-001  OTR-001     (3 dígitos)
 *     Laboratorio   HEM-001   QMS-032  BAC-007   …           (se conserva)
 *     Medicamentos  MED-0001                                 (4 dígitos)
 *
 * Laboratorio no se toca: su prefijo es la categoría clínica del examen, lleva
 * información real y ya era numérico y correlativo.
 *
 * **Por qué ahora y no después**: `pharmacy_sale_items` guarda una *copia* del
 * código del producto, así que en cuanto haya ventas los recibos antiguos
 * conservarían el código viejo y dejarían de casar con el catálogo. Al aplicar
 * esta migración producción tenía 0 ventas, 0 cargos y 0 facturas. Nada más
 * referencia estos códigos como texto: los cargos apuntan a `service_price_id`
 * y nadie busca un servicio por su código.
 *
 * **Renombrado en dos fases** (`__TMP__` y luego el definitivo) porque el
 * índice único es (clínica, código): renombrando de una sola pasada, un código
 * destino puede estar todavía ocupado por otra fila a la que aún no le toca su
 * turno, y el UPDATE se cae.
 */
export class StandardizeCodes1786250000000 implements MigrationInterface {
  name = 'StandardizeCodes1786250000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── Tarifario: mnemotécnicos → numérico, por clínica y categoría ─────────
    // El orden lo fija el nombre, no el código viejo: así el resultado es
    // estable y no depende de la letra que alguien eligió en su momento.
    // Laboratorio queda fuera (`category <> 'laboratory'`).
    await queryRunner.query(`
      WITH objetivo AS (
        SELECT
          sp."id",
          CASE sp."category"
            WHEN 'consultation'  THEN 'CONS'
            WHEN 'special_study' THEN 'ESP'
            WHEN 'procedure'     THEN 'PROC'
            ELSE                      'OTR'
          END AS prefijo,
          ROW_NUMBER() OVER (
            PARTITION BY sp."clinic_id", sp."category" ORDER BY sp."name", sp."code"
          ) AS n
        FROM "service_prices" sp
        WHERE sp."category" <> 'laboratory'
      )
      UPDATE "service_prices" sp
      SET "code" = '__TMP__' || o.prefijo || '-' || LPAD(o.n::text, 3, '0')
      FROM objetivo o
      WHERE sp."id" = o."id"
    `);
    await queryRunner.query(
      `UPDATE "service_prices" SET "code" = REPLACE("code", '__TMP__', '') WHERE "code" LIKE '__TMP__%'`,
    );

    // ── Medicamentos: SB-NNNN → MED-NNNN ────────────────────────────────────
    // Se conserva el número, que ya era correlativo y alfabético por nombre; lo
    // único que sobra es el prefijo de clínica en un catálogo que no la tiene.
    await queryRunner.query(`
      UPDATE "medications"
      SET "code" = '__TMP__MED-' || LPAD(SUBSTRING("code" FROM '[0-9]+$')::int::text, 4, '0')
      WHERE "code" ~ '^SB-[0-9]+$'
    `);
    // Los que ya venían con el formato de azar del formulario (`MED-260809-K3F2`)
    // entran en la misma secuencia, detrás de los existentes.
    await queryRunner.query(`
      WITH desde AS (
        SELECT COALESCE(MAX(SUBSTRING("code" FROM '[0-9]+$')::int), 0) AS base
        FROM "medications" WHERE "code" LIKE '__TMP__MED-%'
      ), objetivo AS (
        SELECT "id", ROW_NUMBER() OVER (ORDER BY "createdAt", "code") AS n
        FROM "medications"
        WHERE "code" !~ '^MED-[0-9]+$' AND "code" NOT LIKE '__TMP__%'
      )
      UPDATE "medications" m
      SET "code" = '__TMP__MED-' || LPAD((d.base + o.n)::text, 4, '0')
      FROM objetivo o, desde d
      WHERE m."id" = o."id"
    `);
    await queryRunner.query(
      `UPDATE "medications" SET "code" = REPLACE("code", '__TMP__', '') WHERE "code" LIKE '__TMP__%'`,
    );

    // ── El examen dado de alta a mano, a su familia ──────────────────────────
    // "Cultivo Vaginal" se creó desde la pantalla con el código inventado y sin
    // categoría clínica, porque el formulario no la ofrecía (ya la ofrece). Sin
    // ella queda fuera de su grupo al pedir una orden, bajo "Otros estudios".
    await queryRunner.query(`
      UPDATE "service_prices"
      SET "lab_category" = 'BACTERIOLOGIA'
      WHERE "category" = 'laboratory' AND "lab_category" IS NULL AND "name" ILIKE '%cultivo%'
    `);

    // Y se le da el número que le toca dentro de su categoría clínica: se había
    // escrito `BAC-012` cuando bacteriología iba por el 6.
    await queryRunner.query(`
      WITH desde AS (
        SELECT sp."clinic_id", sp."lab_category",
               COALESCE(MAX(SUBSTRING(sp."code" FROM '[0-9]+$')::int), 0) AS base
        FROM "service_prices" sp
        WHERE sp."category" = 'laboratory' AND sp."lab_category" IS NOT NULL
          AND sp."code" ~ '^[A-Z]+-[0-9]+$'
          AND SUBSTRING(sp."code" FROM '[0-9]+$')::int <= 200
        GROUP BY 1, 2
      )
      UPDATE "service_prices" sp
      SET "code" = SUBSTRING(sp."code" FROM '^[A-Z]+') || '-' || LPAD((d.base + 1)::text, 3, '0')
      FROM desde d
      WHERE sp."category" = 'laboratory'
        AND sp."clinic_id" = d."clinic_id"
        AND sp."lab_category" = d."lab_category"
        AND SUBSTRING(sp."code" FROM '[0-9]+$')::int > d.base
    `);
  }

  public async down(): Promise<void> {
    // Sin vuelta atrás: los códigos anteriores eran mnemotécnicos escritos a
    // mano (`CONS-GEN`, `OTR-FICHA`) y no se derivan de ningún dato que quede
    // en la tabla, así que reconstruirlos sería inventarlos otra vez. Nada
    // referencia estos códigos —los cargos apuntan al id—, de modo que
    // quedarse en la convención nueva no rompe nada.
  }
}
