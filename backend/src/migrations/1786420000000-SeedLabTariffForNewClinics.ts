import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Copia el tarifario de laboratorio y estudios especiales a las clínicas que
 * nacieron sin él.
 *
 * El catálogo real de laboratorio se cargó con `ReplaceLabCatalogWithRealTariff`
 * y los estudios especiales con `SeedSpecialStudyPrices`. «Virgen de las Nieves»
 * se creó **después** de esas dos migraciones y las migraciones no se repiten,
 * así que se quedó con las consultas, los procedimientos y los otros —que sí
 * vienen del seed inicial— pero con **cero** exámenes y cero estudios. En la
 * práctica eso significa que en esa clínica no se puede pedir un análisis: el
 * selector de exámenes lee este catálogo.
 *
 * Las dos clínicas están a una puerta, atienden a la misma población y derivan
 * al mismo laboratorio externo, así que el tarifario es idéntico: se copia
 * entero, incluidos el precio de convenio (`cost_price`), el proveedor externo,
 * los plazos de entrega y la marca de consentimiento.
 *
 * **Copia y no referencia compartida**: el tarifario es por clínica a propósito
 * (`uq_service_price_clinic_code`), para que cada una pueda ajustar sus precios
 * sin arrastrar a la otra. Que hoy coincidan es un hecho, no una regla.
 *
 * Idempotente por partida doble: solo actúa sobre la clínica que no tiene
 * **ninguna** fila vigente de esa categoría, y el `ON CONFLICT` cubre el resto.
 * En desarrollo, donde las dos clínicas ya tienen su catálogo, no inserta nada.
 */
export class SeedLabTariffForNewClinics1786420000000 implements MigrationInterface {
  name = 'SeedLabTariffForNewClinics1786420000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "service_prices"
        ("code", "name", "description", "category", "price", "cost_price",
         "lab_category", "provider_name", "turnaround_min_days",
         "turnaround_max_days", "turnaround_note", "requires_consent",
         "is_active", "clinic_id")
      SELECT
        src."code", src."name", src."description", src."category", src."price",
        src."cost_price", src."lab_category", src."provider_name",
        src."turnaround_min_days", src."turnaround_max_days",
        src."turnaround_note", src."requires_consent", src."is_active",
        destino."id"
      FROM "service_prices" src
      CROSS JOIN "clinics" destino
      WHERE src."deletedAt" IS NULL
        AND src."category" IN ('laboratory', 'special_study')
        -- La clínica de referencia es la que tiene el catálogo de laboratorio,
        -- no una elegida por su nombre: renombrar una clínica no debe cambiar
        -- de dónde sale el tarifario.
        AND src."clinic_id" = (
          SELECT "clinic_id"
          FROM "service_prices"
          WHERE "category" = 'laboratory' AND "deletedAt" IS NULL
          GROUP BY "clinic_id"
          ORDER BY COUNT(*) DESC
          LIMIT 1
        )
        AND destino."id" <> src."clinic_id"
        -- Por categoría y no en bloque: una clínica podría tener los exámenes y
        -- faltarle los estudios especiales, y ese hueco también hay que taparlo.
        -- Y solo si está vacía: media copia sobre un catálogo ya ajustado le
        -- mezclaría precios ajenos.
        AND NOT EXISTS (
          SELECT 1
          FROM "service_prices" ya
          WHERE ya."clinic_id" = destino."id"
            AND ya."category" = src."category"
            AND ya."deletedAt" IS NULL
        )
      ON CONFLICT ON CONSTRAINT "uq_service_price_clinic_code" DO NOTHING
    `);
  }

  public async down(): Promise<void> {
    // Deliberadamente vacío. Las filas copiadas son indistinguibles de las
    // originales —mismo código, mismo nombre, mismos precios— y desde que se
    // insertan pueden haberse ajustado a mano. Un DELETE por categoría se
    // llevaría por delante el tarifario legítimo de una clínica que quizá nunca
    // pasó por esta migración (en desarrollo, sin ir más lejos, las dos ya lo
    // tenían). Revertir a ciegas es peor que no revertir: si hace falta
    // deshacerlo, se borra a mano el tarifario de la clínica concreta.
  }
}
