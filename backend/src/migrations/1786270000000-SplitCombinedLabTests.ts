import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Parte cuatro exámenes que el tarifario del proveedor traía agrupados, para
 * que cada componente pueda pedirse y cobrarse por separado:
 *
 *     Perfil lipídico HDL, VLDL, LDL       → Perfil lipídico HDL / VLDL / LDL
 *     Bilirrubinas total, directa e ind.   → Bilirrubina total / directa / indirecta
 *     PSA total y libre                    → PSA total / PSA libre
 *     RPR / VDRL                           → RPR / VDRL
 *
 * Los tres del lipídico conservan "Perfil lipídico" en el nombre a pedido del
 * usuario: sueltos, "HDL" y "VLDL" no dicen de qué examen salen.
 *
 * **Cada parte hereda el precio y el costo de convenio del examen entero**, no
 * una fracción. Es decisión del usuario y tiene consecuencia: pedir los tres
 * componentes del lipídico costará el triple que el perfil agrupado. Se hereda
 * también la entrega, el consentimiento y el estado.
 *
 * **El examen agrupado se elimina.** Se comprobó antes de aplicarlo que no
 * hubiera nada que lo referenciara: 0 órdenes de laboratorio, 0 ítems de orden
 * y 0 cargos en producción. Los cargos apuntan a `service_price_id`, así que
 * con historial vivo esto no sería un borrado sino una pérdida de vínculo.
 *
 * Alcanza a **todas las clínicas** que tengan estos códigos, para que
 * desarrollo y producción queden iguales. Los precios no se tocan: cada fila
 * copia el suyo, que difiere entre entornos.
 */
export class SplitCombinedLabTests1786270000000 implements MigrationInterface {
  name = 'SplitCombinedLabTests1786270000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // `orden` es correlativo dentro de la categoría clínica, no dentro del
    // examen de origen: química sanguínea recibe seis partes de dos exámenes
    // distintos y todas tienen que caer en números consecutivos y libres.
    await queryRunner.query(`
      WITH partes(origen, nombre, orden) AS (
        VALUES
          ('QMS-010', 'Perfil lipídico HDL',    1),
          ('QMS-010', 'Perfil lipídico VLDL',   2),
          ('QMS-010', 'Perfil lipídico LDL',    3),
          ('QMS-023', 'Bilirrubina total',      4),
          ('QMS-023', 'Bilirrubina directa',    5),
          ('QMS-023', 'Bilirrubina indirecta',  6),
          ('MTU-005', 'PSA total',              1),
          ('MTU-005', 'PSA libre',              2),
          ('INM-004', 'RPR',                    1),
          ('INM-004', 'VDRL',                   2)
      ),
      base AS (
        SELECT sp."clinic_id", sp."lab_category",
               COALESCE(MAX(SUBSTRING(sp."code" FROM '[0-9]+$')::int), 0) AS n
        FROM "service_prices" sp
        WHERE sp."category" = 'laboratory'
          AND sp."lab_category" IS NOT NULL
          AND sp."code" ~ '^[A-Z]+-[0-9]+$'
        GROUP BY 1, 2
      )
      INSERT INTO "service_prices"
        ("code", "name", "category", "lab_category", "price", "cost_price",
         "turnaround_min_days", "turnaround_max_days", "turnaround_note",
         "requires_consent", "is_active", "clinic_id")
      SELECT
        SUBSTRING(o."code" FROM '^[A-Z]+') || '-' || LPAD((b.n + p.orden)::text, 3, '0'),
        p.nombre, 'laboratory', o."lab_category", o."price", o."cost_price",
        o."turnaround_min_days", o."turnaround_max_days", o."turnaround_note",
        o."requires_consent", o."is_active", o."clinic_id"
      FROM partes p
      JOIN "service_prices" o
        ON o."code" = p.origen AND o."category" = 'laboratory'
      JOIN base b
        ON b."clinic_id" = o."clinic_id" AND b."lab_category" = o."lab_category"
      ON CONFLICT ON CONSTRAINT "uq_service_price_clinic_code" DO NOTHING
    `);

    // El agrupado se va. Deja hueco en la numeración de su categoría (el 010 y
    // el 023 de química, el 005 de marcadores, el 004 de inmunología); un hueco
    // por baja es normal en un catálogo y el generador numera desde el mayor,
    // así que no provoca choques.
    await queryRunner.query(`
      DELETE FROM "service_prices"
      WHERE "category" = 'laboratory'
        AND "code" IN ('QMS-010', 'QMS-023', 'MTU-005', 'INM-004')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Rehace el agrupado a partir de una de sus partes —que conserva precio,
    // costo, entrega y clínica— y retira las partes.
    await queryRunner.query(`
      WITH agrupados(code, nombre, referencia) AS (
        VALUES
          ('QMS-010', 'Perfil lipídico HDL, VLDL, LDL',          'Perfil lipídico HDL'),
          ('QMS-023', 'Bilirrubinas total, directa e indirecta', 'Bilirrubina total'),
          ('MTU-005', 'PSA total y libre',                       'PSA total'),
          ('INM-004', 'RPR / VDRL',                              'RPR')
      )
      INSERT INTO "service_prices"
        ("code", "name", "category", "lab_category", "price", "cost_price",
         "turnaround_min_days", "turnaround_max_days", "turnaround_note",
         "requires_consent", "is_active", "clinic_id")
      SELECT a.code, a.nombre, 'laboratory', r."lab_category", r."price", r."cost_price",
             r."turnaround_min_days", r."turnaround_max_days", r."turnaround_note",
             r."requires_consent", r."is_active", r."clinic_id"
      FROM agrupados a
      JOIN "service_prices" r ON r."name" = a.referencia AND r."category" = 'laboratory'
      ON CONFLICT ON CONSTRAINT "uq_service_price_clinic_code" DO NOTHING
    `);
    await queryRunner.query(`
      DELETE FROM "service_prices"
      WHERE "category" = 'laboratory'
        AND "name" IN (
          'Perfil lipídico HDL', 'Perfil lipídico VLDL', 'Perfil lipídico LDL',
          'Bilirrubina total', 'Bilirrubina directa', 'Bilirrubina indirecta',
          'PSA total', 'PSA libre', 'RPR', 'VDRL'
        )
    `);
  }
}
